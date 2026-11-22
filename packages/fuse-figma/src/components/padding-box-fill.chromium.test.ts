/**
 * Unit under test: the fill of each set whose box clips its background at the border's inner edge
 * (`background-clip: padding-box`), as the kit builds it and an in-memory Figma file that the token
 * sync wrote resolves it under every combination of the file's modes. The boxes are the roots of
 * Calendar, Range calendar, Sheet content, List detail sheet and Frame, and Frame's first panel, each
 * stroked with `--border`, which the neutral dark theme makes translucent.
 * The pins come from `sweptFile` in `test/mode-sweep.ts`, which stops unless they are one per
 * combination of the theme catalog's modes, so a mode the sync leaves out fails the suite.
 * Oracle: Chromium painting the real Fuse component on Fuse's built CSS over an opaque page color,
 * with the page stamped as `test:compare` stamps the same modes, and CSS Backgrounds 3 §5.2 for the
 * corner inside the border: the outer radius less the border width, at least 0.
 *
 * Two checks per set and pin, and one per set:
 *
 * - The pixel at the middle of the left border, where CSS shows what lies behind the box through the
 *   border, the pixel just inside it, where it shows the fill, and the pixel at the middle of the
 *   bottom border, where a Frame panel's highlight paints its line over the border. The spec's pixel
 *   composites, over what lies behind and as `@elmeragroup/color` composites, the box's fill, then
 *   each layer that covers the box edge to edge in Figma's paint order, its unblurred shadows outside
 *   it, its fill and its inside stroke, and last the box's stroke, as Figma paints a frame's fill under
 *   its layers and its inside stroke over them (probe FR4). Behind a root lies the page color, and
 *   behind a Frame panel the spec's pixel just inside the Frame's root.
 * - The box rounds by Chromium's radius, and the box that holds the spec's fill sits inside it by
 *   Chromium's border widths and rounds by the inner radius.
 * - That box is the box's bottom layer, under the content CSS paints over the background, by the
 *   Figma plugin typings' child order: the first child paints at the bottom, or the last in a frame
 *   that paints its first child on top.
 */
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as Srgb from "@elmeragroup/color/srgb";

import { builtKit, variantRoot } from "../../test/built-kit.ts";
import type { BuiltSets } from "../../test/built-kit.ts";
import { buildCaptured, chip, rest } from "../../test/capture-fixtures.ts";
import { fuseModule, openFusePage } from "../../test/fuse-page.ts";
import type { InMemoryFigma } from "../../test/in-memory-figma.ts";
import { colorIn, named, pixelsIn, sweptFile } from "../../test/mode-sweep.ts";
import type { SweptMode } from "../../test/mode-sweep.ts";
import { frame } from "../compare/frame-cell.ts";
import { themeStamps } from "../compare/preview-theme.ts";
import type { ThemeStamps } from "../compare/preview-theme.ts";
import type { Rgba } from "../variable-set.ts";
import { cornerLengths } from "./corner-spec.ts";
import type { BoxSpec, ColorSpec, FrameLayerSpec, NumberSpec } from "./kit-spec.ts";
import { SHEET_VIEWPORT } from "./sheet-text.ts";

/** The opaque color behind every component, in 8-bit channels. */
const PAGE = { r: 255, g: 0, b: 255 } as const;

/** How far apart a channel of the spec's pixel and Chromium's may lie, for color conversion. */
const CHANNEL_TOLERANCE = 2;

/**
 * Each box: the variant that draws it and the keys of the layers down to it, none for the root, the
 * slot the page draws its component in, with the slot's top left corner in CSS pixels, the `data-slot`
 * of the box's first element on the page, and the box it sits in, whose pixel just inside its border
 * lies behind it, or none for a root over the page.
 */
