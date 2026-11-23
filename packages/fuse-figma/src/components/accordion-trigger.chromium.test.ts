/**
 * Unit under test: Accordion item's trigger as the kit builds it from its capture: the row's padding,
 * gap and caret, and the label's sizing, width, line limit and alignment. The test works out the
 * label's width from the built item alone. The header and the trigger fill the item, so the trigger
 * is as wide as the item's fixed width less its stroke and padding. The padding is a `Fuse density`
 * variable, which the test reads from the synced variable set in each density's mode.
 * Oracle: Chromium's layout of the real Fuse `Accordion.Trigger` holding a label too long for one
 * line, in the kit's 384px preview host, in every mode the capture measures.
 * Before #880, the kit kept the label on one line while Chromium wrapped it.
 */
import { createElement } from "react";

import * as Result from "effect/Result";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Density } from "@elmeragroup/fuse/theme-catalog";

import { Accordion } from "../../../fuse/dist/accordion.js";
import { builtKit, variantRoot } from "../../test/built-kit.ts";
import { openFusePage } from "../../test/fuse-page.ts";
import { EVERY_MODE } from "../capture/page-modes.ts";
import { fuseVariableSet } from "../fuse-variable-set.ts";
import type { CollectionSpec } from "../variable-set.ts";
import { ACCORDION_PREVIEW_WIDTH } from "./accordion-kit.ts";
import { strokeRoom } from "./kit-spec.ts";
import type { BoxSpec, ComponentRootSpec, NumberSpec, TextLayerSpec } from "./kit-spec.ts";

/** How far apart, in CSS pixels, a Figma place and Chromium's may sit: a few 64ths of a pixel. */
const TOLERANCE_PX = 0.05;

/** A label of several words, each narrower than the room, that wraps before the caret in every mode. */
const LONG_LABEL = "Shipping, returns and delivery times for orders sent outside Norway";

/** The variants the test renders, at rest and closed. The card's border narrows its trigger. */
const VARIANTS = ["default", "card"] as const;

type Variant = (typeof VARIANTS)[number];

/** A variant's key in the built set. */
const keyOf = (variant: Variant): string =>
  `accordion-item/variant=${variant},radius=none,open=false,state=rest`;

/** The page's body: one item of each variant, holding the long label, in the kit's preview host. */
function itemsBody(): string {
  return VARIANTS.map(
    (variant) =>
      `<div data-sample="${variant}" style="width:${String(ACCORDION_PREVIEW_WIDTH)}px;margin:8px">${renderToStaticMarkup(
        createElement(
          Accordion.Root,
          { variant, defaultValue: [] },
          createElement(
            Accordion.Item,
            { value: "item" },
            createElement(Accordion.Header, null, createElement(Accordion.Trigger, null, LONG_LABEL))
          )
        )
      )}</div>`
  ).join("\n");
}

/** One line of the label in Chromium: its left edge from the trigger's and its width. */
type Line = { readonly left: number; readonly width: number };

/** What the page measures of one item's trigger in one mode, in CSS pixels. */
type Measured = {
  readonly variant: Variant;
  readonly mode: string;
  readonly density: Density;
  /** The trigger's border and padding at its start and at its end. */
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly gap: number;
  /** The caret's width and its left edge from the trigger's. */
  readonly caret: number;
  readonly caretX: number;
  /** The label's lines, in order. */
  readonly lines: readonly Line[];
};

/** Measure every item's trigger in every mode, once its fonts have loaded there. */
function measureEveryMode(page: Page): Promise<readonly Measured[]> {
  return page.evaluate(async (modes) => {
    const out: Measured[] = [];
    for (const mode of modes) {
      for (const [name, value] of Object.entries(mode.root)) {
        document.documentElement.setAttribute(name, value);
      }
      for (const [name, value] of Object.entries(mode.body)) {
        document.body.setAttribute(name, value);
      }
      const triggers = [...document.querySelectorAll<HTMLElement>('[data-slot="accordion-trigger"]')];
      await Promise.all(triggers.map((trigger) => document.fonts.load(getComputedStyle(trigger).font)));
      await document.fonts.ready;
      for (const slot of document.querySelectorAll("[data-sample]")) {
        const trigger = slot.querySelector<HTMLElement>('[data-slot="accordion-trigger"]');
        if (trigger === null) {
          throw new Error("a sample item lacks its trigger");
        }
        const text = trigger.firstChild;
        const caret = trigger.querySelector("svg");
        if (text?.nodeType !== Node.TEXT_NODE || caret === null) {
          throw new Error("a sample item's trigger lacks its label's text or its caret");
        }
        const range = document.createRange();
        range.selectNodeContents(text);
        const box = trigger.getBoundingClientRect();
        const caretBox = caret.getBoundingClientRect();
        const style = getComputedStyle(trigger);
        const px = (property: string) => Number.parseFloat(style.getPropertyValue(property));
        out.push({
          variant: slot.getAttribute("data-sample") === "card" ? "card" : "default",
          mode: JSON.stringify(mode),
          density: mode.root["data-density"],
          paddingLeft: px("border-left-width") + px("padding-left"),
          paddingRight: px("border-right-width") + px("padding-right"),
          gap: px("column-gap"),
          caret: caretBox.width,
          caretX: caretBox.left - box.left,
          lines: [...range.getClientRects()].map((rect) => ({
            left: rect.left - box.left,
            width: rect.width,
          })),
        });
      }
    }
    return out;
  }, EVERY_MODE);
}

