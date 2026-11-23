import * as Effect from "effect/Effect";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Unit under test: the `showArrow=true` variant of `Popover content` as the kit builds it. That is the
 * arrow frame placed by its centre (`pivot`) beside the popup's clipping frame inside an unclipped
 * root, and the arrow's `::before` turned, sized, stroked and placed by its centre inside it. Oracle:
 * Chromium's layout of the real Fuse Popover opened with `showArrow` below its trigger, centred on it,
 * beside the same Popover without the arrow, under every pin of the modes the token sync writes,
 * each stamped as `test:compare` stamps it. The test reads the arrow's border box against the popup's
 * and the `::before`'s used size, offsets, computed transform matrix and border, and resolves the
 * built stroke's color in an in-memory file the token sync wrote, under the same pin. A pseudo-element has no node `getBoundingClientRect` measures, so the test maps
 * the `::before`'s untransformed centre through the matrix about its `transform-origin` (CSS
 * Transforms 1 §6). It goes red where the build leaves the arrow or its `::before` undrawn, places
 * either elsewhere, turns or sizes the `::before` otherwise, strokes it other than its border in
 * width or color, clips the arrow inside a frame that Chromium does not clip, or leaves the popup's
 * frame at its own width under a root that resizes. It goes red too where the popup's frame
 * draws other shadows than the popup without the arrow, which Chromium computes the same.
 */
import { fuseModule, openFusePage } from "../../test/fuse-page.ts";
import type { InMemoryFigma } from "../../test/in-memory-figma.ts";
import { colorIn, computedColor, named, sameColor, stampsOf, sweptFile } from "../../test/mode-sweep.ts";
import type { SweptMode } from "../../test/mode-sweep.ts";
import { placedBeside, specCentre } from "../../test/popup-place.ts";
import type { Box } from "../../test/popup-place.ts";
import { buildComponentSets } from "./build-kit.ts";
import type { BoxSpec, ChildLayerSpec, FrameLayerSpec, VariantSpec } from "./kit-spec.ts";
import {
  POPOVER_DESCRIPTION_TEXT,
  POPOVER_FIELD_LABELS,
  POPOVER_TITLE_TEXT,
  POPOVER_TRIGGER_TEXT,
} from "./popover-text.ts";

/** How far apart, in CSS pixels, a spec's length and Chromium's may sit: a few 64ths of a pixel. */
const TOLERANCE_PX = 0.05;

/** How far apart, in degrees, the spec's turn and Chromium's may sit. */
const TURN_TOLERANCE = 1e-3;

/** How far apart a synced color's channels and Chromium's may sit, each from 0 to 1: half of 1/255. */
const CHANNEL_TOLERANCE = 0.5 / 255;

/** `Popover.Content`'s `sideOffset`, Fuse's default, which the page leaves unset. */
const POPOVER_SIDE_OFFSET = 4;

/**
 * The page's script: the docs Basic demo's Popover twice, with and without `showArrow`, each opened
 * centred below its outline Button trigger, in a host as wide as the popup, its popup portalled into
 * its slot. A `mount-popovers` event on the window mounts them afresh, so Base UI places each popup
 * and its arrow once against its trigger under the pin the page stamps.
 */
const ENTRY = `
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Button } from ${fuseModule("button.js")};
import { Field } from ${fuseModule("field.js")};
import { Input } from ${fuseModule("input.js")};
import { Popover } from ${fuseModule("popover.js")};
const labels = ${JSON.stringify(POPOVER_FIELD_LABELS)};
const roots = [false, true].map((arrow) => {
  const slot = document.createElement("div");
  slot.dataset.arrow = String(arrow);
  slot.style.cssText = "position:relative;width:480px;height:480px;padding:40px;box-sizing:border-box";
  document.body.append(slot);
  return { slot, arrow, root: undefined };
});
const mount = () => {
  for (const each of roots) {
    each.root?.unmount();
    each.root = createRoot(each.slot);
    flushSync(() => each.root.render(
      createElement("div", { className: "flex w-72 justify-center" },
        createElement(Popover.Root, { defaultOpen: true },
          createElement(Popover.Trigger, { render: createElement(Button, { variant: "outline" }) }, ${JSON.stringify(POPOVER_TRIGGER_TEXT)}),
          createElement(Popover.Content, { container: each.slot, align: "center", showArrow: each.arrow },
            createElement(Popover.Header, null,
              createElement(Popover.Title, null, ${JSON.stringify(POPOVER_TITLE_TEXT)}),
              createElement(Popover.Description, null, ${JSON.stringify(POPOVER_DESCRIPTION_TEXT)})),
            ...labels.map((label) => createElement(Field.Root, { key: label },
              createElement(Field.Label, null, label),
              createElement(Input, { defaultValue: "" }))))))));
  }
};
mount();
window.addEventListener("mount-popovers", mount);
`;

