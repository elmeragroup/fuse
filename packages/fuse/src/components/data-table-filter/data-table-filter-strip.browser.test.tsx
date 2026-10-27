/**
 * Browser project. The chip strip: one row at every width that scrolls sideways, fades at an end
 * only while chips hide past it, and takes a vertical mouse wheel until it reaches an end.
 */
import type { ReactNode } from "react";

import type { ColumnFiltersState } from "@tanstack/react-table";
import { afterEach, beforeEach, describe, expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import {
  CREATED_SEPTEMBER,
  CUSTOMER_NORD,
  Orders,
  renderOrders,
  STATUS_THREE,
} from "../../../test/data-table-filter-fixture";
import { withLocale } from "../../../test/locale-matrix";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { metricPx, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { DataTableFilter } from "./index";

/** Five filters, more than a 1280px bar shows at once. */
const FIVE: ColumnFiltersState = [
  ...STATUS_THREE,
  ...CUSTOMER_NORD,
  ...CREATED_SEPTEMBER,
  {
    id: "tags",
    value: { kind: "multiOption", operator: "includesAnyOf", values: ["priority", "export", "manual"] },
  },
  { id: "amount", value: { kind: "number", operator: "isBetween", values: [100, 500] } },
];

/** The fade at each end, 1.5rem at the 16px root. */
const FADE = 24;

beforeEach(async () => {
  await page.viewport(1280, 720);
});

afterEach(async () => {
  await page.viewport(414, 896);
});

/** The chip strip. */
function strip(): HTMLElement {
  // DOM audit: the strip is a layout box with no role; its scroll box and mask are the behaviour.
  const element = document.querySelector<HTMLElement>("[data-slot=data-table-filter-chips]");
  if (element === null) {
    throw new Error("expected the chip strip");
  }
  return element;
}

/** How far the strip can scroll. */
function range(element: HTMLElement): number {
  return element.scrollWidth - element.clientWidth;
}

/** The strip's fades: the side its mask runs toward, and the faded width at its start and end. */
type Fades = { readonly toward: string; readonly start: number; readonly end: number };

/**
 * Reads the strip's computed mask, a gradient from transparent through black at the start fade's
 * width to black at the end fade's width short of 100%, and back to transparent.
 */
function fades(element: HTMLElement): Fades {
  const mask = getComputedStyle(element).maskImage;
  const match =
    /^linear-gradient\(to (?<toward>left|right), rgba\(0, 0, 0, 0\), rgb\(0, 0, 0\) (?<start>[\d.]+)px, rgb\(0, 0, 0\) (?:100%|calc\(100% - (?<end>[\d.]+)px\)), /u.exec(
      mask
    );
  const groups = match?.groups;
  if (groups?.toward === undefined || groups.start === undefined) {
    throw new Error(`expected the strip's fade mask, got ${mask}`);
  }
  return { toward: groups.toward, start: Number(groups.start), end: Number(groups.end ?? 0) };
}

/** Scrolls the strip to a distance from its inline start, then lets the scroll timeline catch up. */
async function scrollTo(element: HTMLElement, position: number): Promise<void> {
  const rtl = getComputedStyle(element).direction === "rtl";
  element.scrollLeft = rtl ? -position : position;
  await nextFrames(2);
}

/** Dispatches a cancelable wheel turn that bubbles, as a real one does, and returns it. */
function turnWheel(target: HTMLElement, init: WheelEventInit): WheelEvent {
  const turn = new WheelEvent("wheel", { ...init, bubbles: true, cancelable: true });
  target.dispatchEvent(turn);
  return turn;
}

/** The fixture with a tall page below it, so a wheel turn the strip leaves scrolls the page. */
function renderScrollable(initial: ColumnFiltersState, dir: "ltr" | "rtl", bar?: ReactNode): void {
  renderThemed(
    withLocale(
      "en-US",
      <div dir={dir}>
        <Orders initial={initial}>
          {bar ?? <DataTableFilter.Bar />}
          <DataTableFilter.Content />
          <DataTableFilter.ValueContent />
        </Orders>
        <div style={{ height: 3000 }} />
      </div>
    )
  );
}

describe("DataTableFilter chip strip layout", () => {
  it("keeps every chip on one row in a wide bar, at one chip's height, and scrolls the rest", () => {
    const one = renderOrders({ initial: STATUS_THREE });
    const oneChipHeight = roleNamed("toolbar", "Filters").getBoundingClientRect().height;
    one.unmount();

    renderOrders({ initial: FIVE });
    const bar = roleNamed("toolbar", "Filters");
    expect(bar.getBoundingClientRect().height).toBe(oneChipHeight);
    const chips = page.elementLocator(bar).getByRole("group").elements();
    expect(chips).toHaveLength(5);
    const [first] = chips;
    for (const chip of chips) {
      expect(chip.getBoundingClientRect().top, chip.getAttribute("aria-label") ?? "").toBe(
        first?.getBoundingClientRect().top
      );
    }
    expect(strip().scrollWidth).toBeGreaterThan(strip().clientWidth);
  });

  it("puts Clear right after the last chip while the chips fit, one surface gap away", () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    const last = roleNamed("group", "Customer filter").getBoundingClientRect();
    const clear = roleNamed("button", "Clear filters").getBoundingClientRect();
    expect(clear.left - last.right).toBeCloseTo(metricPx("surface-gap-sm", "dense"), 1);
    expect(clear.top).toBe(last.top);
  });

  it("puts Clear at the bar's end when the chips overflow", () => {
    renderOrders({ initial: FIVE });
    const bar = roleNamed("toolbar", "Filters").getBoundingClientRect();
    const clear = roleNamed("button", "Clear filters").getBoundingClientRect();
    expect(clear.right).toBeCloseTo(bar.right, 0);
  });
});

describe("DataTableFilter chip strip fades", () => {
  it("shows no fade while the chips fit", async () => {
    renderOrders({ initial: STATUS_THREE });
    await nextFrames(2);
    expect(range(strip())).toBe(0);
    expect(fades(strip())).toEqual({ toward: "right", start: 0, end: 0 });
  });

  it.each([
    { dir: "ltr", toward: "right" },
    { dir: "rtl", toward: "left" },
  ] as const)(
    "fades only the ends with hidden chips, toward the inline end, in $dir",
    async ({ dir, toward }) => {
      renderScrollable(FIVE, dir);
      const element = strip();
      await nextFrames(2);
      expect(range(element)).toBeGreaterThan(2 * FADE);

      expect(fades(element), "at the start").toEqual({ toward, start: 0, end: FADE });
      await scrollTo(element, range(element) / 2);
      expect(fades(element), "midway").toEqual({ toward, start: FADE, end: FADE });
      await scrollTo(element, range(element));
      // A right-to-left box snaps `scrollLeft` to whole pixels, so its end can stop short of a
      // fractional scroll range by under a pixel.
      const end = fades(element);
      expect(end.toward, "at the end").toBe(toward);
      expect(end.start, "at the end").toBe(FADE);
      expect(end.end, "at the end").toBeLessThanOrEqual(1);
    }
  );

  it("follows the strip's own direction, not an outer right-to-left container's", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <div dir="rtl">
          <div dir="ltr">
            <Orders initial={FIVE} />
          </div>
        </div>
      )
    );
    const element = strip();
    await nextFrames(2);
    expect(fades(element), "at the start").toEqual({ toward: "right", start: 0, end: FADE });
    await scrollTo(element, range(element) / 2);
    expect(fades(element), "midway").toEqual({ toward: "right", start: FADE, end: FADE });
  });

  it("keeps the fades under reduced motion, since they follow the scroll position", async () => {
    await emulateReducedMotion("reduce");
    onTestFinished(() => emulateReducedMotion("no-preference"));
    renderOrders({ initial: FIVE });
    const element = strip();
    await nextFrames(2);
    expect(fades(element), "at the start").toEqual({ toward: "right", start: 0, end: FADE });
    await scrollTo(element, range(element));
    expect(fades(element), "at the end").toEqual({ toward: "right", start: FADE, end: 0 });
  });
});

