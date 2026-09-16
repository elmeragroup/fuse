import type { ReactNode } from "react";

import { CalendarDate, isWeekend } from "@internationalized/date";
import { I18nProvider } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import {
  accessibleRangeHeading,
  calendarGrid,
  calendarHeadings,
  calendarRoot,
  cellNamed,
  dayNamed,
  navButtonNamed,
  navButtons,
  visibleMonthTitle,
} from "../../../test/rac-calendar-testing";
import { cssVarColor, px, renderThemed } from "../../../test/themed-browser-render";
import { CaretLeft } from "../../icons/generated/caret-left";
import { CaretRight } from "../../icons/generated/caret-right";
import { UiProviders } from "../ui-providers/ui-providers";
import { Calendar } from "./calendar";

function renderCalendar(node: ReactNode) {
  return renderThemed(
    <UiProviders locale="en-US" navigate={() => undefined}>
      {node}
    </UiProviders>
  );
}

function gridVisibleRangeLabel(): string {
  return calendarGrid().getAttribute("aria-label") ?? "";
}

function buttonNamed(name: string | RegExp): HTMLElement {
  const element = page.getByRole("button", { name }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected button ${String(name)}`);
  }
  return element;
}

function cells(): HTMLElement[] {
  return page
    .getByRole("gridcell")
    .elements()
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
}

function glyphNamed(name: string): string {
  const element = page.getByRole("img", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected glyph ${name}`);
  }
  return element.innerHTML;
}

const july14 = new CalendarDate(2026, 7, 14);
const july1 = new CalendarDate(2026, 7, 1);
const july31 = new CalendarDate(2026, 7, 31);

