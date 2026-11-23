import { createElement } from "react";
import type { ReactElement } from "react";

/**
 * Unit under test: the Calendar and Range calendar sets' header and card, as the kit builds them: a
 * header that hugs its layers above a minimum width, spaces them out between its ends, and pads its
 * hugging heading on each side, in a card that hugs the header and centers the month grid.
 * Oracle: Chromium's layout of the real Calendar and RangeCalendar, each en-US month of 2026 in its
 * card in every mode the capture measures. Figma's layout of that shape follows the live probes of
 * 2026-11-19 (CAL2, CAL3): the header is as wide as its minimum or its layers, whichever is wider,
 * SPACE_BETWEEN splits the room left beside the hugging heading evenly, and the card hugs the header
 * and centers the grid under it. The test reads the built header's minimum and paddings, measures
 * the buttons and the heading's text in Chromium, places them as Figma would, and checks the header's
 * and card's widths and where the buttons, the text and the grid sit against Chromium's own boxes. It goes red
 * where the build's numbers or Calendar's CSS change so that the two place a layer apart.
 */
import * as Effect from "effect/Effect";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Calendar } from "../../../fuse/dist/calendar.js";
import { RangeCalendar } from "../../../fuse/dist/range-calendar.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import { openFusePage } from "../../test/fuse-page.ts";
import { EVERY_MODE } from "../capture/page-modes.ts";
import { buildComponentSets } from "./build-kit.ts";
import type { ChildLayerSpec, CounterAlignSpec, FrameLayerSpec, NumberSpec } from "./kit-spec.ts";

/** How far apart, in CSS pixels, a Figma place and Chromium's may sit: a few 64ths of a pixel. */
const TOLERANCE_PX = 0.05;

/** The months of 2026, each the month a sample calendar opens on. */
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/**
 * A heading wider than the grid at either density on any platform, as a designer's TEXT override
 * can be, which CAL2 grew the header around: each set renders it once more, over October, as month 0.
 */
const LONG_HEADING = "September 2026 September";

/** The samples each set renders: each month of 2026, then the long heading, as month 0. */
const SAMPLES = [...MONTHS, 0];

/** The month of 2026 a sample opens on: its own, or October for the long heading. */
const opensOn = (month: number): number => (month === 0 ? 10 : month);

/** The heading a sample's month gives the visible-range heading: its own, or the long one. */
const headingOf = (month: number): { readonly children?: string } =>
  month === 0 ? { children: LONG_HEADING } : {};

/** A day of 2026. */
const day = (month: number, date: number) => Temporal.PlainDate.from({ year: 2026, month, day: date });

/**
 * The two sets, each with its sample: the docs demo's header over its months, opening on a month of
 * 2026 by selecting its first day, or its first two as a range.
 */
const SETS = [
  {
    key: "calendar",
    sample: (month: number): ReactElement =>
      createElement(
        Calendar.Root,
        { "aria-label": "Sample", defaultValue: day(opensOn(month), 1) },
        createElement(
          Calendar.Header,
          null,
          createElement(Calendar.DecrementMonth),
          createElement(Calendar.VisibleRangeHeading, headingOf(month)),
          createElement(Calendar.IncrementMonth)
        ),
        createElement(Calendar.Months)
      ),
  },
  {
    key: "range-calendar",
    sample: (month: number): ReactElement =>
      createElement(
        RangeCalendar.Root,
        {
          "aria-label": "Sample",
          defaultValue: { start: day(opensOn(month), 1), end: day(opensOn(month), 2) },
        },
        createElement(
          RangeCalendar.Header,
          null,
          createElement(RangeCalendar.DecrementMonth),
          createElement(RangeCalendar.VisibleRangeHeading, headingOf(month)),
          createElement(RangeCalendar.IncrementMonth)
        ),
        createElement(RangeCalendar.Months)
      ),
  },
] as const;

/** The page's body: every sample calendar, each in a slot of its own. */
function sweepBody(): string {
  return SETS.flatMap(({ key, sample }) =>
    SAMPLES.map(
      (month) =>
        `<div data-sample="${key}" data-month="${String(month)}" style="display:flex;margin:8px">${renderToStaticMarkup(createElement(LocaleProvider, { locale: "en-US", children: sample(month) }))}</div>`
    )
  ).join("\n");
}