describe("DataTableFilter chip strip wheel", () => {
  it.each([
    { dir: "ltr", sign: 1 },
    { dir: "rtl", sign: -1 },
  ] as const)(
    "scrolls an overflowing strip toward its inline end on a downward wheel in $dir",
    async ({ dir, sign }) => {
      renderScrollable(FIVE, dir);
      const element = strip();
      await userEvent.wheel(element, { delta: { y: 100 } });
      await expect.poll(() => element.scrollLeft * sign).toBeGreaterThan(0);
      await nextFrames(3);
      expect(window.scrollY).toBe(0);
    }
  );

  it.each(["ltr", "rtl"] as const)("leaves the wheel to the page at the strip's end in %s", async (dir) => {
    renderScrollable(FIVE, dir);
    const element = strip();
    await scrollTo(element, range(element));
    const end = element.scrollLeft;
    await userEvent.wheel(element, { delta: { y: 100 } });
    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    expect(element.scrollLeft).toBe(end);
  });

  it("leaves the wheel to the page while the chips fit", async () => {
    renderScrollable(STATUS_THREE, "ltr");
    await userEvent.wheel(strip(), { delta: { y: 100 } });
    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
  });

  it.each([
    { turn: "a pinch zoom", init: { deltaY: 100, ctrlKey: true }, prevented: false },
    { turn: "a sideways swipe", init: { deltaX: 40, deltaY: 10 }, prevented: false },
    { turn: "an upward turn at the start", init: { deltaY: -100 }, prevented: false },
    { turn: "a downward turn", init: { deltaY: 100 }, prevented: true },
  ])("prevents the page's scroll for $turn: $prevented", ({ init, prevented }) => {
    renderOrders({ initial: FIVE });
    expect(turnWheel(strip(), init).defaultPrevented).toBe(prevented);
  });

  it("leaves a turn a chip's own listener cancelled, without scrolling", () => {
    renderOrders({ initial: FIVE });
    const element = strip();
    const chip = roleNamed("group", "Status filter");
    const cancel = (event: WheelEvent) => {
      event.preventDefault();
    };
    chip.addEventListener("wheel", cancel, { passive: false });
    onTestFinished(() => {
      chip.removeEventListener("wheel", cancel);
    });
    turnWheel(chip, { deltaY: 100 });
    expect(element.scrollLeft).toBe(0);
  });

  it("scrolls more than the delta for a line-mode turn", () => {
    renderOrders({ initial: FIVE });
    const element = strip();
    turnWheel(element, { deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE });
    expect(element.scrollLeft).toBeGreaterThan(3);
  });

  it("scrolls exactly one strip width for a page-mode turn", () => {
    renderThemed(
      withLocale(
        "en-US",
        <div style={{ width: 600 }}>
          <Orders initial={FIVE} />
        </div>
      )
    );
    const element = strip();
    // More than a page left to scroll, so the browser's clamp cannot hide a wrong page size.
    expect(range(element)).toBeGreaterThan(element.clientWidth);
    turnWheel(element, { deltaY: 1, deltaMode: WheelEvent.DOM_DELTA_PAGE });
    expect(element.scrollLeft).toBe(element.clientWidth);
  });

  it("keeps the consumer's ref on Chips", async () => {
    let received: HTMLDivElement | null = null;
    renderScrollable(
      FIVE,
      "ltr",
      <DataTableFilter.Bar>
        <DataTableFilter.Trigger />
        <DataTableFilter.Chips
          ref={(element) => {
            received = element;
          }}
        />
        <DataTableFilter.Clear />
      </DataTableFilter.Bar>
    );
    const element = strip();
    expect(received).toBe(element);
    await userEvent.wheel(element, { delta: { y: 100 } });
    await expect.poll(() => element.scrollLeft).toBeGreaterThan(0);
  });
});
