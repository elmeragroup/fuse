/**
 * Unit under test: the `Sheet (open)` set as the kit builds it, the Backdrop's frame and the panel's
 * instance over it, which `fixed-placement.ts` places against the right edge.
 * Oracle: Chromium's layout of the real Fuse Sheet open on its right side over its scrim, rendered by
 * the set's own compare-page renderer, in every mode of `EVERY_MODE`: the scrim's and the panel's
 * border boxes against the viewport host, at the viewport the set declares and with the host resized,
 * as a designer resizes the open frame. The host is the capture's: before any resize, it must be as
 * large as the declared viewport. The test places the panel as Figma's auto layout places a
 * frame's one child, from the built frame's direction, padding and alignment and the instance's
 * sizing, and checks that place against Chromium's. It goes red where the build draws the panel
 * anywhere but against the scrim's right edge and as tall as it, or where Sheet's CSS moves the panel
 * off that edge.
 */
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

import { captureTargets } from "../capture/capture-targets.ts";
import { EVERY_MODE } from "../capture/page-modes.ts";
import type { PageMode } from "../capture/page-modes.ts";
import { CAPTURE_THEME, requestOf } from "../capture/run-capture.ts";
import { CompareBrowser } from "../compare/browser-render.ts";
import { loadRenderers } from "../compare/cell-renderers.ts";
import { locateFuseBuild, readPageAssets } from "../compare/page-assets.ts";
import { cellSelector, PAGE_LAYOUT } from "../compare/preview-page.ts";
import { buildComponentSets } from "./build-kit.ts";
import type { ComponentRootSpec, NumberSpec, SizeSpec } from "./kit-spec.ts";

/** How far apart, in CSS pixels, a Figma place and Chromium's may sit: a few 64ths of a pixel. */
const TOLERANCE_PX = 0.05;

/** The set under test and its one variant. */
const SET = "sheet-open";
const VARIANT = "sheet-open/side=right";

/**
 * The sizes of the open frame: the viewport the set declares, then a larger one, as a designer
 * resizes the frame. Both are desktop layouts. Resizing the host leaves the page's media queries
 * reading its window, so neither reaches Sheet's below-`sm` arm, and each is at least 497.78px wide,
 * where the md size's `min(448px, 90%)` is 448px, as the README's Sheet section says.
 */
const FRAMES = [
  { width: 640, height: 448 },
  { width: 960, height: 600 },
] as const;

/** A box in CSS pixels. */
type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** What the page measures in one mode at one frame size, each box from the host's top left. */
type Measured = {
  readonly mode: string;
  readonly frame: { readonly width: number; readonly height: number };
  readonly scrim: Box;
  readonly panel: Box;
};

/** A literal number of the spec, which the open frame's lengths all are. */
function literal(spec: NumberSpec): number {
  if (spec.kind !== "literal") {
    throw new Error(
      `the open frame binds a length to ${spec.variable.name}, which this test reads as a literal`
    );
  }
  return spec.value;
}

/** A child's length on one axis as Figma's auto layout gives it, in room the frame leaves. */
function lengthIn(size: SizeSpec, room: number): number {
  switch (size.kind) {
    case "fixed":
      return literal(size.length);
    case "fill":
      return room;
    default:
      throw new Error(`the panel's instance ${size.kind}s, which this test cannot place`);
  }
}

/** Where along an axis Figma's auto layout puts a child of a length in room starting at `start`. */
function startIn(align: string, start: number, room: number, length: number): number {
  if (align === "MIN") {
    return start;
  }
  if (align === "MAX") {
    return start + room - length;
  }
  if (align === "CENTER") {
    return start + (room - length) / 2;
  }
  throw new Error(`the open frame aligns ${align}, which this test cannot place`);
}

/** One axis of a box: where it starts and how long it is. */
type Span = { readonly start: number; readonly length: number };

/**
 * Where Figma's auto layout puts the frame's one child along one axis: the child's sizing gives its
 * length in the room the padding leaves, and a child that fills starts at the padding, while any
 * other takes the axis's alignment, the primary one along the frame's direction and the counter one
 * across it.
 */
function spanIn(size: SizeSpec, align: string, start: number, room: number): Span {
  const length = lengthIn(size, room);
  return { start: size.kind === "fill" ? start : startIn(align, start, room, length), length };
}

/**
 * The panel's box as Figma's auto layout lays out the frame's one child in a frame of the given
 * size: the frame's padding leaves the room, the child's sizing gives its lengths in that room, and
 * the frame's alignments put it there, the primary one along the frame's direction, across for a
 * horizontal frame and down for a vertical one. A child with a `placement` sits outside the auto
 * layout, and a grid places its children in tracks, neither of which this formula places, so it
 * fails.
 */
function figmaPanel(
  root: ComponentRootSpec,
  frame: { readonly width: number; readonly height: number }
): Box {
  const [child, ...rest] = root.children;
  if (
    child === undefined ||
    rest.length > 0 ||
    child.kind !== "instance" ||
    child.placement !== undefined ||
    root.direction === "GRID"
  ) {
    throw new Error("the open frame is not a row or a column that places the panel's instance alone");
  }
  const left = literal(root.paddingLeft);
  const top = literal(root.paddingTop);
  const across = frame.width - left - literal(root.paddingRight);
  const down = frame.height - top - literal(root.paddingBottom);
  const horizontal = root.direction === "HORIZONTAL";
  const x = spanIn(child.sizing.horizontal, horizontal ? root.primaryAlign : root.counterAlign, left, across);
  const y = spanIn(child.sizing.vertical, horizontal ? root.counterAlign : root.primaryAlign, top, down);
  return { x: x.start, y: y.start, width: x.length, height: y.length };
}