/** The `::before` as Chromium lays it out in the arrow, read from its computed style. */
type MeasuredBefore = {
  readonly width: number;
  readonly height: number;
  /** Its centre from the arrow's top left corner, after its transform. */
  readonly x: number;
  readonly y: number;
  /** Its turn in degrees, clockwise as CSS counts it, and the scale its matrix keeps. */
  readonly turn: number;
  readonly scale: number;
  readonly boxSizing: string;
  /** Each border side's style, width and color, top, right, bottom and left. */
  readonly borders: readonly (readonly [style: string, width: string, color: string])[];
  readonly background: string;
};

/** What the page measures of one open Popover under the pin it stamps. */
type Shown = {
  readonly arrow: boolean;
  readonly placedSide: string;
  readonly placedAlign: string;
  readonly popup: Box;
  readonly trigger: Box;
  readonly clientWidth: number;
  readonly popupOverflow: string;
  readonly popupShadow: string;
  readonly popupBackground: string;
  /** The arrow's border box, the frame Figma clips it to, and its `overflow`; undefined without one. */
  readonly arrowBox: Box | undefined;
  readonly arrowOverflow: string | undefined;
  readonly before: MeasuredBefore | undefined;
};

/** One open Popover as measured under one pin. */
type Measured = Shown & { readonly mode: SweptMode };

/** What one frame shows of one open Popover: its measures, and whether its entrance has ended. */
type Frame = Shown & { readonly entered: boolean };

/** Read every open Popover on the page's next animation frame. */
async function readFrame(page: Page): Promise<readonly Frame[]> {
  return page.evaluate(
    () =>
      new Promise<Frame[]>((resolve, reject) => {
        requestAnimationFrame(() => {
          const boxOf = (element: Element) => {
            const { left, top, width, height } = element.getBoundingClientRect();
            return { left, top, width, height };
          };
          const pixels = (value: string) => Number.parseFloat(value);
          const readings: Frame[] = [];
          for (const slot of document.querySelectorAll<HTMLElement>("[data-arrow]")) {
            const popup = slot.querySelector<HTMLElement>('[data-slot="popover-content"]');
            const trigger = slot.querySelector("button");
            if (popup === null || trigger === null) {
              reject(new Error("a slot lacks its popup or its trigger"));
              return;
            }
            const arrow = popup.querySelector(':scope > [aria-hidden="true"]');
            const style = getComputedStyle(popup);
            let before: MeasuredBefore | undefined;
            if (arrow !== null) {
              const own = getComputedStyle(arrow, "::before");
              const width = pixels(own.width);
              const height = pixels(own.height);
              const left = pixels(own.left);
              const top = pixels(own.top);
              const [originX = 0, originY = 0] = own.transformOrigin.split(" ").map(pixels);
              const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = (
                /^matrix\((.*)\)$/.exec(own.transform)?.[1] ?? "1, 0, 0, 1, 0, 0"
              )
                .split(",")
                .map(Number);
              // A point p moves to origin + M (p - origin) + (e, f), with the origin in the box.
              const dx = width / 2 - originX;
              const dy = height / 2 - originY;
              before = {
                width,
                height,
                x: left + originX + a * dx + c * dy + e,
                y: top + originY + b * dx + d * dy + f,
                turn: (Math.atan2(b, a) * 180) / Math.PI,
                scale: Math.hypot(a, b),
                boxSizing: own.boxSizing,
                borders: ["top", "right", "bottom", "left"].map(
                  (side) =>
                    [
                      own.getPropertyValue(`border-${side}-style`),
                      own.getPropertyValue(`border-${side}-width`),
                      own.getPropertyValue(`border-${side}-color`),
                    ] as const
                ),
                background: own.backgroundColor,
              };
            }
            readings.push({
              arrow: slot.dataset.arrow === "true",
              placedSide: popup.dataset.side ?? "",
              placedAlign: popup.dataset.align ?? "",
              popup: boxOf(popup),
              trigger: boxOf(trigger),
              clientWidth: popup.clientWidth,
              popupOverflow: style.overflow,
              popupShadow: style.boxShadow,
              popupBackground: style.backgroundColor,
              arrowBox: arrow === null ? undefined : boxOf(arrow),
              arrowOverflow: arrow === null ? undefined : getComputedStyle(arrow).overflow,
              before,
              entered:
                !popup.hasAttribute("data-starting-style") &&
                popup.getAnimations({ subtree: true }).length === 0,
            });
          }
          resolve(readings);
        });
      })
  );
}

