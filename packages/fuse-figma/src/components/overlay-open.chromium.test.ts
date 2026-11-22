/**
 * Unit under test: the open overlay sets as the kit builds them, `Sheet (open)` and `List detail
 * (open)`: the Backdrop's frame, the scrim, and the panel's instance over it, which
 * `fixed-placement.ts` places against the right edge, and in `List detail (open)` the detail inside
 * the panel the instance shows, the header row with the title and `ListDetail.Close` over the product.
 * Oracle: Chromium's layout of the real Fuse Sheet open on its right side and of the real Fuse
 * ListDetail in its overlay layout with its first customer open, each rendered by the set's own
 * compare-page renderer, in every mode of `EVERY_MODE`, at the viewport the set declares and with the
 * host resized, as a designer resizes the open frame. The host is the capture's: before any resize,
 * it must be as large as the declared viewport.
 *
 * The test lays the built frames out as Figma's auto layout does, from each frame's direction,
 * padding, strokes, gap, alignments and each layer's sizing. A length bound to a variable takes the
 * value the synced variables resolve to in the mode (`test/kit-variables.ts`). A frame that hugs an
 * axis sums its layers along its direction, and across it takes the longest of the layers that do
 * not fill that axis, which the ones that fill stretch to (rule 29 of `plugin/src/fake/layout.ts`).
 * The fake itself reads one node's length and places no children, so it cannot lay out these frames.
 * A text that hugs takes the width of its characters, which a DOM `Range` around them measures apart
 * from any box that stretches, since this test checks where the layers sit and not how wide a glyph
 * is. Its height is one line at the built text's line height, in pixels or as a percent of its font
 * size, and the test throws where Chromium wraps the text onto a second line. An instance takes its
 * length from its own sizing. The panel takes the root `primaryAlign` override the open frame's
 * instance sets. A paint, corner, shadow or text alignment override moves no layer, and the test
 * throws on any other override and on a property the instance sets.
 * The layout throws on what it cannot place as Figma would: a size limit, a layer that fills the axis
 * its frame hugs along, a hugging axis that every layer fills, and a grid, an icon or a placed layer.
 * It skips the `padding box` layer that holds a fill inside the border where it sits outside the
 * auto layout, since it stretches with its frame and takes no room in its hug, as probe SH1 in the
 * README found. One in the auto layout meets the checks every other layer does.
 *
 * It goes red where the build draws a panel anywhere but against the scrim's right edge and as tall
 * as it, where Sheet's CSS moves the panel off that edge, where the open frame's instance shows
 * another set than the one Chromium lays out in the panel, or where it places a part of the detail
 * where Chromium does not, such as a close packed beside the title or bound to another length.
 */
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

import { builtKit, variantRoot } from "../../test/built-kit.ts";
import { lengthsIn } from "../../test/kit-variables.ts";
import { captureTargets } from "../capture/capture-targets.ts";
import { EVERY_MODE } from "../capture/page-modes.ts";
import type { PageMode } from "../capture/page-modes.ts";
import { CAPTURE_THEME, requestOf } from "../capture/run-capture.ts";
import { CompareBrowser } from "../compare/browser-render.ts";
import { loadRenderers } from "../compare/cell-renderers.ts";
import { locateFuseBuild, readPageAssets } from "../compare/page-assets.ts";
import { cellSelector, PAGE_LAYOUT } from "../compare/preview-page.ts";
import { outOfLayout } from "./kit-spec.ts";
import type {
  ChildLayerSpec,
  ComponentRootSpec,
  InstanceLayerSpec,
  NumberSpec,
  SizeSpec,
  TextLayerSpec,
} from "./kit-spec.ts";
import { PADDING_BOX_FILL } from "./padding-box-fill.ts";

/** How far apart, in CSS pixels, a Figma place and Chromium's may sit: a few 64ths of a pixel. */
const TOLERANCE_PX = 0.05;

/**
 * The sizes of the open frame: the viewport each set declares, then a larger one, as a designer
 * resizes the frame. Both are desktop layouts. Resizing the host leaves the page's media queries
 * reading its window, so neither reaches Sheet's below-`sm` arm, and each is at least 497.78px wide,
 * where the md size's `min(448px, 90%)` is 448px, as the README's Sheet section says. The List detail
 * root's `split="never"` keeps the detail in the Sheet at both.
 */