const SETS = [
  {
    key: "sheet-content/side=right",
    path: [],
    slot: "sheet",
    slotLeft: 0,
    slotTop: 0,
    part: "sheet-content",
    within: undefined,
  },
  {
    key: "calendar/state=rest",
    path: [],
    slot: "calendar",
    slotLeft: 680,
    slotTop: 0,
    part: "calendar",
    within: undefined,
  },
  {
    key: "range-calendar/state=rest",
    path: [],
    slot: "range-calendar",
    slotLeft: 680,
    slotTop: 420,
    part: "range-calendar",
    within: undefined,
  },
  {
    key: "frame/layout=gutter",
    path: [],
    slot: "frame",
    slotLeft: 0,
    slotTop: 940,
    part: "frame",
    within: undefined,
  },
  {
    key: "frame/layout=gutter",
    path: ["panel-1"],
    slot: "frame",
    slotLeft: 0,
    slotTop: 940,
    part: "frame-panel",
    within: 3,
  },
  {
    key: "list-detail-sheet/content=value",
    path: [],
    slot: "list-detail-sheet",
    slotLeft: 0,
    slotTop: 460,
    part: "list-detail-detail",
    within: undefined,
  },
] as const;

/**
 * The page's script: the open Sheet portalled into a host as large as its viewport, a Calendar, a
 * RangeCalendar, the `frame` compare cell's markup, and List detail's overlay layout, its detail open
 * in a Sheet portalled into a second such host, each in a slot over the page color. `split: "never"`
 * picks the Sheet, and the detail passes `showCloseButton={false}`, as the List detail sheet capture
 * does. The scrims are hidden, so the page shows behind each panel. The components' own shadows are
 * off: CSS clips an outer shadow at the border box (CSS Backgrounds 3 §7.1.1), and Chromium still
 * bleeds it under a 1px border, so it would tint the pixel this test reads for the fill. A
 * pseudo-element keeps its shadow, as a Frame panel's highlight does.
 */
const ENTRY = `
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Calendar } from ${fuseModule("calendar.js")};
import { RangeCalendar } from ${fuseModule("range-calendar.js")};
import { Sheet } from ${fuseModule("sheet.js")};
import { ListDetail } from ${fuseModule("list-detail.js")};
import { LocaleProvider } from ${fuseModule("theme.js")};
const sets = ${JSON.stringify(SETS)};
const page = "rgb(${String(PAGE.r)}, ${String(PAGE.g)}, ${String(PAGE.b)})";
const slots = new Map();
for (const set of sets) {
  if (slots.has(set.slot)) {
    continue;
  }
  const slot = document.createElement("div");
  slot.dataset.slotFor = set.slot;
  slot.style.cssText = "position:absolute;left:" + set.slotLeft + "px;top:" + set.slotTop + "px;background:" + page;
  document.body.append(slot);
  slots.set(set.slot, slot);
}
const viewportHost = (slot) => {
  const host = document.createElement("div");
  host.style.cssText = "position:relative;width:${String(SHEET_VIEWPORT.width)}px;height:${String(SHEET_VIEWPORT.height)}px;contain:layout";
  slots.get(slot).append(host);
  return host;
};
const host = viewportHost("sheet");
const detailHost = viewportHost("list-detail-sheet");
const style = document.createElement("style");
style.textContent = '[data-slot="sheet-overlay"]{display:none!important}[data-slot]{box-shadow:none!important}';
document.head.append(style);
const month = (Root) => [
  createElement(Root.Header, { key: "header" },
    createElement(Root.DecrementMonth), createElement(Root.VisibleRangeHeading), createElement(Root.IncrementMonth)),
  createElement(Root.Months, { key: "months" }),
];
flushSync(() => {
  createRoot(slots.get("calendar")).render(createElement(LocaleProvider, { locale: "en-US" },
    createElement(Calendar.Root, { "aria-label": "Delivery date" }, ...month(Calendar))));
  createRoot(slots.get("range-calendar")).render(createElement(LocaleProvider, { locale: "en-US" },
    createElement(RangeCalendar.Root, { "aria-label": "Stay" }, ...month(RangeCalendar))));
  createRoot(document.createElement("div")).render(createElement(LocaleProvider, { locale: "en-US" },
    createElement(Sheet.Root, { defaultOpen: true },
      createElement(Sheet.Content, { container: host, showCloseButton: false },
        createElement(Sheet.Header, null, createElement(Sheet.Title, null, "Terms"))))));
  // The root reads its layout from a probe's computed style, which only an attached element has.
  const detailRoot = document.createElement("div");
  detailRoot.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;overflow:hidden";
  document.body.append(detailRoot);
  createRoot(detailRoot).render(createElement(LocaleProvider, { locale: "en-US" },
    createElement(ListDetail.Root, { open: true, onOpenChange: () => undefined, split: "never" },
      createElement(ListDetail.Detail, { "aria-label": "Customer details", showCloseButton: false, container: detailHost },
        createElement(ListDetail.Title, null, "Henrik Aasen")))));
});
slots.get("frame").innerHTML = ${JSON.stringify(renderToStaticMarkup(frame.element({ layout: "gutter" }, new Set())))};
`;