/**
 * Whether a Popover is ready to measure: its entrance has ended, and Base UI has opened its popup
 * below its trigger, `POPOVER_SIDE_OFFSET` from it and centred on it ({@link placedBeside}). The pass
 * that places the popup also writes the arrow's offset, so the arrow's place is left for the tests.
 */
function isReady(reading: Frame): boolean {
  return (
    reading.entered &&
    reading.placedSide === "bottom" &&
    placedBeside("bottom", reading.popup, reading.trigger, POPOVER_SIDE_OFFSET)
  );
}

/**
 * Measure both Popovers under each pin. Under each, once its stamps and fonts apply, the page mounts
 * both afresh, and the test reads them on each frame until {@link isReady} holds for each. The wait
 * sets no timeout of its own, so a popup that never settles leaves only the hang guard to end the
 * test.
 */
async function measureEveryPin(page: Page, modes: readonly SweptMode[]): Promise<readonly Measured[]> {
  const out: Measured[] = [];
  for (const mode of modes) {
    await page.evaluate(async (each) => {
      for (const [name, value] of Object.entries(each.root)) {
        document.documentElement.setAttribute(name, value);
      }
      for (const [name, value] of Object.entries(each.body)) {
        document.body.setAttribute(name, value);
      }
      const popups = [...document.querySelectorAll('[data-slot="popover-content"]')];
      await Promise.all(popups.map((popup) => document.fonts.load(getComputedStyle(popup).font)));
      await document.fonts.ready;
      window.dispatchEvent(new Event("mount-popovers"));
    }, stampsOf(mode));
    let readings = await readFrame(page);
    while (!readings.every(isReady)) {
      readings = await readFrame(page);
    }
    out.push(...readings.map(({ entered: _entered, ...reading }) => ({ ...reading, mode })));
  }
  return out;
}

/** The boxes from `box` down to the layer keyed `key`, the layer last, or undefined where none is. */
function pathTo(box: BoxSpec, key: string): readonly (BoxSpec | ChildLayerSpec)[] | undefined {
  for (const child of box.children) {
    if (child.key === key) {
      return [box, child];
    }
    if (child.kind === "frame") {
      const below = pathTo(child, key);
      if (below !== undefined) {
        return [box, ...below];
      }
    }
  }
  return undefined;
}

/** A frame's literal length on one axis, or undefined where it sets none. */
function literal(layer: FrameLayerSpec, axis: "horizontal" | "vertical"): number | undefined {
  const size = layer.sizing[axis];
  return size.kind === "fixed" && size.length.kind === "literal" ? size.length.value : undefined;
}

/** A frame layer, or a failure naming what the variant lacks. */
function frameOf(layer: BoxSpec | ChildLayerSpec | undefined, what: string): FrameLayerSpec {
  if (layer === undefined || !("kind" in layer) || layer.kind !== "frame") {
    throw new Error(`the arrow variant draws no ${what} frame`);
  }
  return layer;
}

let browser: Browser;
let figma: InMemoryFigma;
let pins: readonly SweptMode[];
let measured: readonly Measured[];
let plain: VariantSpec;
let withArrow: VariantSpec;

beforeAll(async () => {
  browser = await chromium.launch();
  const sets = await Effect.runPromise(buildComponentSets());
  const content = sets.find((each) => each.componentSet.key === "popover-content")?.componentSet;
  const variantWith = (arrow: string) => {
    const variant = content?.variants.find((each) => (each.properties.showArrow ?? "false") === arrow);
    if (variant === undefined) {
      throw new Error(`the build holds no popover-content variant with showArrow=${arrow}`);
    }
    return variant;
  };
  plain = variantWith("false");
  withArrow = variantWith("true");
  ({ figma, modes: pins } = await sweptFile());
  const page = await browser.newPage({ viewport: { width: 480, height: 1000 } });
  await openFusePage(page, { entry: ENTRY });
  measured = await measureEveryPin(page, pins);
});

afterAll(async () => {
  await browser.close();
});