const FRAMES = [
  { width: 640, height: 448 },
  { width: 960, height: 600 },
] as const;

/** A box in CSS pixels. */
type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** A width and a height in CSS pixels. */
type Size = { readonly width: number; readonly height: number };

/** The width of a text's characters in CSS pixels, and the number of lines Chromium sets them on. */
type Characters = { readonly width: number; readonly lines: number };

/**
 * A layer of the panel's own set the test places: its key path from the panel's root, the element of
 * the real component that draws it, and, where the layer holds a text, that text's key, which takes
 * the size of the element's characters where it hugs.
 */
type Part = { readonly path: readonly string[]; readonly at: string; readonly text?: string };

/** An open overlay set: its one variant, the cell the renderer draws, the panel's element and parts. */
type Overlay = {
  readonly set: string;
  readonly variant: string;
  readonly cell: Readonly<Record<string, string>>;
  readonly panelAt: string;
  readonly parts: Readonly<Record<string, Part>>;
};

const SHEET_OPEN: Overlay = {
  set: "sheet-open",
  variant: "sheet-open/side=right",
  cell: { side: "right" },
  panelAt: '[data-slot="sheet-content"]',
  parts: {},
};

const LIST_DETAIL_OPEN: Overlay = {
  set: "list-detail-open",
  variant: "list-detail-open/content=value",
  cell: { content: "value" },
  panelAt: '[data-slot="list-detail-detail"]',
  parts: {
    item: { path: ["inner", "item"], at: '[data-slot="sheet-content-inner"] > div' },
    header: { path: ["inner", "item", "header"], at: '[data-slot="sheet-content-inner"] > div > div' },
    title: {
      path: ["inner", "item", "header", "title"],
      at: '[data-slot="list-detail-title"]',
      text: "text",
    },
    close: { path: ["inner", "item", "header", "close"], at: '[data-slot="sheet-close"]' },
    product: {
      path: ["inner", "item", "product"],
      at: '[data-slot="sheet-content-inner"] > div > p',
      text: "text",
    },
  },
};

const OVERLAYS = [SHEET_OPEN, LIST_DETAIL_OPEN] as const;

/** A frame of the spec, a root or a frame layer, that lays out its children. */
type LaidOutFrame = Pick<
  ComponentRootSpec,
  | "direction"
  | "children"
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft"
  | "itemSpacing"
  | "primaryAlign"
  | "counterAlign"
  | "stroke"
  | "limits"
>;

/** A layer an auto layout places: any but an icon. */
type FlowLayer = Exclude<ChildLayerSpec, { readonly kind: "icon" }>;

/** An axis of a box, by the length it measures. */
type Axis = "width" | "height";

/** A layer's sizing on one axis. */
function sizeOn(layer: FlowLayer, axis: Axis): SizeSpec {
  return axis === "width" ? layer.sizing.horizontal : layer.sizing.vertical;
}

/**
 * Lays out built frames as Figma's auto layout does in one mode, given the width Chromium gives each
 * text that hugs. It throws on a layer it cannot place as Figma would, rather than place it
 * another way.
 */
class FigmaLayout {
  readonly #length: (spec: NumberSpec) => number;
  readonly #text: (path: readonly string[]) => number;
  readonly #placed = new Map<string, Box>();

  /**
   * @param length - The pixels a number of the spec holds in the mode.
   * @param text - The width Chromium gives the characters of the one-line text at a key path.
   */
  constructor(length: (spec: NumberSpec) => number, text: (path: readonly string[]) => number) {
    this.#length = length;
    this.#text = text;
  }

  /** The box the layout put the layer at the key path in, once {@link place} placed it. */
  at(path: readonly string[]): Box {
    const box = this.#placed.get(path.join("/"));
    if (box === undefined) {
      throw new Error(`the built frames have no layer at ${path.join("/")}`);
    }
    return box;
  }