/**
 * What the page measures: the host as the capture lays it out, before the test touches its style,
 * then the scrim and the panel in every mode at every frame size.
 */
type Measurements = {
  readonly host: { readonly width: number; readonly height: number };
  readonly each: readonly Measured[];
};

/** Measure the host as laid out, then the scrim and the panel in every mode at every frame size. */
function measureEveryMode(page: Page, cell: string): Promise<Measurements> {
  return page.evaluate(
    ({ modes, frames, host, scrimAt, panelAt }) => {
      const element = (selector: string): HTMLElement => {
        const found = document.querySelector(selector);
        if (!(found instanceof HTMLElement)) {
          throw new Error(`the open Sheet lacks ${selector}`);
        }
        return found;
      };
      const viewport = element(host);
      const laidOut = viewport.getBoundingClientRect();
      const scrim = element(scrimAt);
      const panel = element(panelAt);
      const out: Measured[] = [];
      for (const mode of modes) {
        for (const [name, value] of Object.entries(mode.root)) {
          document.documentElement.setAttribute(name, value);
        }
        for (const [name, value] of Object.entries(mode.body)) {
          document.body.setAttribute(name, value);
        }
        for (const frame of frames) {
          viewport.style.width = `${String(frame.width)}px`;
          viewport.style.height = `${String(frame.height)}px`;
          const origin = viewport.getBoundingClientRect();
          const from = (box: DOMRect): Box => ({
            x: box.x - origin.x,
            y: box.y - origin.y,
            width: box.width,
            height: box.height,
          });
          out.push({
            mode: `${JSON.stringify(mode.root)} ${JSON.stringify(mode.body)}`,
            frame,
            scrim: from(scrim.getBoundingClientRect()),
            panel: from(panel.getBoundingClientRect()),
          });
        }
      }
      return { host: { width: laidOut.width, height: laidOut.height }, each: out };
    },
    {
      modes: EVERY_MODE satisfies readonly PageMode[],
      frames: FRAMES,
      host: cellSelector(cell, "[data-compare-viewport]"),
      scrimAt: cellSelector(cell, '[data-slot="sheet-overlay"]'),
      panelAt: cellSelector(cell, '[data-slot="sheet-content"]'),
    }
  );
}

/** Build the set, then render its cell on the compare page and measure it in every mode. */
function buildAndMeasure() {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const set = (yield* buildComponentSets()).find((each) => each.componentSet.key === SET);
        const variant = set?.componentSet.variants.find((each) => each.key === VARIANT);
        const [target] = captureTargets(new Set([SET]));
        const renderers = yield* loadRenderers(new Set([SET]));
        const renderer = renderers.get(SET);
        if (variant === undefined || target === undefined || renderer === undefined) {
          throw new Error(`the kit builds no ${VARIANT}, or the compare page renders no ${SET}`);
        }
        const browser = yield* CompareBrowser.launch(
          yield* readPageAssets(yield* locateFuseBuild(), renderers)
        );
        const request = requestOf(target, renderer, { side: "right" }, 0);
        const measured = yield* browser.openPreview(CAPTURE_THEME, [request], PAGE_LAYOUT, (opened) =>
          measureEveryMode(opened.page, request.id)
        );
        return { root: variant.root, measured };
      })
    ).pipe(Effect.provide(NodeServices.layer))
  );
}

describe("the open Sheet over its scrim", () => {
  it("draws the panel against the scrim's right edge and as tall as it, as Chromium lays it out in every mode", async () => {
    const { root, measured: measurements } = await buildAndMeasure();
    const [declared] = FRAMES;
    // The capture lays the host out at the viewport the set declares, before any resize.
    expect(measurements.host).toEqual(declared);
    const measured = measurements.each;
    expect(measured).toHaveLength(EVERY_MODE.length * FRAMES.length);
    const at = (box: Box): Box => ({
      x: Math.round(box.x / TOLERANCE_PX) * TOLERANCE_PX,
      y: Math.round(box.y / TOLERANCE_PX) * TOLERANCE_PX,
      width: Math.round(box.width / TOLERANCE_PX) * TOLERANCE_PX,
      height: Math.round(box.height / TOLERANCE_PX) * TOLERANCE_PX,
    });
    // The Backdrop's frame is the scrim, as large as the viewport the set declares.
    expect({
      width: literal(fixedOf(root.sizing.horizontal)),
      height: literal(fixedOf(root.sizing.vertical)),
    }).toEqual(declared);
    const differing = measured.flatMap((each) => {
      const scrim = { x: 0, y: 0, ...each.frame };
      const figma = figmaPanel(root, each.frame);
      const close = (a: Box, b: Box) =>
        (["x", "y", "width", "height"] as const).every(
          (field) => Math.abs(a[field] - b[field]) <= TOLERANCE_PX
        );
      return close(each.scrim, scrim) && close(each.panel, figma)
        ? []
        : [
            {
              mode: each.mode,
              frame: each.frame,
              scrim: at(each.scrim),
              panel: at(each.panel),
              figma: at(figma),
            },
          ];
    });
    expect(differing).toEqual([]);
  }, 120_000);
});

/** The length of a fixed sizing, which the open frame's own sizing is. */
function fixedOf(size: SizeSpec): NumberSpec {
  if (size.kind !== "fixed") {
    throw new Error(`the open frame ${size.kind}s, where the scrim covers the viewport`);
  }
  return size.length;
}
