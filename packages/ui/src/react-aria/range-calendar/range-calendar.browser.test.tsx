import type { ReactNode } from "react";

import { CalendarDate, isSameDay, isWeekend } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";
import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertStateFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import {
  accessibleRangeHeading,
  anchorAndExtend,
  calendarGrid,
  calendarRoot,
  cellNumbered,
  dayBands,
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

function selectedDayNumbers(): string[] {
  return dayBands()
    .filter((element) => element.hasAttribute("data-selected"))
    .map((element) => element.textContent.trim());
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
const july20 = new CalendarDate(2026, 7, 20);
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
    expect(
      [...calendarGrid().querySelectorAll("thead th")].map((cell) => cell.textContent.trim()).join("")
    ).toBe("SMTWTFS");
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

  it("renders borderless standalone — the picker dialog supplies the chrome (§8.5)", async () => {
    renderRangeCalendar(<RangeCalendar defaultValue={{ start: july14, end: july17 }} />);
    await expect.element(page.getByRole("grid")).toBeVisible();
    const style = getComputedStyle(calendarRoot());
    expect(style.borderTopWidth).toBe("0px");
    expect(style.borderBottomWidth).toBe("0px");
    expect(style.borderLeftWidth).toBe("0px");
    expect(style.borderRightWidth).toBe("0px");
    expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(style.boxShadow).toBe("none");
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

  it("restores the previous value when Escape cancels an in-progress selection", async () => {
    const onChange = rangeChangeSpy();
    renderRangeCalendar(
      <RangeCalendar
        defaultValue={{ start: july20, end: july22 }}
        defaultFocusedValue={july14}
        onChange={onChange}
      />
    );
    await expect.element(page.getByRole("grid")).toBeVisible();
    expect(selectedDayNumbers()).toEqual(["20", "21", "22"]);

    dayNumbered(14).focus();
    await anchorAndExtend({ anchor: 14, arrows: 3, landsOn: 18 });
    expect(selectedDayNumbers()).toEqual(["14", "15", "16", "17", "18"]);

    await userEvent.keyboard("{Escape}");
    expect(onChange).not.toHaveBeenCalled();
    expect(selectedDayNumbers()).toEqual(["20", "21", "22"]);
    expect(cellNumbered(20)).toHaveAttribute("aria-selected", "true");
    expect(cellNumbered(14).getAttribute("aria-selected")).not.toBe("true");
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

  it("keeps a keyboard range contiguous across an unavailable date by default", async () => {
    const onChange = rangeChangeSpy();
    renderRangeCalendar(
      <RangeCalendar
        defaultFocusedValue={july14}
        isDateUnavailable={(date) => isSameDay(date, july16)}
        onChange={onChange}
      />
    );
    await expect.element(page.getByRole("grid")).toBeVisible();
    expect(cellNumbered(16)).toHaveAttribute("aria-disabled", "true");
    expect(dayNumbered(16)).toHaveAttribute("data-unavailable");

    dayNumbered(14).focus();
    // While anchored, the default rule disables every day past the unavailable one, so
    // the arrows cannot carry the focus beyond July 15.
    await anchorAndExtend({ anchor: 14, arrows: 3, landsOn: 15 });
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    // The default non-contiguous rule clamps the highlight before the unavailable day.
    const committed = committedRange(onChange);
    expect(isSameDay(committed.start, july14)).toBe(true);
    expect(isSameDay(committed.end, new CalendarDate(2026, 7, 15))).toBe(true);
  });

  it("lets the range span the unavailable date once allowsNonContiguousRanges is set", async () => {
    const onChange = rangeChangeSpy();
    renderRangeCalendar(
      <RangeCalendar
        defaultFocusedValue={july14}
        isDateUnavailable={(date) => isSameDay(date, july16)}
        allowsNonContiguousRanges
        onChange={onChange}
      />
    );
    await expect.element(page.getByRole("grid")).toBeVisible();

    dayNumbered(14).focus();
    await anchorAndExtend({ anchor: 14, arrows: 3, landsOn: 18 });
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    const committed = committedRange(onChange);
    expect(isSameDay(committed.start, july14)).toBe(true);
    expect(isSameDay(committed.end, july18)).toBe(true);
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

  it("disables out-of-range cells and clamps month navigation at minValue and maxValue", async () => {
    renderRangeCalendar(<RangeCalendar defaultFocusedValue={july14} minValue={july13} maxValue={july17} />);
    await expect.element(page.getByRole("grid")).toBeVisible();

    expect(cellNumbered(14).getAttribute("aria-disabled")).not.toBe("true");
    expect(cellNumbered(10)).toHaveAttribute("aria-disabled", "true");
    expect(dayNumbered(10)).toHaveAttribute("data-disabled");
    expect(cellNumbered(18)).toHaveAttribute("aria-disabled", "true");
    expect(dayNumbered(18)).toHaveAttribute("data-disabled");

    const previous = navButtonNamed(/previous/i);
    const next = navButtonNamed(/next/i);
    expect(previous).toHaveAttribute("data-disabled");
    expect(next).toHaveAttribute("data-disabled");
    expect(previous.hasAttribute("disabled") || previous.getAttribute("aria-disabled")).toBeTruthy();
    expect(next.hasAttribute("disabled") || next.getAttribute("aria-disabled")).toBeTruthy();

    const before = visibleMonthTitle().textContent;
    await userEvent.click(previous, { force: true });
    expect(visibleMonthTitle().textContent).toBe(before);
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