  /** Place a frame and every layer below it in a box. */
  place(frame: LaidOutFrame, box: Box, path: readonly string[]): void {
    unlimited(frame.limits, path);
    this.#placed.set(path.join("/"), box);
    const inset = this.#insets(frame);
    const horizontal = this.#horizontal(frame, path);
    const inner = {
      x: box.x + inset.left,
      y: box.y + inset.top,
      width: box.width - inset.left - inset.right,
      height: box.height - inset.top - inset.bottom,
    };
    const alongAxis: Axis = horizontal ? "width" : "height";
    const acrossAxis: Axis = horizontal ? "height" : "width";
    const along = inner[alongAxis];
    const across = inner[acrossAxis];
    const children = this.#inFlow(frame, path);
    const gap = children.length > 1 ? this.#length(frame.itemSpacing) : 0;
    const lengthOn = (each: (typeof children)[number], axis: Axis, room: number) =>
      this.#lengthOf(sizeOn(each.layer, axis), room, () => this.#hugged(each.layer, each.path, axis));
    const fills = children.filter((each) => sizeOn(each.layer, alongAxis).kind === "fill").length;
    const fixedAlong = children
      .filter((each) => sizeOn(each.layer, alongAxis).kind !== "fill")
      .reduce((sum, each) => sum + lengthOn(each, alongAxis, 0), 0);
    const share = fills === 0 ? 0 : (along - fixedAlong - gap * (children.length - 1)) / fills;
    const lengths = children.map((each) => ({
      along: lengthOn(each, alongAxis, share),
      across: lengthOn(each, acrossAxis, across),
    }));
    const used = lengths.reduce((sum, each) => sum + each.along, 0) + gap * (children.length - 1);
    const free = along - used;
    const spaced = frame.primaryAlign === "SPACE_BETWEEN" && children.length > 1;
    const start = frame.primaryAlign === "MAX" ? free : frame.primaryAlign === "CENTER" ? free / 2 : 0;
    const step = spaced ? gap + free / (children.length - 1) : gap;
    let cursor = spaced ? 0 : start;
    children.forEach((each, index) => {
      const length = lengths[index] ?? { along: 0, across: 0 };
      const offset =
        frame.counterAlign === "MAX"
          ? across - length.across
          : frame.counterAlign === "CENTER"
            ? (across - length.across) / 2
            : 0;
      const placed: Box = horizontal
        ? { x: inner.x + cursor, y: inner.y + offset, width: length.along, height: length.across }
        : { x: inner.x + offset, y: inner.y + cursor, width: length.across, height: length.along };
      cursor += length.along + step;
      if (each.layer.kind === "frame") {
        this.place(each.layer, placed, each.path);
      } else {
        this.#placed.set(each.path.join("/"), placed);
      }
    });
  }