/** An 8-bit color with no alpha. */
type Pixel = { readonly r: number; readonly g: number; readonly b: number };

/** What Chromium shows of one set's component under one pin. */
type Measured = {
  /**
   * The pixel at the middle of the left border, the one just inside the border, and the one at the
   * middle of the bottom border, where a Frame panel's highlight draws its line.
   */
  readonly border: Pixel;
  readonly inside: Pixel;
  readonly bottom: Pixel;
  /** The computed border widths and the top left corner's computed radius, in CSS pixels. */
  readonly widths: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
  readonly radius: number;
};

/** Where to sample one component, read once its layout settles under a pin. */
type Sampling = {
  readonly x: number;
  readonly y: number;
  readonly insideX: number;
  readonly bottomX: number;
  readonly bottomY: number;
  readonly widths: Measured["widths"];
  readonly radius: number;
};

/** Stamp one pin and read where each set's component sits and what its border computes to. */
function stampAndLocate(page: Page, stamps: ThemeStamps): Promise<readonly Sampling[]> {
  return page.evaluate(
    async ({ pin, parts }) => {
      for (const [name, value] of Object.entries(pin.root)) {
        document.documentElement.setAttribute(name, value);
      }
      for (const [name, value] of Object.entries(pin.body)) {
        document.body.setAttribute(name, value);
      }
      // The open Sheet takes focus, and Chromium rings a focused element over its border.
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return parts.map((part) => {
        const element = document.querySelector(`[data-slot="${part}"]`);
        if (element === null) {
          throw new Error(`the page holds no ${part}`);
        }
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const widths = {
          top: Number.parseFloat(style.borderTopWidth),
          right: Number.parseFloat(style.borderRightWidth),
          bottom: Number.parseFloat(style.borderBottomWidth),
          left: Number.parseFloat(style.borderLeftWidth),
        };
        return {
          x: Math.floor(box.left),
          y: Math.floor(box.top + box.height / 2),
          insideX: Math.floor(box.left + widths.left + 1),
          bottomX: Math.floor(box.left + box.width / 2),
          bottomY: Math.ceil(box.bottom) - 1,
          widths,
          radius: Number.parseFloat(style.borderTopLeftRadius),
        };
      });
    },
    { pin: stamps, parts: SETS.map((set) => set.part) }
  );
}

/** Read every set's samples under every pin, from one screenshot per pin. */
async function measurePins(
  page: Page,
  stamps: readonly ThemeStamps[]
): Promise<readonly (readonly Measured[])[]> {
  const out: (readonly Measured[])[] = [];
  for (const pin of stamps) {
    const samplings = await stampAndLocate(page, pin);
    const shot = PNG.sync.read(await page.screenshot({ animations: "disabled" }));
    const at = (x: number, y: number): Pixel => {
      const index = (y * shot.width + x) * 4;
      return { r: shot.data[index] ?? -1, g: shot.data[index + 1] ?? -1, b: shot.data[index + 2] ?? -1 };
    };
    out.push(
      samplings.map((sampling) => ({
        border: at(sampling.x, sampling.y),
        inside: at(sampling.insideX, sampling.y),
        bottom: at(sampling.bottomX, sampling.bottomY),
        widths: sampling.widths,
        radius: sampling.radius,
      }))
    );
  }
  return out;
}

/**
 * Two sharp shadows 4px down that overlap below a 20px box, as CSS lists them, first on top: red at
 * half alpha over blue at half alpha, inline for Chromium and as the class the kit builds from. The
 * box sits over the page color.
 */
const STACKED_SHADOWS = {
  css: "0 4px 0 0 rgb(255 0 0 / 0.5), 0 4px 0 0 rgb(0 0 255 / 0.5)",
  className: "shadow-[0_4px_0_0_rgb(255_0_0/0.5),0_4px_0_0_rgb(0_0_255/0.5)]",
  offsetY: 4,
} as const;

