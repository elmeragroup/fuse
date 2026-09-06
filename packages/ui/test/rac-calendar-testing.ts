import { expect, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

/**
 * Shared browser-test vocabulary for the RAC calendar surfaces — Calendar, RangeCalendar
 * and the two pickers that put one of them inside a popover. Every suite reaches the same
 * DOM through the same role queries, so the mechanism notes below live here once instead
 * of once per suite.
 *
 * Nothing here asserts; these are locators plus the two interaction helpers that have to
 * wait out RAC's asynchronous focus moves.
 */

/** The RAC calendar root. RAC gives it `role="application"`. */
export function calendarRoot(): HTMLElement {
  const element = page.getByRole("application").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the RAC calendar root");
  }
  return element;
}

/** The month table inside the root. */
export function calendarGrid(): HTMLElement {
  const element = page.getByRole("grid").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the calendar grid");
  }
  return element;
}

/**
 * Both heading faces inside the root. RAC renders two: the visible month/year title it
 * marks `aria-hidden` (because the grid's own label already names the month), and a
 * visually-hidden accessible heading carrying the visible range.
 */
export function calendarHeadings(): HTMLElement[] {
  const root = calendarRoot();
  return page
    .getByRole("heading", { includeHidden: true })
    .elements()
    .filter((element): element is HTMLElement => element instanceof HTMLElement && root.contains(element));
}

/** The visible month title — the `aria-hidden` face of the pair above. */
export function visibleMonthTitle(): HTMLElement {
  const match = calendarHeadings().find((element) => element.getAttribute("aria-hidden") === "true");
  if (match === undefined) {
    throw new Error("expected the calendar's visible month title");
  }
  return match;
}

/** The accessible visible-range heading — the face that is not `aria-hidden`. */
export function accessibleRangeHeading(): HTMLElement {
  const match = calendarHeadings().find((element) => element.getAttribute("aria-hidden") !== "true");
  if (match === undefined) {
    throw new Error("expected the accessible calendar range heading");
  }
  return match;
}

/**
 * The visible month-navigation buttons, in DOM order.
 *
 * RAC renders a second, screen-reader-only pair with the same accessible names, so the
 * visible ones are picked structurally: inside the calendar root, outside the day grid,
 * and wrapping a glyph element rather than bare text.
 */
export function navButtons(): HTMLElement[] {
  const root = calendarRoot();
  const grid = calendarGrid();
  return page
    .getByRole("button")
    .elements()
    .filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        root.contains(element) &&
        !grid.contains(element) &&
        element.childElementCount > 0
    );
}

/** One visible month-navigation button, by accessible name. */
export function navButtonNamed(name: string | RegExp): HTMLElement {
  const visible = new Set<Element>(navButtons());
  const match = page
    .getByRole("button", { name })
    .elements()
    .find((element) => visible.has(element));
  if (!(match instanceof HTMLElement)) {
    throw new Error(`expected navigation button ${String(name)}`);
  }
  return match;
}

/** One day, by its RAC accessible name. Days are `role="button"`. */
export function dayNamed(name: string | RegExp): HTMLElement {
  const element = page.getByRole("button", { name }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected day ${String(name)}`);
  }
  return element;
}

/** One day's `td`, by its RAC accessible name. Cells are `role="gridcell"`. */
export function cellNamed(name: string | RegExp): HTMLElement {
  const element = page.getByRole("gridcell", { name }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected gridcell ${String(name)}`);
  }
  return element;
}

/** Every day band in the grid — RAC gives each one `role="button"`. */
export function dayBands(): HTMLElement[] {
  const grid = calendarGrid();
  return page
    .getByRole("button")
    .elements()
    .filter((element): element is HTMLElement => element instanceof HTMLElement && grid.contains(element));
}

/**
 * The focusable band for a day of the visible month.
 *
 * Days are addressed by the date they render rather than by accessible name: RAC folds
 * the whole selected-range description into every day's `aria-label`, so a name query for
 * one endpoint also matches the other. The band is still reached through its `button`
 * role, and its label is asserted where the label itself is the subject.
 */
export function dayNumbered(day: number): HTMLElement {
  const matches = dayBands().filter(
    (element) => !element.hasAttribute("data-outside-month") && element.textContent.trim() === String(day)
  );
  const [match] = matches;
  if (matches.length !== 1 || match === undefined) {
    throw new Error(`expected exactly one day ${day} in the visible month, found ${matches.length}`);
  }
  return match;
}

/** The `td` RAC gives `role="gridcell"` and `aria-selected`, for a day of the visible month. */
export function cellNumbered(day: number): HTMLElement {
  const cell = dayNumbered(day).closest("td");
  if (!(cell instanceof HTMLElement) || cell.getAttribute("role") !== "gridcell") {
    throw new Error(`expected a gridcell around day ${day}`);
  }
  return cell;
}

/**
 * Settle on RAC's focused day before the next keystroke is sent.
 *
 * `useCalendarCell` moves DOM focus from an effect that runs after the focused-date state
 * has committed, and the anchoring Enter reaches RAC through `usePress`' document-level
 * `keyup` listener — outside React's event system, so that commit is batched instead of
 * flushed with the key. A key sent before the move lands is still handled by the grid
 * handler of the previous render, whose `focusNextDay` counts from the stale day, and the
 * range ends up a day short.
 */
export async function focusLandsOnDay(day: number): Promise<void> {
  await vi.waitFor(() => {
    expect(document.activeElement).toBe(dayNumbered(day));
  });
}

/**
 * Park the virtual pointer off the day grid before a keyboard anchor.
 *
 * The pointer keeps the screen position the last click left it at, and every test mounts a
 * fresh host underneath it, so a day cell can sit under a stationary cursor. Chromium
 * re-delivers a boundary event to whatever is under that cursor when the DOM below it
 * changes, `useCalendarCell`'s `onPointerEnter` answers one with `state.highlightDate(date)`,
 * and `useRangeCalendarState.highlightDate` calls `setFocusedDate` whenever a range is
 * anchored — so a hovered cell steals the focus the arrow keys count from. Hovering a
 * non-cell element leaves no cell under the pointer for that to happen to.
 */
export async function parkPointerOffGrid(): Promise<void> {
  await userEvent.hover(visibleMonthTitle());
}

/**
 * Anchor the highlighted range on the focused `anchor` day and extend it with `arrows`
 * ArrowRight presses, waiting out RAC's asynchronous focus moves on both ends. `landsOn`
 * is the day the focus ends on: normally `anchor + 1 + arrows`, but fewer when RAC
 * disables the days past an unavailable one. Committing the highlight with a second Enter
 * is left to the caller.
 */
export async function anchorAndExtend({
  anchor,
  arrows,
  landsOn,
}: {
  anchor: number;
  arrows: number;
  landsOn: number;
}): Promise<void> {
  await parkPointerOffGrid();
  await userEvent.keyboard("{Enter}");
  // RAC auto-advances the focused day once the anchor is set, so the arrows extend the
  // highlight from the day after the anchor.
  await focusLandsOnDay(anchor + 1);
  await userEvent.keyboard("{ArrowRight}".repeat(arrows));
  await focusLandsOnDay(landsOn);
}

/** The distinct, non-empty texts an element's `aria-describedby` points at. */
export function describedTextsFor(element: HTMLElement): string[] {
  const ids = (element.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  return [
    ...new Set(ids.map((id) => document.getElementById(id)?.textContent ?? "").filter((text) => text !== "")),
  ];
}
