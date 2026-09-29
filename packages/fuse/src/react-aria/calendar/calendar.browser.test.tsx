import type { ReactNode } from "react";

import { CalendarDate } from "@internationalized/date";
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