/** The synced `Fuse density` collection, which holds each density's lengths. */
function densityCollection(): CollectionSpec {
  const set = fuseVariableSet();
  if (Result.isFailure(set)) {
    throw new Error(`the variable set does not build: ${set.failure.message}`);
  }
  const collection = set.success.collections.find((each) => each.name === "Fuse density");
  if (collection === undefined) {
    throw new Error("the variable set holds no Fuse density collection");
  }
  return collection;
}

/**
 * A length of the built spec in pixels at one density: a literal, or a `Fuse density` variable's
 * number in that density's mode.
 */
function pixels(lengths: CollectionSpec, number: NumberSpec | undefined, density: Density): number {
  if (number?.kind === "literal") {
    return number.value;
  }
  if (number?.kind !== "variable" || number.variable.collection !== lengths.name) {
    throw new Error("the built item holds a length that is neither a literal nor a density length");
  }
  const { name } = number.variable;
  const mode = lengths.modes.find((each) => each.toLowerCase() === density);
  const value =
    mode === undefined ? undefined : lengths.variables.find((each) => each.name === name)?.values.get(mode);
  if (value?._tag !== "Float") {
    throw new Error(`the density length ${name} holds no number at ${density}`);
  }
  return value.value;
}

/** The room a box leaves its layers across, at one density: its width less its padding and stroke. */
function roomInside(lengths: CollectionSpec, box: BoxSpec, width: number, density: Density): number {
  return (
    width -
    pixels(lengths, box.paddingLeft, density) -
    pixels(lengths, box.paddingRight, density) -
    pixels(lengths, strokeRoom(box.stroke, "left"), density) -
    pixels(lengths, strokeRoom(box.stroke, "right"), density)
  );
}

/** What the built set gives one variant's item and its trigger. */
type BuiltTrigger = {
  readonly item: ComponentRootSpec;
  readonly header: BoxSpec;
  readonly row: BoxSpec;
  readonly label: TextLayerSpec;
  readonly caret: NumberSpec;
};

/** The trigger the built variant holds below its header: a row of the label before the caret. */
function builtTrigger(item: ComponentRootSpec): BuiltTrigger {
  const header = item.children.find((child) => child.key === "header");
  const row = header?.kind === "frame" ? header.children.find((child) => child.key === "trigger") : undefined;
  if (header?.kind !== "frame" || header.children.length !== 1 || row?.kind !== "frame") {
    throw new Error("the built item holds no header holding the trigger row alone");
  }
  const [label, caret] = row.children;
  if (label?.kind !== "text" || caret?.kind !== "icon") {
    throw new Error("the built trigger holds no label before a caret");
  }
  return { item, header, row, label, caret: caret.size };
}

/**
 * A box's width at one density: its fixed width, or the room its parent leaves where it fills.
 * Undefined where it hugs, or where the parent's width is unknown.
 */
function widthIn(
  lengths: CollectionSpec,
  box: BoxSpec,
  parent: { readonly box: BoxSpec; readonly width: number } | undefined,
  density: Density
): number | undefined {
  const size = box.sizing.horizontal;
  if (size.kind === "fixed") {
    return pixels(lengths, size.length, density);
  }
  return size.kind === "fill" && parent !== undefined
    ? roomInside(lengths, parent.box, parent.width, density)
    : undefined;
}

/**
 * The width the built label fills at one density, from the built item alone: the item's width,
 * then the header's and the trigger's, then the room the trigger's padding, stroke, gap and caret
 * leave.
 * Undefined where a box's width does not follow from the item's.
 */
function builtLabelWidth(
  lengths: CollectionSpec,
  trigger: BuiltTrigger,
  density: Density
): number | undefined {
  const { item, header, row, caret } = trigger;
  const itemWidth = widthIn(lengths, item, undefined, density);
  const headerWidth =
    itemWidth === undefined ? undefined : widthIn(lengths, header, { box: item, width: itemWidth }, density);
  const rowWidth =
    headerWidth === undefined
      ? undefined
      : widthIn(lengths, row, { box: header, width: headerWidth }, density);
  return rowWidth === undefined
    ? undefined
    : roomInside(lengths, row, rowWidth, density) -
        pixels(lengths, row.itemSpacing, density) -
        pixels(lengths, caret, density);
}