  /** A layer's length on one axis: the room it fills, its fixed length, or the length it hugs. */
  #lengthOf(size: SizeSpec, room: number, hugged: () => number): number {
    switch (size.kind) {
      case "fill":
        return room;
      case "fixed":
        return this.#length(size.length);
      case "hug":
        return hugged();
      default:
        throw new Error(`a layer sizes as ${size.kind}, which this test cannot place`);
    }
  }

  /**
   * The length a layer hugs to on one axis: a text's width from Chromium and its height from its line
   * height, a frame's from its layers. Along its direction a frame sums its layers and the gaps
   * between them. Across it, a layer that fills stretches to the length the frame's other layers set
   * (rule 29 of `plugin/src/fake/layout.ts`), so the longest of the layers that do not fill sets it.
   */
  #hugged(layer: ChildLayerSpec, path: readonly string[], axis: Axis): number {
    if (layer.kind === "text") {
      return axis === "width" ? this.#text(path) : this.#lineHeight(layer);
    }
    if (layer.kind !== "frame") {
      throw new Error(`the ${layer.kind} at ${path.join("/")} hugs, which this test cannot size`);
    }
    const inset = this.#insets(layer);
    const padding = axis === "width" ? inset.left + inset.right : inset.top + inset.bottom;
    const children = this.#inFlow(layer, path);
    const filling = children.filter((each) => sizeOn(each.layer, axis).kind === "fill");
    const setting = children.filter((each) => sizeOn(each.layer, axis).kind !== "fill");
    const lengths = setting.map((each) =>
      this.#lengthOf(sizeOn(each.layer, axis), 0, () => this.#hugged(each.layer, each.path, axis))
    );
    if (this.#horizontal(layer, path) === (axis === "width")) {
      if (filling.length > 0) {
        throw new Error(
          `${path.join("/")} hugs its ${axis} around a layer that fills it, which no probe has sized`
        );
      }
      const gap = children.length > 1 ? this.#length(layer.itemSpacing) * (children.length - 1) : 0;
      return padding + lengths.reduce((sum, each) => sum + each, 0) + gap;
    }
    if (children.length > 0 && setting.length === 0) {
      throw new Error(`every layer of ${path.join("/")} fills its hugging ${axis}, which no probe has sized`);
    }
    return padding + Math.max(0, ...lengths);
  }

  /** The height of a text's one line: its line height in pixels, or that percent of its font size. */
  #lineHeight(text: TextLayerSpec): number {
    const { lineHeight } = text;
    return lineHeight.kind === "percent"
      ? (lineHeight.value / 100) * this.#length(text.fontSize)
      : this.#length(lineHeight);
  }

  /** Whether a frame lays out a row, false for a column. */
  #horizontal(frame: LaidOutFrame, path: readonly string[]): boolean {
    if (frame.direction !== "HORIZONTAL" && frame.direction !== "VERTICAL") {
      throw new Error(
        `a frame at ${path.join("/")} lays out as ${frame.direction}, which this test cannot place`
      );
    }
    return frame.direction === "HORIZONTAL";
  }

  /** A frame's children with their key paths, each in the auto layout, no icon, and with no limit. */
  #inFlow(frame: LaidOutFrame, path: readonly string[]) {
    const laidOut = frame.children.filter((layer) => layer.key !== PADDING_BOX_FILL || !outOfLayout(layer));
    return laidOut.map((layer) => {
      const at = [...path, layer.key];
      if (layer.kind === "icon" || outOfLayout(layer)) {
        throw new Error(
          `${at.join("/")} is an icon or sits outside the auto layout, which this test cannot place`
        );
      }
      unlimited(
        layer.kind === "frame"
          ? layer.limits
          : layer.kind === "text"
            ? { maxWidth: layer.maxWidth }
            : { minWidth: layer.minWidth },
        at
      );
      return { layer, path: at };
    });
  }

  /** The room a frame's padding and the strokes it lays out leave inside it, on each side. */
  #insets(frame: LaidOutFrame) {
    const { stroke } = frame;
    const side = (name: "top" | "right" | "bottom" | "left") =>
      stroke === undefined || stroke.inLayout === false
        ? 0
        : "sides" in stroke
          ? stroke.sides[name]
          : this.#length(stroke.weight);
    return {
      top: this.#length(frame.paddingTop) + side("top"),
      right: this.#length(frame.paddingRight) + side("right"),
      bottom: this.#length(frame.paddingBottom) + side("bottom"),
      left: this.#length(frame.paddingLeft) + side("left"),
    };
  }
}

/**
 * Throw where a layer sets a size limit. The layout does not clamp a length to a limit, and no probe
 * has shown how Figma shares a filling row's room among layers a limit stops, so a limit fails the
 * test rather than leave a layer at a length Figma would not give it.
 */
function unlimited(limits: Readonly<Record<string, NumberSpec | undefined>>, path: readonly string[]): void {
  const set = Object.entries(limits).flatMap(([name, value]) => (value === undefined ? [] : [name]));
  if (set.length > 0) {
    throw new Error(`${path.join("/")} sets ${set.join(", ")}, which this test cannot apply`);
  }
}

/** What the page measures in one mode at one frame size, each box from the host's top left. */
type Measured = {
  readonly mode: PageMode;
  readonly frame: Size;
  readonly scrim: Box;
  readonly panel: Box;
  readonly parts: Readonly<Record<string, Box>>;
  /** The width and lines of the characters of each part that holds a text, by the part's name. */
  readonly texts: Readonly<Record<string, Characters>>;
};

/**
 * What the page measures: the host as the capture lays it out, before the test touches its style,
 * then the scrim, the panel, the parts and their texts in every mode at every frame size.
 */
type Measurements = {
  readonly host: Size;
  readonly each: readonly Measured[];
};

