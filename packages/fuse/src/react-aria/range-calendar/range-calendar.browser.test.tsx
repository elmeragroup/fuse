import type { ReactNode } from "react";

import { CalendarDate, isSameDay, isWeekend } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";
import { I18nProvider } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertStateFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import {
  accessibleRangeHeading,
  calendarGrid,
  calendarRoot,
  cellNumbered,
  dayNumbered,
  focusLandsOnDay,
  navButtonNamed,
  parkPointerOffGrid,
  visibleMonthTitle,
} from "../../../test/rac-calendar-testing";
import { cssVarColor, renderThemed } from "../../../test/themed-browser-render";
import { UiProviders } from "../ui-providers/ui-providers";
import { RangeCalendar } from "./range-calendar";

function renderRangeCalendar(node: ReactNode) {
  return renderThemed(
    <UiProviders locale="en-US" navigate={() => undefined}>
      {node}
    </UiProviders>
  );
}

function buttonNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected button ${name}`);
  }
  return element;
}

/** The pill inside a day band — the layer that carries the selection fill. */
function pillOf(day: HTMLElement): HTMLElement {
  const pill = day.firstElementChild;
  if (!(pill instanceof HTMLElement)) {
    throw new Error("expected the day's inner pill");
  }
  return pill;
}

function cells(): HTMLElement[] {
  return page
    .getByRole("gridcell")
    .elements()
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
}

const july13 = new CalendarDate(2026, 7, 13);
const july14 = new CalendarDate(2026, 7, 14);
const july16 = new CalendarDate(2026, 7, 16);
const july17 = new CalendarDate(2026, 7, 17);
const july18 = new CalendarDate(2026, 7, 18);
const july22 = new CalendarDate(2026, 7, 22);

/** The shape RAC hands `onChange` — a RangeValue of the calendar's own date type. */
type CommittedRange = { start: DateValue; end: DateValue };
type RangeChangeSpy = Mock<(value: CommittedRange) => void>;

function rangeChangeSpy(): RangeChangeSpy {
  return vi.fn<(value: CommittedRange) => void>();
}

/** The range a spy was called with, first call, asserted to exist. */
function committedRange(onChange: RangeChangeSpy): CommittedRange {
  const committed = onChange.mock.calls[0]?.[0];
  if (committed === undefined) {
    throw new Error("expected onChange to have received a range");
  }
  return committed;
}

describe("RangeCalendar", () => {
  it("exposes an application root with a grid, weekday columnheaders, day cells, nav buttons and RAC's two heading faces", async () => {
    renderRangeCalendar(<RangeCalendar defaultValue={{ start: july14, end: july17 }} />);
    await expect.element(page.getByRole("application")).toBeVisible();
    await expect.element(page.getByRole("grid")).toBeVisible();
    expect(calendarRoot().contains(calendarGrid())).toBe(true);
    expect(cells().length).toBeGreaterThan(27);
    // The shared CalendarGridHeader row has no queryable role: RAC marks it aria-hidden
    // because every day's own label already names its weekday. Its seven cells are the
    // only observable proof the shared part rendered.
    expect(calendarGrid().querySelectorAll("thead th")).toHaveLength(7);
    // The locale's short names are compact enough for a grid column, so they are kept.
    expect(calendarGrid().textContent).toContain("Sun");
    expect(calendarGrid().textContent).not.toContain("Sunday");
    await expect.element(navButtonNamed(/previous/i)).toBeVisible();
    await expect.element(navButtonNamed(/next/i)).toBeVisible();
    expect(dayNumbered(14).getAttribute("aria-label")).toMatch(/Tuesday, July 14, 2026/i);

    const visibleTitle = visibleMonthTitle();
    await expect.element(visibleTitle).toBeVisible();
    expect(visibleTitle).toHaveAttribute("aria-hidden", "true");
    expect(visibleTitle.getAttribute("data-slot")).toBe("heading");
    expect(visibleTitle.textContent).toMatch(/July\s+2026/i);

    const accessibleRange = accessibleRangeHeading();
    expect(accessibleRange).not.toBe(visibleTitle);
    expect(accessibleRange.textContent).toMatch(/July\s+2026/i);
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/July\s+2026/i);
  });

  it("follows the locale direction and its weekday label width", async () => {
    renderRangeCalendar(
      <I18nProvider locale="ar-EG">
        <RangeCalendar defaultValue={{ start: july14, end: july17 }} />
      </I18nProvider>
    );
    await expect.element(page.getByRole("application")).toBeVisible();
    expect(getComputedStyle(calendarGrid()).direction).toBe("rtl");
    // DOM audit: RAC marks weekday headings as presentation; inspect their rendered column order.
    const headers = [...calendarGrid().querySelectorAll("thead th")];
    expect(headers).toHaveLength(7);
    expect(headers[0]?.getBoundingClientRect().left).toBeGreaterThan(
      headers[6]?.getBoundingClientRect().left ?? 0
    );
    // Arabic short weekday names are wider than a grid column, so the locale's label width
    // — not its direction — selects the narrow fallback.
    const labels = headers.map((cell) => cell.textContent.trim());
    expect(labels.every((label) => Array.from(label).length === 1)).toBe(true);
  });

  it("spreads className onto the root with no recipe underneath it", async () => {
    renderRangeCalendar(
      <RangeCalendar
        defaultValue={{ start: july14, end: july17 }}
        className={(renderProps) => (renderProps.isDisabled ? "opacity-80" : "min-w-40")}
      />
    );
    await expect.element(page.getByRole("grid")).toBeVisible();
    expect(calendarRoot().className).toContain("min-w-40");
    expect(getComputedStyle(calendarRoot()).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(calendarRoot()).borderTopWidth).toBe("0px");
    expect(getComputedStyle(calendarRoot()).boxShadow).toBe("none");
  });

  it("anchors the range on Enter, extends it with ArrowRight and commits once on the second Enter", async () => {
    const onChange = rangeChangeSpy();
    renderRangeCalendar(<RangeCalendar defaultFocusedValue={july14} onChange={onChange} />);
    await expect.element(page.getByRole("grid")).toBeVisible();

    await parkPointerOffGrid();
    dayNumbered(14).focus();
    await userEvent.keyboard("{Enter}");
    // RAC auto-advances the focused day once the anchor is set, so arrow keys extend
    // the highlight from the day after the anchor.
    await focusLandsOnDay(15);
    expect(onChange).not.toHaveBeenCalled();
    expect(dayNumbered(14)).toHaveAttribute("data-selection-start");

    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    await focusLandsOnDay(18);
    expect(cellNumbered(16)).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    const committed = committedRange(onChange);
    expect(isSameDay(committed.start, july14)).toBe(true);
    expect(isSameDay(committed.end, july18)).toBe(true);
  });

  it("paints start, middle and end cells from two clicks, with the caps marked by RAC", async () => {
    const onChange = rangeChangeSpy();
    renderRangeCalendar(<RangeCalendar defaultFocusedValue={july14} onChange={onChange} />);
    await expect.element(page.getByRole("grid")).toBeVisible();

    await userEvent.click(dayNumbered(14));
    await userEvent.click(dayNumbered(17));
    expect(onChange).toHaveBeenCalledTimes(1);
    const committed = committedRange(onChange);
    expect(isSameDay(committed.start, july14)).toBe(true);
    expect(isSameDay(committed.end, july17)).toBe(true);

    const start = dayNumbered(14);
    const end = dayNumbered(17);
    expect(start).toHaveAttribute("data-selection-start");
    expect(start.hasAttribute("data-selection-end")).toBe(false);
    expect(end).toHaveAttribute("data-selection-end");
    expect(end.hasAttribute("data-selection-start")).toBe(false);

    for (const between of [15, 16]) {
      expect(cellNumbered(between), `day ${between}`).toHaveAttribute("aria-selected", "true");
      const middle = dayNumbered(between);
      expect(middle).toHaveAttribute("data-selected");
      expect(middle.hasAttribute("data-selection-start")).toBe(false);
      expect(middle.hasAttribute("data-selection-end")).toBe(false);
      // Middle days take the translucent band on the band layer, never the caps' fill.
      expect(getComputedStyle(pillOf(middle)).color).not.toBe(
        cssVarColor(pillOf(middle), "--primary-foreground")
      );
    }

    for (const cap of [start, end]) {
      const pill = pillOf(cap);
      expect(getComputedStyle(pill).backgroundColor).toBe(cssVarColor(pill, "--primary"));
      expect(getComputedStyle(pill).color).toBe(cssVarColor(pill, "--primary-foreground"));
    }
    expect(cellNumbered(13).getAttribute("aria-selected")).not.toBe("true");
    expect(cellNumbered(18).getAttribute("aria-selected")).not.toBe("true");
  });

  it("mutes an unavailable day's pill with the muted-foreground token", async () => {
    renderRangeCalendar(
      <RangeCalendar defaultFocusedValue={july14} isDateUnavailable={(date) => isSameDay(date, july16)} />
    );
    await expect.element(page.getByRole("grid")).toBeVisible();
    expect(dayNumbered(16)).toHaveAttribute("data-unavailable");

    const unavailable = pillOf(dayNumbered(16));
    expect(getComputedStyle(unavailable).color).toBe(cssVarColor(unavailable, "--muted-foreground"));
    const bookable = pillOf(dayNumbered(15));
    expect(getComputedStyle(bookable).color).toBe(cssVarColor(bookable, "--foreground"));
  });

  it("gets no hover fill on an unavailable day (RAC skips hover on unavailable cells)", async () => {
    renderRangeCalendar(
      <RangeCalendar defaultFocusedValue={july14} isDateUnavailable={(date) => isSameDay(date, july16)} />
    );
    await expect.element(page.getByRole("grid")).toBeVisible();

    // RAC disables useHover/usePress for unavailable cells, so group-hover never fires today;
    // the compound's suppression classes only matter if an upgrade changes that.
    await userEvent.hover(dayNumbered(16));
    expect(getComputedStyle(pillOf(dayNumbered(16))).backgroundColor).toBe("rgba(0, 0, 0, 0)");

    await userEvent.hover(dayNumbered(15));
    const bookable = pillOf(dayNumbered(15));
    expect(getComputedStyle(bookable).backgroundColor).toBe(cssVarColor(bookable, "--muted"));
    await parkPointerOffGrid();
  });

  it("marks a range whose endpoint is unavailable invalid and associates its errorMessage", async () => {
    renderRangeCalendar(
      <RangeCalendar
        defaultValue={{ start: july18, end: july22 }}
        defaultFocusedValue={july18}
        isDateUnavailable={(date) => isWeekend(date, "en-US")}
        errorMessage={
          <span role="status" aria-label="Range calendar error details">
            Weekends are closed.
          </span>
        }
      />
    );
    const error = page.getByRole("status", { name: "Range calendar error details" });
    await expect.element(error).toBeVisible();
    const errorNode = error.element();
    if (!(errorNode instanceof HTMLElement)) {
      throw new Error("expected the error node");
    }

    expect(calendarRoot()).toHaveAttribute("data-invalid");
    expect(dayNumbered(18)).toHaveAttribute("data-invalid");
    expect(cellNumbered(18)).toHaveAttribute("aria-disabled", "true");
    // A selected unavailable endpoint keeps the cap's text, not the unavailable face.
    const endpoint = pillOf(dayNumbered(18));
    expect(getComputedStyle(endpoint).color).toBe(cssVarColor(endpoint, "--primary-foreground"));

    const textHost = errorNode.parentElement;
    if (!(textHost instanceof HTMLElement)) {
      throw new Error("expected the RAC Text host");
    }
    expect(textHost.getAttribute("data-slot")).toBe("text");
    expect(textHost.getAttribute("slot")).toBe("errorMessage");
    expect(getComputedStyle(textHost).color).toBe(cssVarColor(textHost, "--error"));
    // The errorMessage slot is what wires the copy to the invalid days.
    const describedBy = dayNumbered(18).getAttribute("aria-describedby");
    expect(describedBy, "an invalid day must reference the errorMessage").toBeTruthy();
    expect(describedBy?.split(/\s+/)).toContain(textHost.id);
  });

  it("renders no error node when errorMessage is omitted", async () => {
    renderRangeCalendar(<RangeCalendar defaultValue={{ start: july14, end: july17 }} />);
    await expect.element(page.getByRole("grid")).toBeVisible();
    expect(calendarRoot().querySelector("[slot='errorMessage']")).toBeNull();
  });

  it("greys a fully disabled calendar's pills with the muted-foreground token", async () => {
    renderRangeCalendar(<RangeCalendar defaultValue={{ start: july14, end: july17 }} isDisabled />);
    await expect.element(page.getByRole("grid")).toBeVisible();
    expect(getComputedStyle(pillOf(dayNumbered(14))).color).toBe(
      cssVarColor(pillOf(dayNumbered(14)), "--muted-foreground")
    );
  });

  it("paints the shared state ring on the pill of the focused day at both densities", async () => {
    renderRangeCalendar(
      <>
        <button type="button">Before</button>
        <RangeCalendar defaultFocusedValue={july14} minValue={july13} maxValue={july17} />
      </>
    );
    await expect.element(page.getByRole("grid")).toBeVisible();
    const day = dayNumbered(14);
    await assertStateFocusRingAtBothDensities(buttonNamed("Before"), day, pillOf(day));
  });
});