/** Expect a length the build gives to sit within the tolerance of Chromium's. */
function expectNear(figma: number, inChromium: number, where: string): void {
  expect(
    Math.abs(figma - inChromium),
    `${where}: ${String(figma)} in Figma, ${String(inChromium)} in Chromium`
  ).toBeLessThanOrEqual(TOLERANCE_PX);
}

let browser: Browser | undefined;
let lengths: CollectionSpec;
let measured: readonly Measured[];
let built: ReadonlyMap<Variant, BuiltTrigger>;

/** Each measured trigger beside the built variant's, and the name its messages give it. */
function samples(): readonly {
  readonly sample: Measured;
  readonly trigger: BuiltTrigger;
  readonly where: string;
}[] {
  return measured.map((sample) => {
    const trigger = built.get(sample.variant);
    if (trigger === undefined) {
      throw new Error(`the build holds no ${sample.variant} trigger`);
    }
    return { sample, trigger, where: `${sample.variant} ${sample.mode}` };
  });
}

beforeAll(async () => {
  const { spec } = await builtKit();
  lengths = densityCollection();
  built = new Map(VARIANTS.map((variant) => [variant, builtTrigger(variantRoot(spec, keyOf(variant)))]));
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await openFusePage(page, { body: itemsBody() });
  measured = await measureEveryMode(page);
}, 300_000);

afterAll(async () => {
  await browser?.close();
});

describe("Accordion item's trigger holding a long label, against Chromium's layout", () => {
  it("wraps the label in Chromium in every mode, each line inside the room before the caret", () => {
    expect(measured).toHaveLength(VARIANTS.length * EVERY_MODE.length);
    for (const sample of measured) {
      const where = `${sample.variant} ${sample.mode}`;
      const room = sample.caretX - sample.gap - sample.paddingLeft;
      expect(sample.lines.length, `${where}: lines`).toBeGreaterThanOrEqual(2);
      for (const line of sample.lines) {
        expect(line.width, `${where}: a line wider than the room`).toBeLessThanOrEqual(room + TOLERANCE_PX);
      }
    }
  });

  it("lays the built row out across, packs it at its start, pads it, spaces it and sizes its caret as Chromium does", () => {
    for (const { sample, trigger, where } of samples()) {
      const { row, caret } = trigger;
      // Figma draws `itemSpacing` as the gap only in a packed row. SPACE_BETWEEN spaces the layers by
      // the free room instead.
      expect(row.direction, `${where}: the row's direction`).toBe("HORIZONTAL");
      expect(row.primaryAlign, `${where}: the row packs`).toBe("MIN");
      expectNear(
        pixels(lengths, row.paddingLeft, sample.density) +
          pixels(lengths, strokeRoom(row.stroke, "left"), sample.density),
        sample.paddingLeft,
        `${where}: border and padding left`
      );
      expectNear(
        pixels(lengths, row.paddingRight, sample.density) +
          pixels(lengths, strokeRoom(row.stroke, "right"), sample.density),
        sample.paddingRight,
        `${where}: border and padding right`
      );
      expectNear(pixels(lengths, row.itemSpacing, sample.density), sample.gap, `${where}: gap`);
      expectNear(pixels(lengths, caret, sample.density), sample.caret, `${where}: caret`);
    }
  });

  it("fills the built label across the room the built item leaves before the caret, as wide as Chromium's label", () => {
    for (const { sample, trigger, where } of samples()) {
      expect(trigger.label.sizing.horizontal.kind, `${where}: the label's width`).toBe("fill");
      const width = builtLabelWidth(lengths, trigger, sample.density);
      if (width === undefined) {
        expect.unreachable(`${where}: the built label's width does not follow from the item's`);
      }
      expectNear(width, sample.caretX - sample.gap - sample.paddingLeft, `${where}: label width`);
    }
  });

  it("lets the built label show every line Chromium sets, each from the label's start", () => {
    for (const { sample, trigger, where } of samples()) {
      const { row, label } = trigger;
      expect(
        label.truncation?.maxLines ?? Number.POSITIVE_INFINITY,
        `${where}: the lines Figma shows`
      ).toBeGreaterThanOrEqual(sample.lines.length);
      expect(label.align.horizontal, `${where}: the lines align`).toBe("LEFT");
      for (const [index, line] of sample.lines.entries()) {
        expectNear(
          pixels(lengths, row.paddingLeft, sample.density),
          line.left,
          `${where}: line ${String(index)} start`
        );
      }
    }
  });
});
