/**
 * Unit under test: the fill of each set whose box clips its background at the border's inner edge
 * (`background-clip: padding-box`), as the kit builds it and an in-memory Figma file that the token
 * sync wrote resolves it under every combination of the file's modes. The sets are Calendar, Range
 * calendar and Sheet content, each stroked with `--border`, which the neutral dark theme makes
 * translucent.
 * Oracle: Chromium painting the real Fuse component on Fuse's built CSS over an opaque page color,
 * with the page stamped as `test:compare` stamps the same modes, and CSS Backgrounds 3 §5.2 for the
 * corner inside the border: the outer radius less the border width, at least 0.
 *
 * Two checks per set and pin, and one per set:
 *
 * - The pixel at the middle of the left border, where CSS shows the page through the border, and
 *   the pixel just inside it, where it shows the fill. The spec's pixel composites, over the same
 *   page color and as `@elmeragroup/color` composites, the root's fill, each layer that covers the
 *   root edge to edge and the root's stroke, as Figma paints a frame's fill under its layers and its
 *   inside stroke over them.
 * - The box that holds the spec's fill sits inside the root by Chromium's border widths and rounds
 *   by the inner radius.
 * - That box is the root's bottom layer, under the content CSS paints over the background, by the
 *   Figma plugin typings' child order: the first child paints at the bottom, or the last in a frame
 *   that paints its first child on top.
 */
import { Effect, Schema } from "effect";
import { TestConsole } from "effect/testing";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as Srgb from "@elmeragroup/color/srgb";

import { builtKit, variantRoot } from "../../test/built-kit.ts";
import type { BuiltSets } from "../../test/built-kit.ts";
import { FILE_KEY, run, TOKEN } from "../../test/cli-fixture.ts";
import { fuseModule, openFusePage } from "../../test/fuse-page.ts";
import { InMemoryFigma } from "../../test/in-memory-figma.ts";
import { everyPin, pinName, pinStamps } from "../../test/mode-pins.ts";
import type { Pin } from "../../test/mode-pins.ts";
import type { ThemeStamps } from "../compare/preview-theme.ts";
import { cornerLengths } from "./corner-spec.ts";
import type { BoxSpec, ColorSpec, FrameLayerSpec, NumberSpec } from "./kit-spec.ts";
import { SHEET_VIEWPORT } from "./sheet-text.ts";

/** The opaque color behind every component, in 8-bit channels. */
const PAGE = { r: 255, g: 0, b: 255 } as const;

/** How far apart a channel of the spec's pixel and Chromium's may lie, for color conversion. */
const CHANNEL_TOLERANCE = 2;

/** Where the page draws each set's component: its slot's top left corner, in CSS pixels. */
const SETS = [
  { key: "sheet-content/side=right", slot: "sheet", slotLeft: 0, slotTop: 0, part: "sheet-content" },
  { key: "calendar/state=rest", slot: "calendar", slotLeft: 680, slotTop: 0, part: "calendar" },
  {
    key: "range-calendar/state=rest",
    slot: "range-calendar",
    slotLeft: 680,
    slotTop: 420,
    part: "range-calendar",
  },
] as const;

/**
 * The page's script: the open Sheet portalled into a host as large as its viewport, and a Calendar
 * and a RangeCalendar, each in a slot over the page color. The scrim is hidden, so the page shows
 * behind the panel. Shadows are off: CSS clips an outer shadow at the border box (CSS Backgrounds 3
 * §7.1.1), and Chromium still bleeds it under a 1px border, so it would tint the pixel this test
 * reads for the fill.
 */
const ENTRY = `
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Calendar } from ${fuseModule("calendar.js")};
import { RangeCalendar } from ${fuseModule("range-calendar.js")};
import { Sheet } from ${fuseModule("sheet.js")};
import { LocaleProvider } from ${fuseModule("theme.js")};
const sets = ${JSON.stringify(SETS)};
const page = "rgb(${String(PAGE.r)}, ${String(PAGE.g)}, ${String(PAGE.b)})";
const slots = new Map();
for (const set of sets) {
  const slot = document.createElement("div");
  slot.dataset.slotFor = set.slot;
  slot.style.cssText = "position:absolute;left:" + set.slotLeft + "px;top:" + set.slotTop + "px;background:" + page;
  document.body.append(slot);
  slots.set(set.slot, slot);
}
const host = document.createElement("div");
host.style.cssText = "position:relative;width:${String(SHEET_VIEWPORT.width)}px;height:${String(SHEET_VIEWPORT.height)}px;contain:layout";
slots.get("sheet").append(host);
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
});
`;

/** An 8-bit color with no alpha. */
type Pixel = { readonly r: number; readonly g: number; readonly b: number };

/** What Chromium shows of one set's component under one pin. */
type Measured = {
  /** The pixel at the middle of the left border, and the one just inside the border. */
  readonly border: Pixel;
  readonly inside: Pixel;
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
        widths: sampling.widths,
        radius: sampling.radius,
      }))
    );
  }
  return out;
}

let browser: Browser | undefined;
let kit: BuiltSets;
let figma: InMemoryFigma;
let pins: readonly Pin[];
let measured: readonly (readonly Measured[])[];