/** What the page measures of one sample calendar in one mode, in CSS pixels. */
type Measured = {
  readonly key: string;
  readonly month: number;
  readonly mode: string;
  readonly header: number;
  readonly previous: number;
  readonly next: number;
  readonly text: number;
  /** The text's left edge from the header's. */
  readonly textX: number;
  /** The previous button's left edge from the header's. */
  readonly previousX: number;
  /** The next button's right edge from the header's. */
  readonly nextEnd: number;
  /** The card's content width. */
  readonly content: number;
  readonly grid: number;
  /** The grid's left edge from the card's content box. */
  readonly gridX: number;
};

/** Measure every sample calendar in every mode, once its fonts have loaded there. */
function measureEveryMode(page: Page): Promise<readonly Measured[]> {
  return page.evaluate(async (modes) => {
    const box = (element: Element | null) => {
      if (element === null) {
        throw new Error("a sample calendar lacks a part");
      }
      return element.getBoundingClientRect();
    };
    const out: Measured[] = [];
    for (const mode of modes) {
      for (const [name, value] of Object.entries(mode.root)) {
        document.documentElement.setAttribute(name, value);
      }
      for (const [name, value] of Object.entries(mode.body)) {
        document.body.setAttribute(name, value);
      }
      const headings = [...document.querySelectorAll('[data-slot="calendar-visible-range-heading"]')];
      await Promise.all(headings.map((heading) => document.fonts.load(getComputedStyle(heading).font)));
      await document.fonts.ready;
      for (const slot of document.querySelectorAll("[data-sample]")) {
        const card = slot.firstElementChild;
        const heading = slot.querySelector('[data-slot="calendar-visible-range-heading"]');
        if (card === null || heading?.firstChild === null || heading?.firstChild === undefined) {
          throw new Error("a sample calendar lacks its card or its heading's text");
        }
        const range = document.createRange();
        range.selectNodeContents(heading.firstChild);
        const text = range.getBoundingClientRect();
        const header = box(slot.querySelector('[data-slot="calendar-header"]'));
        const previous = box(slot.querySelector('[data-slot="calendar-decrement-month"]'));
        const next = box(slot.querySelector('[data-slot="calendar-increment-month"]'));
        const grid = box(slot.querySelector('[data-slot="calendar-day-grid"]'));
        const style = getComputedStyle(card);
        const px = (property: string) => Number.parseFloat(style.getPropertyValue(property));
        const outer = card.getBoundingClientRect();
        const left = outer.left + px("border-left-width") + px("padding-left");
        out.push({
          key: slot.getAttribute("data-sample") ?? "",
          month: Number(slot.getAttribute("data-month")),
          mode: JSON.stringify(mode),
          header: header.width,
          previous: previous.width,
          next: next.width,
          text: text.width,
          textX: text.left - header.left,
          previousX: previous.left - header.left,
          nextEnd: header.right - next.right,
          content:
            outer.width -
            px("border-left-width") -
            px("border-right-width") -
            px("padding-left") -
            px("padding-right"),
          grid: grid.width,
          gridX: grid.left - left,
        });
      }
    }
    return out;
  }, EVERY_MODE);
}

/** A literal number of the built spec, which the header's lengths are. */
function pixels(number: NumberSpec | undefined): number {
  if (number?.kind !== "literal") {
    throw new Error("the built header holds a length that is no literal");
  }
  return number.value;
}

/** A frame layer of the built spec. */
function frame(layer: ChildLayerSpec | undefined): FrameLayerSpec {
  if (layer?.kind !== "frame") {
    throw new Error("the built calendar holds no frame where the header draws one");
  }
  return layer;
}

/**
 * What the built set gives its header and card: the header's minimum, padding, item spacing and
 * alignment, its heading's padding, and the card's alignment across.
 */
type BuiltHeader = {
  readonly minimum: number;
  readonly padding: number;
  readonly spacing: number;
  readonly align: FrameLayerSpec["primaryAlign"];
  readonly headingPadding: number;
  readonly cardAlign: FrameLayerSpec["counterAlign"];
};

/**
 * Where Figma's auto layout puts the free room along a row before its first layer: SPACE_BETWEEN
 * splits it between the gaps, which for three layers puts half of it before the middle one, and the
 * other alignments put none, half or all of it before the first.
 */