/** Measure the host as laid out, then the scrim, the panel and the parts in every mode at every frame size. */
function measureEveryMode(page: Page, cell: string, overlay: Overlay): Promise<Measurements> {
  return page.evaluate(
    ({ modes, frames, host, scrimAt, panelAt, parts }) => {
      const element = (selector: string): HTMLElement => {
        const found = document.querySelector(selector);
        if (!(found instanceof HTMLElement)) {
          throw new Error(`the open overlay lacks ${selector}`);
        }
        return found;
      };
      const viewport = element(host);
      const laidOut = viewport.getBoundingClientRect();
      const scrim = element(scrimAt);
      const panel = element(panelAt);
      const elements = parts.map(([name, selector, text]) => [name, element(selector), text] as const);
      // A Range around the characters measures their run, where the element may stretch past it, and
      // its client rects start one line box per line.
      const characters = (found: HTMLElement): Characters => {
        const range = document.createRange();
        range.selectNodeContents(found);
        const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
        return { width: range.getBoundingClientRect().width, lines: tops.size };
      };
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
            mode,
            frame,
            scrim: from(scrim.getBoundingClientRect()),
            panel: from(panel.getBoundingClientRect()),
            parts: Object.fromEntries(
              elements.map(([name, found]) => [name, from(found.getBoundingClientRect())])
            ),
            texts: Object.fromEntries(
              elements.flatMap(([name, found, text]) => (text ? [[name, characters(found)]] : []))
            ),
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
      panelAt: cellSelector(cell, overlay.panelAt),
      parts: Object.entries(overlay.parts).map(
        ([name, part]) => [name, cellSelector(cell, part.at), part.text !== undefined] as const
      ),
    }
  );
}

/** Render the overlay's cell on the compare page and measure it in every mode. */
function measure(overlay: Overlay): Promise<Measurements> {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const [target] = captureTargets(new Set([overlay.set]));
        const renderers = yield* loadRenderers(new Set([overlay.set]));
        const renderer = renderers.get(overlay.set);
        if (target === undefined || renderer === undefined) {
          throw new Error(`the compare page renders no ${overlay.set}`);
        }
        const browser = yield* CompareBrowser.launch(
          yield* readPageAssets(yield* locateFuseBuild(), renderers)
        );
        const request = requestOf(target, renderer, overlay.cell, 0);
        return yield* browser.openPreview(CAPTURE_THEME, [request], PAGE_LAYOUT, (opened) =>
          measureEveryMode(opened.page, request.id, overlay)
        );
      })
    ).pipe(Effect.provide(NodeServices.layer))
  );
}

/** Each overlay's run, started once and shared by the tests that read it. */
const runs = new Map<string, Promise<Measurements>>();

function runOf(overlay: Overlay): Promise<Measurements> {
  const started = runs.get(overlay.set) ?? measure(overlay);
  runs.set(overlay.set, started);
  return started;
}

/** The open frame's one layer: the panel's instance, in the auto layout of a row or a column. */
function panelInstance(root: ComponentRootSpec): InstanceLayerSpec {
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
  return child;
}

/**
 * The panel's root as the open frame's instance shows it: with the root `primaryAlign` the instance
 * overrides. A paint, corner, shadow or text alignment override moves no layer. The layout cannot
 * apply an alignment below the root or a property that shows, hides or swaps a layer. Stroke weights,
 * padding and a label's face take room, which the layout cannot apply either. Each of these throws.
 */
function shownPanel(panel: ComponentRootSpec, instance: InstanceLayerSpec): ComponentRootSpec {
  if (instance.properties !== undefined) {
    throw new Error(
      `the open frame's instance sets ${JSON.stringify(instance.properties)}, which this test cannot apply`
    );
  }
  return (instance.overrides ?? []).reduce<ComponentRootSpec>((shown, override) => {
    switch (override.field) {
      case "primaryAlign":
        if (override.path.length > 0) {
          throw new Error(
            `the open frame's instance aligns ${override.path.join("/")}, which this test cannot apply`
          );
        }
        return { ...shown, primaryAlign: override.value };
      case "fill":
      case "strokeColor":
      case "textColor":
      case "glyph":
      case "textAlign":
      case "cornerRadius":
      case "effects":
        return shown;
      case "strokeSides":
      case "paddingTop":
      case "paddingRight":
      case "paddingBottom":
      case "paddingLeft":
      case "fontStyle":
        throw new Error(
          `the open frame's instance overrides ${JSON.stringify(override)}, which this test cannot apply`
        );
      default:
        override satisfies never;
        throw new Error(`the open frame's instance overrides ${JSON.stringify(override)}`);
    }
  }, panel);
}

/** The length of a fixed sizing, which the open frame's own sizing is. */
function fixedOf(size: SizeSpec): NumberSpec {
  if (size.kind !== "fixed") {
    throw new Error(`the open frame ${size.kind}s, where the scrim covers the viewport`);
  }
  return size.length;
}