let browser: Browser | undefined;
let kit: BuiltSets;
let figma: InMemoryFigma;
let modes: readonly SweptMode[];
let measured: readonly (readonly Measured[])[];
/** Chromium's pixel in the second row below the box that casts {@link STACKED_SHADOWS}, where both paint. */
let stackedShadowPixel: Pixel;

beforeAll(async () => {
  const [built, file] = await Promise.all([builtKit(), sweptFile()]);
  kit = built;
  ({ figma, modes } = file);
  const stamps = modes.map((mode) => themeStamps(mode.theme));
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 1440 }, deviceScaleFactor: 1 });
  await openFusePage(page, { entry: ENTRY });
  measured = await measurePins(page, stamps);
  const shadowPage = await browser.newPage({ viewport: { width: 60, height: 60 }, deviceScaleFactor: 1 });
  await shadowPage.setContent(
    `<body style="margin:0;background:rgb(${String(PAGE.r)}, ${String(PAGE.g)}, ${String(PAGE.b)})"><div style="position:absolute;left:20px;top:20px;width:20px;height:20px;box-shadow:${STACKED_SHADOWS.css}"></div></body>`
  );
  const shot = PNG.sync.read(await shadowPage.screenshot());
  const index = (41 * shot.width + 30) * 4;
  stackedShadowPixel = {
    r: shot.data[index] ?? -1,
    g: shot.data[index + 1] ?? -1,
    b: shot.data[index + 2] ?? -1,
  };
});

afterAll(async () => {
  await browser?.close();
});

/** A FLOAT field as the file resolves it under a pin. */
const length = (spec: NumberSpec, mode: SweptMode): number => pixelsIn(figma, spec, mode);

/** A COLOR field as the file resolves it under a pin. */
const color = (spec: ColorSpec, mode: SweptMode): Rgba => colorIn(figma, spec, mode);

/** An sRGB color from 0..1 channels and alpha. A value outside that range fails the test. */
function srgb({ r, g, b, a }: Rgba): Srgb.Srgb {
  const made = Srgb.make({ r, g, b, alpha: a });
  if (made._tag !== "ok") {
    throw new Error(`the file holds a color outside sRGB: ${JSON.stringify({ r, g, b, a })}`);
  }
  return made.value;
}

/** An 8-bit pixel as an opaque sRGB color. */
const fromPixel = (pixel: Pixel): Srgb.Srgb =>
  srgb({ r: pixel.r / 255, g: pixel.g / 255, b: pixel.b / 255, a: 1 });

/** A color over an 8-bit pixel, composited as CSS does, in 8-bit channels. */
function over(base: Pixel, paint: ReturnType<typeof color>): Pixel {
  const shown = Srgb.compositeOver(srgb(paint), fromPixel(base));
  return { r: shown.r * 255, g: shown.g * 255, b: shown.b * 255 };
}

/** The root's layers that cover it from edge to edge, inset by fixed lengths, as a fill's box does. */
function coveringLayers(root: BoxSpec): readonly FrameLayerSpec[] {
  return root.children.flatMap((child) =>
    child.kind === "frame" &&
    child.placement?.kind === "edges" &&
    child.placement.horizontal.kind === "stretch" &&
    child.placement.vertical.kind === "stretch"
      ? [child]
      : []
  );
}

/** The insets of a covering layer from the root's edges, 0 for the root itself. */
function insetsOf(layer: FrameLayerSpec | undefined): Measured["widths"] {
  const placement = layer?.placement;
  if (
    placement?.kind !== "edges" ||
    placement.horizontal.kind !== "stretch" ||
    placement.vertical.kind !== "stretch"
  ) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  return {
    top: placement.vertical.start,
    right: placement.horizontal.end,
    bottom: placement.vertical.end,
    left: placement.horizontal.start,
  };
}

/** A point the suite samples: `depth` pixels in from the left edge at mid-height, or up from the bottom at mid-width. */
type Sample = { readonly side: "left" | "bottom"; readonly depth: number };