const BEFORE = { MIN: 0, CENTER: 0.5, MAX: 1 } as const satisfies Record<CounterAlignSpec, number>;

/** The share of the free room a column puts before a narrower layer, by its alignment across. */
const ACROSS = { MIN: 0, CENTER: 0.5, MAX: 1 } as const satisfies Record<CounterAlignSpec, number>;

let browser: Browser;
let measured: readonly Measured[];
let built: ReadonlyMap<string, BuiltHeader>;

beforeAll(async () => {
  const sets = await Effect.runPromise(buildComponentSets());
  built = new Map(
    SETS.map(({ key }) => {
      const set = sets.find((each) => each.componentSet.key === key);
      const root = set?.componentSet.variants[0]?.root;
      const header = frame(root?.children.find((child) => child.name === "calendar-header"));
      const heading = frame(header.children[1]);
      expect(pixels(header.paddingLeft)).toBe(pixels(header.paddingRight));
      expect(pixels(heading.paddingLeft)).toBe(pixels(heading.paddingRight));
      if (root === undefined) {
        throw new Error(`the build holds no ${key} variant`);
      }
      return [
        key,
        {
          minimum: pixels(header.limits.minWidth),
          padding: pixels(header.paddingLeft),
          spacing: pixels(header.itemSpacing),
          align: header.primaryAlign,
          headingPadding: pixels(heading.paddingLeft),
          cardAlign: root.counterAlign,
        },
      ] as const;
    })
  );
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await openFusePage(page, { body: sweepBody() });
  measured = await measureEveryMode(page);
}, 300_000);

afterAll(async () => {
  await browser.close();
});

describe("the calendar header and card, placed as Figma lays out the built shape", () => {
  it("measures every sample in every mode", () => {
    expect(measured).toHaveLength(SETS.length * SAMPLES.length * EVERY_MODE.length);
  });

  // The header grows past its minimum on every platform, so the comparison below covers the
  // padding and the card's alignment there, where a header at its minimum hides both.
  it("grows the long heading's header well past its minimum", () => {
    const grown = measured.filter(
      (sample) => sample.month === 0 && sample.header > (built.get(sample.key)?.minimum ?? Infinity) + 24
    );
    expect(grown).toHaveLength(SETS.length * EVERY_MODE.length);
  });

  it("matches Chromium's header and card widths and where the text and the grid sit", () => {
    const apart = measured.flatMap((sample) => {
      const header = built.get(sample.key);
      if (header === undefined) {
        throw new Error(`the build holds no ${sample.key} header`);
      }
      const { minimum, padding, spacing, align, headingPadding, cardAlign } = header;
      // SPACE_BETWEEN drops the item spacing (CAL2).
      const gap = align === "SPACE_BETWEEN" ? 0 : spacing;
      const heading = headingPadding + sample.text + headingPadding;
      const layers = sample.previous + gap + heading + gap + sample.next;
      const width = Math.max(minimum, padding + layers + padding);
      const free = width - padding - padding - layers;
      // SPACE_BETWEEN puts the buttons at the ends and half the free room on each side of the heading.
      const spaced = align === "SPACE_BETWEEN";
      const beforeFirst = spaced ? 0 : BEFORE[align] * free;
      const beforeHeading = spaced ? free / 2 : 0;
      const figma = {
        header: width,
        previousX: padding + beforeFirst,
        textX: padding + beforeFirst + sample.previous + gap + beforeHeading + headingPadding,
        nextEnd: padding + (spaced ? 0 : free - beforeFirst),
        // The card hugs its widest layer, the header, which is never narrower than the grid (CAL3).
        content: width,
        grid: minimum,
        gridX: ACROSS[cardAlign] * (width - minimum),
      };
      const fields = [
        "header",
        "previousX",
        "textX",
        "nextEnd",
        "content",
        "grid",
        "gridX",
      ] as const satisfies readonly (keyof typeof figma)[];
      return fields.flatMap((field) =>
        Math.abs(figma[field] - sample[field]) <= TOLERANCE_PX
          ? []
          : [
              `${sample.key} ${String(sample.month)} ${sample.mode}: ${field} ${String(figma[field])} in Figma, ${String(sample[field])} in Chromium`,
            ]
      );
    });
    expect(apart).toEqual([]);
  });
});