/** A box rounded to the tolerance, for a readable diff. */
function rounded(box: Box): Box {
  const round = (value: number) => Math.round(value / TOLERANCE_PX) * TOLERANCE_PX;
  return { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) };
}

/** Whether two boxes sit within the tolerance of each other. */
function near(a: Box, b: Box): boolean {
  return (["x", "y", "width", "height"] as const).every(
    (field) => Math.abs(a[field] - b[field]) <= TOLERANCE_PX
  );
}

/** A mode as the diff names it. */
function nameOf(mode: PageMode): string {
  return `${JSON.stringify(mode.root)} ${JSON.stringify(mode.body)}`;
}

describe.each(OVERLAYS)("the open $set over its scrim", (overlay) => {
  it("draws the panel against the scrim's right edge and as tall as it, as Chromium lays it out in every mode", async () => {
    const [{ spec }, measured] = await Promise.all([builtKit(), runOf(overlay)]);
    const [declared] = FRAMES;
    // The capture lays the host out at the viewport the set declares, before any resize.
    expect(measured.host).toEqual(declared);
    expect(measured.each).toHaveLength(EVERY_MODE.length * FRAMES.length);
    const root = variantRoot(spec, overlay.variant);
    // The Backdrop's frame is the scrim, as large as the viewport the set declares.
    expect({
      width: fixedOf(root.sizing.horizontal),
      height: fixedOf(root.sizing.vertical),
    }).toEqual({
      width: { kind: "literal", value: declared.width },
      height: { kind: "literal", value: declared.height },
    });
    const instance = panelInstance(root);
    const differing = measured.each.flatMap((each) => {
      const figma = new FigmaLayout(lengthsIn(each.mode), (path) => {
        throw new Error(`the open frame hugs a text at ${path.join("/")}, where it holds the panel alone`);
      });
      figma.place(root, { x: 0, y: 0, ...each.frame }, [overlay.set]);
      const panel = figma.at([overlay.set, instance.key]);
      const scrim = { x: 0, y: 0, ...each.frame };
      return near(each.scrim, scrim) && near(each.panel, panel)
        ? []
        : [
            {
              mode: nameOf(each.mode),
              frame: each.frame,
              scrim: rounded(each.scrim),
              panel: rounded(each.panel),
              figma: rounded(panel),
            },
          ];
    });
    expect(differing).toEqual([]);
  });
});

describe("the open List detail's panel", () => {
  it("draws the detail where Chromium lays it out in every mode", async () => {
    const overlay = LIST_DETAIL_OPEN;
    const [{ spec }, measured] = await Promise.all([builtKit(), runOf(overlay)]);
    const instance = panelInstance(variantRoot(spec, overlay.variant));
    // The panel is the variant the open frame's instance shows, with the instance's overrides.
    const panel = shownPanel(variantRoot(spec, instance.variant), instance);
    const parts = Object.entries(overlay.parts);
    const differing = measured.each.flatMap((each) => {
      const text = (path: readonly string[]): number => {
        const joined = path.join("/");
        const found = parts.find(
          ([, part]) =>
            part.text !== undefined && joined === [instance.componentSet, ...part.path, part.text].join("/")
        );
        const size = found === undefined ? undefined : each.texts[found[0]];
        if (size === undefined) {
          throw new Error(`the test measures no characters for the text at ${joined}`);
        }
        if (size.lines !== 1) {
          throw new Error(
            `Chromium sets the text at ${joined} on ${String(size.lines)} lines, where it is one`
          );
        }
        return size.width;
      };
      const figma = new FigmaLayout(lengthsIn(each.mode), text);
      figma.place(variantRoot(spec, overlay.variant), { x: 0, y: 0, ...each.frame }, [overlay.set]);
      figma.place(panel, figma.at([overlay.set, instance.key]), [instance.componentSet]);
      const wrong = parts.flatMap(([name, part]) => {
        const chromium = each.parts[name];
        if (chromium === undefined) {
          throw new Error(`the page measured no ${name}`);
        }
        const drawn = figma.at([instance.componentSet, ...part.path]);
        return near(chromium, drawn)
          ? []
          : [{ part: name, chromium: rounded(chromium), figma: rounded(drawn) }];
      });
      return wrong.length === 0 ? [] : [{ mode: nameOf(each.mode), frame: each.frame, parts: wrong }];
    });
    expect(differing).toEqual([]);
  });
});