describe("Popover content's arrow, as the kit builds it", () => {
  it("measures both Popovers under every pin, each open below its trigger and centred on it", () => {
    expect(measured).toHaveLength(2 * pins.length);
    expect(new Set(measured.map((reading) => `${reading.placedSide} ${reading.placedAlign}`))).toEqual(
      new Set(["bottom center"])
    );
    expect(measured.filter((reading) => reading.arrow).every((reading) => reading.before !== undefined)).toBe(
      true
    );
  });

  // Chromium paints the arrow wholly above the popup's top edge, and nothing between them clips it.
  it("leaves the arrow unclipped by every frame around it, as Chromium paints it past the popup", () => {
    for (const reading of measured.filter((each) => each.arrow)) {
      expect(reading.popupOverflow).toBe("visible");
      const box = reading.arrowBox;
      expect((box?.top ?? Infinity) + (box?.height ?? Infinity)).toBeLessThanOrEqual(
        reading.popup.top + TOLERANCE_PX
      );
    }
    const path = pathTo(withArrow.root, "arrow") ?? [];
    expect(path.length).toBeGreaterThan(1);
    const around = path.slice(0, -1).map((box) => ("clips" in box ? box.clips : undefined));
    expect(around).toEqual(around.map(() => false));
  });

  // The arrow's parent must stand for the popup's border box, which Chromium offsets the arrow from,
  // at any width: a root as wide as the popup without the arrow, with no padding, hugging down
  // around the popup's frame, which draws the popup alone and fills the root across, so the two
  // resize together.
  it("hangs the arrow from a root as wide as the popup, which the popup's frame fills", () => {
    const path = pathTo(withArrow.root, "arrow") ?? [];
    expect(path).toHaveLength(2);
    const { root } = withArrow;
    expect(root.sizing).toEqual({ horizontal: plain.root.sizing.horizontal, vertical: { kind: "hug" } });
    expect(root.limits).toEqual(plain.root.limits);
    for (const side of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const) {
      expect(root[side]).toEqual({ kind: "literal", value: 0 });
    }
    const inFlow = root.children.filter((layer) => layer.kind !== "frame" || layer.placement === undefined);
    expect(inFlow).toHaveLength(1);
    const popup = frameOf(inFlow[0], "popup");
    expect(popup.sizing).toEqual({ horizontal: { kind: "fill" }, vertical: plain.root.sizing.vertical });
  });

  it("puts the arrow's centre and size where Chromium does under every pin", () => {
    const arrow = frameOf(pathTo(withArrow.root, "arrow")?.at(-1), "arrow");
    const pivot = arrow.placement;
    if (pivot?.kind !== "pivot") {
      throw new Error("the arrow is not placed by its centre");
    }
    expect(arrow.rotation ?? 0).toBe(0);
    const off = measured.flatMap((reading) => {
      const box = reading.arrowBox;
      if (!reading.arrow || box === undefined) {
        return [];
      }
      const expected = specCentre(pivot, reading.popup.width, reading.popup.height);
      const observed = {
        x: box.left + box.width / 2 - reading.popup.left,
        y: box.top + box.height / 2 - reading.popup.top,
      };
      // Base UI writes the arrow's `left` from the popup's `clientWidth`, which CSSOM rounds.
      const rounding = Math.abs(reading.clientWidth - reading.popup.width) / 2;
      return Math.abs(expected.x - observed.x) > rounding + TOLERANCE_PX ||
        Math.abs(expected.y - observed.y) > TOLERANCE_PX ||
        Math.abs((literal(arrow, "horizontal") ?? 0) - box.width) > TOLERANCE_PX ||
        Math.abs((literal(arrow, "vertical") ?? 0) - box.height) > TOLERANCE_PX
        ? [{ pin: named(reading.mode), expected, observed, box }]
        : [];
    });
    expect(off).toEqual([]);
    expect(new Set(measured.flatMap((reading) => reading.arrowOverflow ?? []))).toEqual(new Set(["clip"]));
    expect(arrow.clips).toBe(true);
  });

  it("turns, sizes and places the arrow's ::before where Chromium does under every pin", () => {
    const arrow = frameOf(pathTo(withArrow.root, "arrow")?.at(-1), "arrow");
    const before = frameOf(
      arrow.children.find((layer) => layer.key === "::before"),
      "::before"
    );
    const pivot = before.placement;
    if (pivot?.kind !== "pivot") {
      throw new Error("the ::before is not placed by its centre");
    }
    const width = literal(arrow, "horizontal") ?? 0;
    const height = literal(arrow, "vertical") ?? 0;
    const expected = specCentre(pivot, width, height);
    const off = measured.flatMap((reading) => {
      const own = reading.before;
      if (!reading.arrow || own === undefined) {
        return [];
      }
      // Figma counts a turn counterclockwise, CSS clockwise.
      return Math.abs(expected.x - own.x) > TOLERANCE_PX ||
        Math.abs(expected.y - own.y) > TOLERANCE_PX ||
        Math.abs((literal(before, "horizontal") ?? 0) - own.width) > TOLERANCE_PX ||
        Math.abs((literal(before, "vertical") ?? 0) - own.height) > TOLERANCE_PX ||
        Math.abs((before.rotation ?? 0) + own.turn) > TURN_TOLERANCE ||
        Math.abs(own.scale - 1) > TURN_TOLERANCE
        ? [{ pin: named(reading.mode), expected, own, rotation: before.rotation }]
        : [];
    });
    expect(off).toEqual([]);
  });

  // A border on a `border-box` square lies inside the box and turns with it, as an INSIDE stroke
  // lies inside its frame and turns with it, the only alignment the plugin writes.
  it("strokes the ::before by its border's width and color, and fills it with the popup's fill", () => {
    const arrow = frameOf(pathTo(withArrow.root, "arrow")?.at(-1), "arrow");
    const before = frameOf(
      arrow.children.find((layer) => layer.key === "::before"),
      "::before"
    );
    const readings = measured.flatMap((reading) => (reading.before === undefined ? [] : [reading]));
    expect(new Set(readings.map((reading) => reading.before?.boxSizing))).toEqual(new Set(["border-box"]));
    const widths = new Set(
      readings.flatMap((reading) =>
        (reading.before?.borders ?? []).map(([style, width]) => (style === "none" ? "0px" : width))
      )
    );
    expect(widths.size).toBe(1);
    const [border = ""] = widths;
    // One weight on every side, or a weight per side, each as wide as Chromium's border.
    const stroke = before.stroke;
    const weights =
      stroke === undefined
        ? []
        : "weight" in stroke
          ? [stroke.weight.kind === "literal" ? stroke.weight.value : undefined]
          : Object.values(stroke.sides);
    expect(new Set(weights)).toEqual(new Set([Number.parseFloat(border)]));
    // Each drawn side's color as Chromium computed it, beside the stroke's in the synced file.
    const color = before.stroke?.color;
    if (color === undefined) {
      throw new Error("the ::before draws no stroke");
    }
    const apart = readings.flatMap((reading) => {
      const pin = reading.mode;
      const synced = colorIn(figma, color, pin);
      return (reading.before?.borders ?? []).flatMap(([style, , side]) =>
        style === "none" || sameColor(synced, computedColor(side), CHANNEL_TOLERANCE)
          ? []
          : [`${named(pin)}: synced ${JSON.stringify(synced)}, Chromium ${side}`]
      );
    });
    expect(apart).toEqual([]);
    for (const reading of readings) {
      expect(reading.before?.background).toBe(reading.popupBackground);
    }
    const popup = frameOf(
      withArrow.root.children.find((layer) => layer.kind === "frame" && layer.placement === undefined),
      "popup"
    );
    expect(before.fill).toEqual(popup.fill);
  });

  // Chromium computes the popup's shadow and ring the same with and without the arrow, so the arrow
  // variant's popup frame draws the plain variant's root shadows and clips for their spreads.
  it("keeps the popup's shadows and clip on its frame", () => {
    for (const mode of new Set(measured.map((reading) => reading.mode))) {
      const shadows = new Set(
        measured.filter((reading) => reading.mode === mode).map((reading) => reading.popupShadow)
      );
      expect(shadows.size).toBe(1);
    }
    const popup = frameOf(
      withArrow.root.children.find((layer) => layer.kind === "frame" && layer.placement === undefined),
      "popup"
    );
    expect(popup.shadows).toEqual(plain.root.shadows);
    expect(popup.clips).toBe(plain.root.clips);
    expect(withArrow.root.shadows).toEqual([]);
    // CSS paints a positioned descendant over its ancestor's background and shadow (CSS 2.1
    // Appendix E), so the arrow follows the popup's frame in Figma's order, its paint order.
    const keys = withArrow.root.children.map((layer) => layer.key);
    expect(keys.indexOf("arrow")).toBeGreaterThan(keys.indexOf(popup.key));
  });
});