/** A box's paint at a sample, as one frame paints it: its shadows outside it, its fill, and its stroke's band. */
function paintAt(box: BoxSpec, mode: SweptMode, at: Sample, inset: number, pixel: Pixel): Pixel {
  let shown = pixel;
  // A drop shadow paints outside the frame alone, as CSS clips an outer shadow at the border box.
  // The spec stores the bottom shadow first, as Figma lists a frame's effects.
  for (const shadow of box.shadows) {
    const blur = length(shadow.radius, mode);
    if (blur !== 0) {
      throw new Error("a layer casts a blurred shadow, which this suite does not composite");
    }
    const offset = at.side === "left" ? shadow.offsetX : -shadow.offsetY;
    const edge = inset + offset - length(shadow.spread, mode);
    if (at.depth >= edge && at.depth < inset) {
      shown = over(shown, color(shadow.color, mode));
    }
  }
  if (at.depth < inset) {
    return shown;
  }
  if (box.fill !== undefined && box.fill.kind !== "image") {
    shown = over(shown, color(box.fill, mode));
  }
  return shown;
}

/** The band a box's stroke takes on a sample's side, 0 for no stroke. */
function strokeBand(box: BoxSpec, mode: SweptMode, side: Sample["side"]): number {
  const { stroke } = box;
  return stroke === undefined ? 0 : "sides" in stroke ? stroke.sides[side] : length(stroke.weight, mode);
}

/**
 * The spec's pixel at a sample: what lies behind the box, the box's fill, each covering layer in
 * Figma's paint order with its shadows, its fill and its stroke where the point lies in each, and the
 * box's stroke over its layers where the point lies in its band.
 */
function specPixel(root: BoxSpec, mode: SweptMode, at: Sample, behind: Pixel): Pixel {
  let pixel = paintAt({ ...root, shadows: [] }, mode, at, 0, behind);
  const layers = coveringLayers(root);
  for (const layer of root.firstOnTop === true ? layers.toReversed() : layers) {
    const inset = insetsOf(layer)[at.side];
    pixel = paintAt(layer, mode, at, inset, pixel);
    if (
      layer.stroke !== undefined &&
      at.depth >= inset &&
      at.depth < inset + strokeBand(layer, mode, at.side)
    ) {
      pixel = over(pixel, color(layer.stroke.color, mode));
    }
  }
  if (root.stroke !== undefined && at.depth < strokeBand(root, mode, at.side)) {
    pixel = over(pixel, color(root.stroke.color, mode));
  }
  return pixel;
}

/** Whether two pixels lie within the tolerance on every channel. */
function near(spec: Pixel, chromium: Pixel): boolean {
  return (["r", "g", "b"] as const).every(
    (channel) => Math.abs(spec[channel] - chromium[channel]) <= CHANNEL_TOLERANCE
  );
}

/** A pixel, rounded, for a mismatch line. */
function shown(pixel: Pixel): string {
  return `rgb(${[pixel.r, pixel.g, pixel.b].map((channel) => Math.round(channel)).join(", ")})`;
}

/**
 * The box a set entry names: its variant's root, or the frame layer its path of keys leads to.
 *
 * @throws When the variant holds no frame layer down that path, a defect in the entry.
 */
function boxOf(set: (typeof SETS)[number]): BoxSpec {
  let box: BoxSpec = variantRoot(kit.spec, set.key);
  for (const key of set.path) {
    const child = box.children.find((layer) => layer.kind === "frame" && layer.key === key);
    if (child?.kind !== "frame") {
      throw new Error(`${set.key} holds no frame ${key}`);
    }
    box = child;
  }
  return box;
}

/** What lies behind a set entry's box under a pin: the page, or the spec's pixel inside its parent box. */
function behindOf(set: (typeof SETS)[number], mode: SweptMode, modeIndex: number): Pixel {
  if (set.within === undefined) {
    return PAGE;
  }
  const parent = SETS[set.within];
  const parentWidth = measured[modeIndex]?.[set.within]?.widths.left ?? 0;
  return specPixel(
    boxOf(parent),
    mode,
    { side: "left", depth: parentWidth + 1 },
    behindOf(parent, mode, modeIndex)
  );
}