describe("Calendar", () => {
  it("exposes an application root containing a grid, weekday columnheaders, day cells, nav buttons, and RAC's two heading faces", async () => {
    renderCalendar(<Calendar defaultValue={july14} />);
    await expect.element(page.getByRole("application")).toBeVisible();
    await expect.element(page.getByRole("grid")).toBeVisible();
    expect(calendarRoot().contains(calendarGrid())).toBe(true);
    expect(cells().length).toBeGreaterThan(27);
    expect(calendarGrid().textContent).toContain("Sun");
    expect(calendarGrid().textContent).not.toContain("Sunday");
    await expect.element(navButtonNamed(/previous/i)).toBeVisible();
    await expect.element(navButtonNamed(/next/i)).toBeVisible();

    const hiddenHeadings = calendarHeadings().filter(
      (element) => element.getAttribute("aria-hidden") === "true"
    );
    const accessibleHeadings = calendarHeadings().filter(
      (element) => element.getAttribute("aria-hidden") !== "true"
    );
    expect(hiddenHeadings).toHaveLength(1);
    expect(accessibleHeadings).toHaveLength(1);

    const visibleTitle = visibleMonthTitle();
    await expect.element(visibleTitle).toBeVisible();
    expect(visibleTitle).toHaveAttribute("aria-hidden", "true");
    expect(visibleTitle.getAttribute("aria-live")).toBeNull();
    expect(visibleTitle.getAttribute("data-slot")).toBe("heading");
    expect(px(getComputedStyle(visibleTitle).fontSize)).toBe(18);
    expect(visibleTitle.textContent).toMatch(/July\s+2026/i);

    const accessibleRange = accessibleRangeHeading();
    expect(accessibleRange).not.toBe(visibleTitle);
    expect(accessibleRange.getAttribute("aria-hidden")).not.toBe("true");
    expect(accessibleRange.textContent).toMatch(/July\s+2026/i);

    const visibleRangeLabel = gridVisibleRangeLabel();
    expect(visibleRangeLabel).not.toBe("");
    expect(visibleRangeLabel).toMatch(/July\s+2026/i);
    expect(calendarGrid().getAttribute("aria-labelledby")).toBeNull();
  });

  it("moves day focus with ArrowRight and week focus with ArrowDown", async () => {
    renderCalendar(
      <>
        <button type="button">Before</button>
        <Calendar defaultValue={july14} defaultFocusedValue={july14} />
      </>
    );
    await expect.element(page.getByRole("gridcell", { name: /Tuesday, July 14, 2026/i })).toBeVisible();
    dayNamed(/Tuesday, July 14, 2026/i).focus();
    expect(document.activeElement).toBe(dayNamed(/Tuesday, July 14, 2026/i));
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(dayNamed(/Wednesday, July 15, 2026/i));
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(dayNamed(/Wednesday, July 22, 2026/i));
  });

  it("advances the month with PageDown and updates both heading faces", async () => {
    renderCalendar(<Calendar defaultValue={july14} defaultFocusedValue={july14} />);
    await expect.element(page.getByRole("application")).toBeVisible();
    expect(visibleMonthTitle().textContent).toMatch(/July\s+2026/i);
    expect(accessibleRangeHeading().textContent).toMatch(/July\s+2026/i);
    expect(gridVisibleRangeLabel()).toMatch(/July\s+2026/i);
    dayNamed(/Tuesday, July 14, 2026/i).focus();
    await userEvent.keyboard("{PageDown}");
    expect(visibleMonthTitle().textContent).toMatch(/August\s+2026/i);
    expect(accessibleRangeHeading().textContent).toMatch(/August\s+2026/i);
    expect(gridVisibleRangeLabel()).toMatch(/August\s+2026/i);
    await expect.element(page.getByRole("gridcell", { name: /August 14, 2026/i })).toBeVisible();
  });

  it("selects with Enter and fires onChange with a DateValue, not an event", async () => {
    const onChange = vi.fn();
    renderCalendar(<Calendar defaultValue={july14} defaultFocusedValue={july14} onChange={onChange} />);
    await expect.element(page.getByRole("gridcell", { name: /14/ })).toBeVisible();
    dayNamed(/Wednesday, July 15, 2026/i).focus();
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ year: 2026, month: 7, day: 15 })
    );
    expect(onChange.mock.calls.at(-1)?.[0]).not.toHaveProperty("nativeEvent");
    expect(onChange.mock.calls.at(-1)?.[0]).not.toBeInstanceOf(Event);
  });

  it("marks the selected cell aria-selected=true", async () => {
    renderCalendar(<Calendar defaultValue={july14} />);
    await expect.element(page.getByRole("gridcell", { name: /14/ })).toBeVisible();
    const selected = cellNamed(/Tuesday, July 14, 2026/i);
    expect(selected).toHaveAttribute("aria-selected", "true");
    const unselected = cellNamed(/Wednesday, July 15, 2026/i);
    expect(unselected.getAttribute("aria-selected")).not.toBe("true");
  });

  it("marks unavailable weekend cells aria-disabled and does not select them", async () => {
    const onChange = vi.fn();
    renderCalendar(
      <Calendar
        defaultValue={july14}
        defaultFocusedValue={july14}
        isDateUnavailable={(date) => isWeekend(date, "en-US")}
        onChange={onChange}
      />
    );
    await expect.element(page.getByRole("gridcell", { name: /Saturday, July 18, 2026/i })).toBeVisible();
    const saturday = cellNamed(/Saturday, July 18, 2026/i);
    const sunday = cellNamed(/Sunday, July 19, 2026/i);
    expect(saturday).toHaveAttribute("aria-disabled", "true");
    expect(sunday).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(page.getByRole("button", { name: /Saturday, July 18, 2026/i }), {
      force: true,
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(cellNamed(/Tuesday, July 14, 2026/i)).toHaveAttribute("aria-selected", "true");
  });

  it("disables previous and next at min and max bounds", async () => {
    renderCalendar(
      <Calendar defaultValue={july14} defaultFocusedValue={july14} minValue={july1} maxValue={july31} />
    );
    await expect.element(navButtonNamed(/previous/i)).toBeVisible();
    expect(navButtonNamed(/previous/i)).toHaveAttribute("data-disabled");
    expect(navButtonNamed(/next/i)).toHaveAttribute("data-disabled");
    expect(
      navButtonNamed(/previous/i).hasAttribute("disabled") ||
        navButtonNamed(/previous/i).getAttribute("aria-disabled")
    ).toBeTruthy();
    expect(
      navButtonNamed(/next/i).hasAttribute("disabled") ||
        navButtonNamed(/next/i).getAttribute("aria-disabled")
    ).toBeTruthy();
  });

  it("lays out RTL columns and mirrors navigation and keyboard date movement", async () => {
    const onChange = vi.fn();
    renderCalendar(
      <>
        <span role="img" aria-label="CaretLeft glyph">
          <CaretLeft aria-hidden />
        </span>
        <span role="img" aria-label="CaretRight glyph">
          <CaretRight aria-hidden />
        </span>
        <I18nProvider locale="ar-EG">
          <Calendar defaultValue={july14} onChange={onChange} />
        </I18nProvider>
      </>
    );
    await expect.element(page.getByRole("application")).toBeVisible();
    const [previous, next] = navButtons();
    if (previous === undefined || next === undefined) {
      throw new Error("expected previous and next navigation buttons");
    }
    expect(previous.innerHTML).toBe(glyphNamed("CaretRight glyph"));
    expect(previous.innerHTML).not.toBe(glyphNamed("CaretLeft glyph"));
    expect(next.innerHTML).toBe(glyphNamed("CaretLeft glyph"));
    expect(previous.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(getComputedStyle(calendarGrid()).direction).toBe("rtl");
    // DOM audit: RAC marks weekday headings as presentation; inspect their rendered column order.
    const headers = [...calendarGrid().querySelectorAll("thead th")];
    expect(headers).toHaveLength(7);
    expect(headers[0]?.getBoundingClientRect().left).toBeGreaterThan(
      headers[6]?.getBoundingClientRect().left ?? 0
    );
    // The selected cell's button receives ArrowLeft, which must advance one day in RTL.
    const selected = cells().find((cell) => cell.getAttribute("aria-selected") === "true");
    const day = selected?.querySelector('[role="button"]');
    if (!(day instanceof HTMLElement)) throw new Error("Expected the selected day button");
    day.focus();
    await userEvent.keyboard("{ArrowLeft}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(july14.add({ days: 1 }));
  });

  it("renders a ReactNode error and references it through aria-describedby when invalid", async () => {
    renderCalendar(
      <Calendar
        defaultValue={july14}
        isInvalid
        errorMessage={
          <span role="status" aria-label="Calendar error details">
            That day is closed.
          </span>
        }
      />
    );
    const error = page.getByRole("status", { name: "Calendar error details" });
    await expect.element(error).toBeVisible();
    const errorNode = error.element();
    if (!(errorNode instanceof HTMLElement)) {
      throw new Error("expected error node");
    }

    const textHost = errorNode.parentElement;
    if (!(textHost instanceof HTMLElement)) {
      throw new Error("expected the RAC Text host");
    }
    expect(textHost.getAttribute("data-slot")).toBe("text");
    expect(textHost.getAttribute("slot")).toBe("errorMessage");
    expect(textHost.textContent).toBe("That day is closed.");
    expect(getComputedStyle(textHost).color).toBe(cssVarColor(textHost, "--error"));

    // RAC wires the errorMessage slot to the invalid selected day, not to the root:
    // `useCalendarBase` hands the id to `useCalendarCell`, which is where an AT reading
    // the day hears why it cannot be used.
    const describedBy = dayNamed(/Tuesday, July 14, 2026/i).getAttribute("aria-describedby");
    expect(describedBy, "the invalid day must reference the errorMessage").toBeTruthy();
    expect(describedBy?.split(/\s+/)).toContain(textHost.id);
  });

  it("passes a caller's aria-describedby through to the RAC root", async () => {
    renderCalendar(
      <>
        <p id="calendar-hint">Weekdays only.</p>
        <Calendar aria-describedby="calendar-hint" defaultValue={july14} />
      </>
    );
    await expect.element(page.getByRole("grid")).toBeVisible();

    expect(calendarRoot().getAttribute("aria-describedby")).toBe("calendar-hint");
  });

  it("paints the shared self ring on previous navigation at both densities", async () => {
    renderCalendar(
      <>
        <button type="button">Before</button>
        <Calendar defaultValue={july14} defaultFocusedValue={july14} />
      </>
    );
    await expect.element(navButtonNamed(/previous/i)).toBeVisible();
    await assertFocusRingAtBothDensities(buttonNamed("Before"), navButtonNamed(/previous/i));
  });

  it("paints the shared state ring on the focused day at both densities", async () => {
    renderCalendar(
      <>
        <button type="button">Before</button>
        <Calendar defaultValue={july14} defaultFocusedValue={july14} minValue={july1} maxValue={july31} />
      </>
    );
    await expect.element(page.getByRole("button", { name: /Tuesday, July 14, 2026/i })).toBeVisible();
    await assertFocusRingAtBothDensities(buttonNamed("Before"), dayNamed(/Tuesday, July 14, 2026/i));
  });

  it("composes a stateful className under the calendar surface classes", async () => {
    renderCalendar(
      <Calendar
        defaultValue={july14}
        className={(renderProps) => (renderProps.isDisabled ? "opacity-80" : "min-w-40")}
      />
    );
    await expect.element(page.getByRole("grid")).toBeVisible();
    expect(calendarRoot().className).toContain("min-w-40");
    expect(getComputedStyle(calendarRoot()).backgroundColor).toBe(cssVarColor(calendarRoot(), "--card"));
  });
});