beforeAll(async () => {
  kit = await builtKit();
  figma = new InMemoryFigma(FILE_KEY, TOKEN);
  await Effect.runPromise(
    run(figma, ["--file-key", FILE_KEY, "sync"]).pipe(Effect.provide(TestConsole.layer))
  );
  pins = everyPin(figma);
  const stamps = pins.map(pinStamps);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
  await openFusePage(page, { entry: ENTRY });
  measured = await measurePins(page, stamps);
});

afterAll(async () => {
  await browser?.close();
});

/** A color's channels and alpha, each from 0 to 1, as the file holds a COLOR value. */
const Channels = Schema.Struct({ r: Schema.Number, g: Schema.Number, b: Schema.Number, a: Schema.Number });

/** A FLOAT field as the file resolves it under a pin. A value that is no number fails the parse. */
function length(spec: NumberSpec, pin: Pin): number {
  return spec.kind === "literal"
    ? spec.value
    : Schema.decodeUnknownSync(Schema.Number)(
        figma.resolve(spec.variable.collection, spec.variable.name, pin)
      );
}

/** A COLOR field as the file resolves it under a pin. A value that is no color fails the parse. */
function color(spec: ColorSpec, pin: Pin): typeof Channels.Type {
  return spec.kind === "literal"
    ? spec.color
    : Schema.decodeUnknownSync(Channels)(figma.resolve(spec.variable.collection, spec.variable.name, pin));
}

/** An sRGB color from 0..1 channels and alpha. A value outside that range fails the test. */
function srgb({ r, g, b, a }: typeof Channels.Type): Srgb.Srgb {
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

/**
 * The spec's pixel `x` pixels in from the root's left edge, at mid-height: the page, the root's fill,
 * each covering layer's fill where the point lies inside it, and the root's stroke where the point
 * lies in its band on the left.
 */
function specPixel(root: BoxSpec, pin: Pin, x: number): Pixel {
  let pixel: Pixel = PAGE;
  if (root.fill !== undefined && root.fill.kind !== "image") {
    pixel = over(pixel, color(root.fill, pin));
  }
  for (const layer of coveringLayers(root)) {
    if (layer.fill !== undefined && layer.fill.kind !== "image" && x >= insetsOf(layer).left) {
      pixel = over(pixel, color(layer.fill, pin));
    }
  }
  const stroke = root.stroke;
  const band = stroke === undefined ? 0 : "sides" in stroke ? stroke.sides.left : length(stroke.weight, pin);
  if (stroke !== undefined && x < band) {
    pixel = over(pixel, color(stroke.color, pin));
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

describe.each(SETS.map((set, index) => ({ ...set, index })))("the $key fill", ({ key, index }) => {
  it("paints the border and the pixel inside it as Chromium does under every pin", () => {
    const root = variantRoot(kit.spec, key);
    const apart = pins.flatMap((pin, pinIndex) => {
      const chromium = measured[pinIndex]?.[index];
      if (chromium === undefined) {
        return [`${pinName(pin)}: unmeasured`];
      }
      const border = specPixel(root, pin, 0);
      const inside = specPixel(root, pin, chromium.widths.left + 1);
      return near(border, chromium.border) && near(inside, chromium.inside)
        ? []
        : [
            `${pinName(pin)}: spec border ${shown(border)} inside ${shown(inside)}, Chromium border ${shown(chromium.border)} inside ${shown(chromium.inside)}`,
          ];
    });
    expect(apart).toEqual([]);
  });

  it("paints the box that holds its fill below the root's other layers", () => {
    const root = variantRoot(kit.spec, key);
    const holder = coveringLayers(root).find((layer) => layer.fill !== undefined);
    // Figma paints a frame's first child at the bottom, or its last where the frame paints its first
    // child on top.
    const bottom = root.firstOnTop === true ? root.children.at(-1) : root.children[0];
    expect(holder).toBeDefined();
    expect(bottom?.key).toBe(holder?.key);
  });

  it("holds its fill in a box inset by the border and rounded by the inner radius under every pin", () => {
    const root = variantRoot(kit.spec, key);
    const holder = coveringLayers(root).find((layer) => layer.fill !== undefined);
    const apart = pins.flatMap((pin, pinIndex) => {
      const chromium = measured[pinIndex]?.[index];
      if (chromium === undefined) {
        return [`${pinName(pin)}: unmeasured`];
      }
      const inner = Math.max(0, chromium.radius - chromium.widths.left);
      const corners = cornerLengths((holder ?? root).cornerRadius).map((corner) => length(corner, pin));
      const insets = insetsOf(holder);
      return JSON.stringify(insets) === JSON.stringify(chromium.widths) &&
        corners.every((corner) => corner === inner)
        ? []
        : [
            `${pinName(pin)}: spec insets ${JSON.stringify(insets)} corners ${JSON.stringify(corners)}, Chromium borders ${JSON.stringify(chromium.widths)} inner radius ${String(inner)}`,
          ];
    });
    expect(apart).toEqual([]);
  });
});