describe.each(SETS.map((set, index) => ({ ...set, index })))("the $key $path fill", (set) => {
  const { index } = set;
  it("paints its left and bottom borders and the pixel inside the left one as Chromium does under every pin", () => {
    const root = boxOf(set);
    const apart = modes.flatMap((mode, modeIndex) => {
      const chromium = measured[modeIndex]?.[index];
      if (chromium === undefined) {
        return [`${named(mode)}: unmeasured`];
      }
      const behind = behindOf(set, mode, modeIndex);
      const border = specPixel(root, mode, { side: "left", depth: 0 }, behind);
      const inside = specPixel(root, mode, { side: "left", depth: chromium.widths.left + 1 }, behind);
      const bottom = specPixel(root, mode, { side: "bottom", depth: 0 }, behind);
      return near(border, chromium.border) && near(inside, chromium.inside) && near(bottom, chromium.bottom)
        ? []
        : [
            `${named(mode)}: spec border ${shown(border)} inside ${shown(inside)} bottom ${shown(bottom)}, Chromium border ${shown(chromium.border)} inside ${shown(chromium.inside)} bottom ${shown(chromium.bottom)}`,
          ];
    });
    expect(apart).toEqual([]);
  });

  it("paints the box that holds its fill below the box's other layers", () => {
    const root = boxOf(set);
    const holder = coveringLayers(root).find((layer) => layer.fill !== undefined);
    // Figma paints a frame's first child at the bottom, or its last where the frame paints its first
    // child on top.
    const bottom = root.firstOnTop === true ? root.children.at(-1) : root.children[0];
    expect(holder).toBeDefined();
    expect(bottom?.key).toBe(holder?.key);
  });

  it("rounds as Chromium does under every pin", () => {
    const root = boxOf(set);
    const apart = modes.flatMap((mode, modeIndex) => {
      const chromium = measured[modeIndex]?.[index];
      const corners = cornerLengths(root.cornerRadius).map((corner) => length(corner, mode));
      return chromium !== undefined && corners.every((corner) => corner === chromium.radius)
        ? []
        : [`${named(mode)}: spec corners ${JSON.stringify(corners)}, Chromium ${String(chromium?.radius)}`];
    });
    expect(apart).toEqual([]);
  });

  it("holds its fill in a box inset by the border and rounded by the inner radius under every pin", () => {
    const root = boxOf(set);
    const holder = coveringLayers(root).find((layer) => layer.fill !== undefined);
    const apart = modes.flatMap((mode, modeIndex) => {
      const chromium = measured[modeIndex]?.[index];
      if (chromium === undefined) {
        return [`${named(mode)}: unmeasured`];
      }
      const inner = Math.max(0, chromium.radius - chromium.widths.left);
      const corners = cornerLengths((holder ?? root).cornerRadius).map((corner) => length(corner, mode));
      const insets = insetsOf(holder);
      return JSON.stringify(insets) === JSON.stringify(chromium.widths) &&
        corners.every((corner) => corner === inner)
        ? []
        : [
            `${named(mode)}: spec insets ${JSON.stringify(insets)} corners ${JSON.stringify(corners)}, Chromium borders ${JSON.stringify(chromium.widths)} inner radius ${String(inner)}`,
          ];
    });
    expect(apart).toEqual([]);
  });
});

// `paintAt` is this suite's own compositor, so it answers to Chromium before the sets do. The box
// is the one the kit builds from the same shadows, so an order the build or the compositor gets wrong
// shows in the same pixel.
describe("the suite's shadow compositor", () => {
  it("paints two overlapping sharp shadows, as the kit builds them, in the order Chromium does", async () => {
    const [mode] = modes;
    if (mode === undefined) {
      throw new Error("the file holds no pin");
    }
    const { variant } = await buildCaptured(
      chip(),
      rest({ slot: "chip", classes: `w-[20px] h-[20px] ${STACKED_SHADOWS.className}` })
    );
    if (variant === undefined) {
      throw new Error("the build drew no variant");
    }
    const box = variant.root;
    // The box's bottom edge sits the shadows' offset up from the edge the depth counts from, so
    // Chromium's pixel, in the second row below the box, lies 2px up from that edge.
    const spec = paintAt(box, mode, { side: "bottom", depth: 2 }, STACKED_SHADOWS.offsetY, PAGE);
    expect(near(spec, stackedShadowPixel), `spec ${shown(spec)}, Chromium ${shown(stackedShadowPixel)}`).toBe(
      true
    );
  });
});
