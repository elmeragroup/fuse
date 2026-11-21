/**
 * Unit under test: the line height the build gives a label, and the `1lh` height it gives a box, below
 * a box that sets its font size and line height, as `readType` and the box sizing read them from a
 * hand-built capture (`test/capture-fixtures.ts`).
 * Oracle: Chromium's computed `line-height` of the label's element, and the height it lays out a
 * `1lh` box at, on a page that loads the Tailwind stylesheet of the cases' classes and gives each
 * element those classes. The cases hold a percentage line height the label declares or inherits, ones
 * whose computed length is negative, the larger of a percentage and a length, a length over a length, the unitless number that passes down as
 * a factor instead, and a `var()` that substitutes a bare negative percentage, an invalid value that
 * leaves the parent's line height. Two more cases put a percentage under a product or a quotient,
 * which the build leaves unmapped, and record the line height Chromium computes for each. The test goes
 * red where the build reads a percentage as a number of pixels, takes an inherited percentage at the
 * label's own font size, keeps a negative line height, clamps an invalid one, maps a percentage that a
 * product or a quotient takes, or gives the label and the `1lh` box different line heights.
 */
import { Effect } from "effect";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildCaptured, chip, frameOf, part, rest, textOf } from "../../test/capture-fixtures.ts";
import type { LabelManifest } from "../capture/manifest.ts";
import { makeVariableIndex } from "./css-values.ts";
import { compileHostUtilities } from "./utility-css.ts";

/** How far apart, in CSS pixels, a built length and Chromium's may sit. */
const TOLERANCE_PX = 0.01;

/** The least height Figma resizes a layer to, under which the build leaves a height unmapped. */
const FIGMA_LEAST_SIZE_PX = 0.01;

/** The label the part holds. */
const LABEL: LabelManifest = {
  key: "label",
  name: "label",
  characters: "Label",
  textProperty: "Label",
  shownIn: () => true,
};

/** The text classes a label needs besides its size and line height. */
const TEXT_STYLE = "font-sans text-[#000000]";

/** A build whose `font-sans` binds the synced family, as every kit label's does. */
const FONT_SANS = {
  variables: makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
  ]),
};

/** Each case: the classes of the root, and of the part below it that holds the label. */
const CASES = [
  { root: "", part: "text-[16px] leading-[150%]" },
  { root: "text-[20px] leading-[150%]", part: "text-[16px]" },
  { root: "text-[16px] leading-[calc(100%+4px)]", part: "text-[12px]" },
  { root: "text-[20px] leading-[calc(50%-20px)]", part: "text-[16px]" },
  { root: "text-[16px] leading-[calc(100%-32px)]", part: "" },
  { root: "text-[16px] leading-[max(150%,20px)]", part: "" },
  { root: "text-[16px] leading-[calc(24px/16px)]", part: "" },
  { root: "text-[20px] leading-[1.5]", part: "text-[16px]" },
  { root: "text-[16px] leading-[24px]", part: "[--v:-50%] leading-[var(--v)]" },
  { root: "text-[20px] leading-[1.5]", part: "text-[16px] [--v:-50%] leading-[var(--v)]" },
] as const;

/**
 * Each case whose percentage a product or a quotient takes, which the build leaves unmapped, and the
 * line height Chromium computes, in pixels. Taking 150% and 50% of 20px would give 45px and 19.2px.
 */
const UNMAPPED = [
  { root: "text-[20px] leading-[calc(150%*150%/20px)]", part: "", chromium: 1125 },
  { root: "text-[20px] leading-[calc(24px*16px/(2*50%))]", part: "", chromium: 3.84 },
] as const;

/** The classes of every case and the box's `h-lh`. */
const CLASSES = [
  ...new Set([
    "h-lh",
    ...[...CASES, ...UNMAPPED].flatMap(({ root, part: own }) => `${root} ${own}`.split(" ")),
  ]),
].filter((className) => className !== "");

/** The case a build or a page draws: the classes of the root, and of the part below it. */
type Case = { readonly root: string; readonly part: string };

/** The label's line height and the height of a `1lh` part, as the build draws them. */
async function built({ root, part: own }: Case) {
  const label = await buildCaptured(
    chip({ parts: [part({ label: LABEL })] }),
    rest({
      slot: "chip",
      classes: `${TEXT_STYLE} ${root}`,
      children: [{ slot: "chip-dot", text: "Label", classes: own }],
    }),
    FONT_SANS
  );
  const box = await buildCaptured(
    chip({ parts: [part()] }),
    rest({ slot: "chip", classes: root, children: [{ slot: "chip-dot", classes: `${own} h-lh` }] }),
    FONT_SANS
  );
  const line = textOf(label.variant?.root)?.lineHeight;
  const height = frameOf(box.variant?.root)?.sizing.vertical;
  return {
    line: line?.kind === "literal" ? line.value : undefined,
    height: height?.kind === "fixed" && height.length.kind === "literal" ? height.length.value : undefined,
  };
}

/** Chromium's computed line height of the part and the height of its `1lh` box, in pixels. */
async function measured(page: Page, { root, part: own }: Case) {
  await page.evaluate(
    ([rootClasses, ownClasses]) => {
      document.body.innerHTML = `<div class="${rootClasses}"><span id="label" class="${ownClasses}">Label</span><div id="box" class="${ownClasses} h-lh"></div></div>`;
    },
    [root, own] as const
  );
  return page.evaluate(() => {
    const label = document.querySelector("#label");
    const box = document.querySelector("#box");
    if (label === null || box === null) {
      throw new Error("the page holds no label or box");
    }
    return {
      line: Number.parseFloat(getComputedStyle(label).lineHeight),
      height: box.getBoundingClientRect().height,
    };
  });
}

let browser: Browser;
let page: Page;

beforeAll(async () => {
  const css = await Effect.runPromise(compileHostUtilities(CLASSES));
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  await page.setContent(`<!doctype html><style>${css}</style><body style="margin: 0"></body>`);
});

afterAll(async () => {
  await browser.close();
});

describe("a line height below a box that sets it", () => {
  it.each(CASES)("draws a part of '$part' below '$root' at Chromium's line height", async (each) => {
    const drawn = await built(each);
    const chromiums = await measured(page, each);
    expect(drawn.line).toBeDefined();
    expect(Math.abs((drawn.line ?? Number.NaN) - chromiums.line)).toBeLessThanOrEqual(TOLERANCE_PX);
    // A box Chromium lays out under Figma's least size, as a zero line height's, has no Figma height.
    if (chromiums.height < FIGMA_LEAST_SIZE_PX) {
      expect(drawn.height).toBeUndefined();
    } else {
      expect(Math.abs((drawn.height ?? Number.NaN) - chromiums.height)).toBeLessThanOrEqual(TOLERANCE_PX);
    }
  });

  it.each(UNMAPPED)("leaves '$root' unmapped where Chromium computes $chromium pixels", async (each) => {
    const box = await buildCaptured(
      chip({ parts: [part()] }),
      rest({ slot: "chip", classes: each.root, children: [{ slot: "chip-dot", classes: "h-lh" }] }),
      FONT_SANS
    );
    const chromiums = await measured(page, each);
    expect(chromiums.line).toBeCloseTo(each.chromium, 2);
    expect(frameOf(box.variant?.root)?.sizing.vertical.kind).toBe("hug");
    // The fixture gives the label a family, a size and a color, so only the line height is missing.
    await expect(built(each)).rejects.toThrow("the label needs a font family, size, line height and color");
  });
});
