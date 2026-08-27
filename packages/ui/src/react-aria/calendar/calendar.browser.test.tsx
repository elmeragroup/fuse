import type { ReactNode } from "react";

import { CalendarDate, isWeekend } from "@internationalized/date";
import { I18nProvider } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { renderThemed } from "../../../test/themed-browser-render";
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

function grid(): HTMLElement {
  const element = page.getByRole("grid").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected calendar grid");
  }
  return element;
}

function calendarRoot(): HTMLElement {
  const element = page.getByRole("application").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected RAC calendar root");
  }
  return element;
}

function headingCandidates(): HTMLElement[] {
  const root = calendarRoot();
  return page
    .getByRole("heading", { includeHidden: true })
    .elements()
    .filter((element): element is HTMLElement => element instanceof HTMLElement && root.contains(element));
}

function visiblePublicHeading(): HTMLElement {
  const match = headingCandidates().find((element) => element.getAttribute("aria-hidden") === "true");
  if (match === undefined) {
    throw new Error("expected visible public Calendar heading");
  }
  return match;
}

function accessibleRangeHeading(): HTMLElement {
  const match = headingCandidates().find((element) => element.getAttribute("aria-hidden") !== "true");
  if (match === undefined) {
    throw new Error("expected accessible Calendar range heading");
  }
  return match;
}

function gridVisibleRangeLabel(): string {
  return grid().getAttribute("aria-label") ?? "";
}

function isCalendarNavButton(
  element: Element,
  root: HTMLElement,
  gridEl: HTMLElement
): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    root.contains(element) &&
    !gridEl.contains(element) &&
    element.childElementCount > 0
  );
}

function navButtons(): HTMLElement[] {
  const root = calendarRoot();
  const gridEl = grid();
  return page
    .getByRole("button")
    .elements()
    .filter((element) => isCalendarNavButton(element, root, gridEl));
}

function previousButton(): HTMLElement {
  const root = calendarRoot();
  const gridEl = grid();
  const match = page
    .getByRole("button", { name: /previous/i })
    .elements()
    .find((element) => isCalendarNavButton(element, root, gridEl));
  if (match === undefined) {
    throw new Error("expected previous button");
  }
  return match;
}

function nextButton(): HTMLElement {
  const root = calendarRoot();
  const gridEl = grid();
  const match = page
    .getByRole("button", { name: /next/i })
    .elements()
    .find((element) => isCalendarNavButton(element, root, gridEl));
  if (match === undefined) {
    throw new Error("expected next button");
  }
  return match;
}

function buttonNamed(name: string | RegExp): HTMLElement {
  const element = page.getByRole("button", { name }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected button ${String(name)}`);
  }
  return element;
}

function cellNamed(name: string | RegExp): HTMLElement {
  const element = page.getByRole("gridcell", { name }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected gridcell ${String(name)}`);
  }
  return element;
}

function dayNamed(name: string | RegExp): HTMLElement {
  const element = page.getByRole("button", { name }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected day ${String(name)}`);
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
    expect(calendarRoot().contains(grid())).toBe(true);
    expect(cells().length).toBeGreaterThan(27);
    expect(grid().textContent).toContain("Sun");
    expect(grid().textContent).not.toContain("Sunday");
    await expect.element(previousButton()).toBeVisible();
    await expect.element(nextButton()).toBeVisible();

    const hiddenHeadings = headingCandidates().filter(
      (element) => element.getAttribute("aria-hidden") === "true"
    );
    const accessibleHeadings = headingCandidates().filter(
      (element) => element.getAttribute("aria-hidden") !== "true"
    );
    expect(hiddenHeadings).toHaveLength(1);
    expect(accessibleHeadings).toHaveLength(1);

    const visibleTitle = visiblePublicHeading();
    await expect.element(visibleTitle).toBeVisible();
    expect(visibleTitle).toHaveAttribute("aria-hidden", "true");
    expect(visibleTitle.getAttribute("aria-live")).toBeNull();
    expect(visibleTitle.getAttribute("data-slot")).toBe("heading");
    expect(visibleTitle.className.split(/\s+/)).toEqual(expect.arrayContaining(["font-heading", "text-lg"]));
    expect(visibleTitle.textContent).toMatch(/July\s+2026/i);

    const accessibleRange = accessibleRangeHeading();
    expect(accessibleRange).not.toBe(visibleTitle);
    expect(accessibleRange.getAttribute("aria-hidden")).not.toBe("true");
    expect(accessibleRange.textContent).toMatch(/July\s+2026/i);

    const visibleRangeLabel = gridVisibleRangeLabel();
    expect(visibleRangeLabel).not.toBe("");
    expect(visibleRangeLabel).toMatch(/July\s+2026/i);
    expect(grid().getAttribute("aria-labelledby")).toBeNull();
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
    expect(visiblePublicHeading().textContent).toMatch(/July\s+2026/i);
    expect(accessibleRangeHeading().textContent).toMatch(/July\s+2026/i);
    expect(gridVisibleRangeLabel()).toMatch(/July\s+2026/i);
    dayNamed(/Tuesday, July 14, 2026/i).focus();
    await userEvent.keyboard("{PageDown}");
    expect(visiblePublicHeading().textContent).toMatch(/August\s+2026/i);
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
    await expect.element(previousButton()).toBeVisible();
    expect(previousButton()).toHaveAttribute("data-disabled");
    expect(nextButton()).toHaveAttribute("data-disabled");
    expect(
      previousButton().hasAttribute("disabled") || previousButton().getAttribute("aria-disabled")
    ).toBeTruthy();
    expect(nextButton().hasAttribute("disabled") || nextButton().getAttribute("aria-disabled")).toBeTruthy();
  });

  it("renders CaretRight inside the previous button under an RTL locale", async () => {
    renderCalendar(
      <>
        <span role="img" aria-label="CaretLeft glyph">
          <CaretLeft aria-hidden />
        </span>
        <span role="img" aria-label="CaretRight glyph">
          <CaretRight aria-hidden />
        </span>
        <I18nProvider locale="ar-EG">
          <Calendar defaultValue={july14} />
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
    const root = calendarRoot();
    const describedBy = root.getAttribute("aria-describedby");
    expect(describedBy, "Calendar root must reference errorMessage when invalid").toBeTruthy();
    if (describedBy === null) {
      throw new Error("expected Calendar root aria-describedby");
    }
    const described = describedBy
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => root.ownerDocument.getElementById(id))
      .filter((node): node is HTMLElement => node instanceof HTMLElement);
    const textHost = described.find((target) => target.contains(errorNode));
    expect(textHost, "errorMessage must be associated via aria-describedby when invalid").toBeTruthy();
    if (textHost === undefined) {
      throw new Error("expected described RAC Text host");
    }
    expect(textHost.contains(errorNode)).toBe(true);
    expect(textHost.getAttribute("data-slot")).toBe("text");
    expect(textHost.textContent).toBe("That day is closed.");
    expect(textHost.className.split(/\s+/)).toEqual(expect.arrayContaining(["text-error", "font-sans"]));
  });

  it("paints the shared self ring on previous navigation at both densities", async () => {
    renderCalendar(
      <>
        <button type="button">Before</button>
        <Calendar defaultValue={july14} defaultFocusedValue={july14} />
      </>
    );
    await expect.element(previousButton()).toBeVisible();
    await assertFocusRingAtBothDensities(buttonNamed("Before"), previousButton());
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
    expect(calendarRoot().className.split(/\s+/)).toEqual(
      expect.arrayContaining(["bg-card", "border-border", "min-w-40"])
    );
  });
});
