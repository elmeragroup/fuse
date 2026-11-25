import { expect } from "vitest";
import { page, userEvent } from "vitest/browser";

import { DENSITIES } from "../src/theme/density";
import type { Density } from "../src/theme/density";
import { stampDensity } from "./themed-browser-render";

/** Layout rounds lengths to 1/64px, so a part flush against a box's edge may measure a hair past it. */
const EPSILON = 0.5;

/** The focusable segments of a scope, in document order, whatever `data-slot` or `data-type` they carry. */
const SEGMENTS = '[role="spinbutton"], [role="textbox"]';

/** The field box around the rows, DateField's box itself or a picker's group. */
const BOX = '[data-slot="field-group"]';

/** A segment row: a picker's input row, or DateField's box, which is its own row. */
const ROW = `[data-slot="date-picker-input"], ${BOX}`;

/**
 * The box's padding box, where it paints its content, in viewport pixels. `scale` is the painted
 * size over the layout size that a transform on an ancestor gives, which `clientLeft` and
 * `clientWidth` do not include.
 */
function paddingBox(box: Element, scale: number) {
  const outer = box.getBoundingClientRect();
  const left = outer.left + box.clientLeft * scale;
  const top = outer.top + box.clientTop * scale;
  return { left, top, right: left + box.clientWidth * scale, bottom: top + box.clientHeight * scale };
}

/** Asserts that `part` lies inside `box`'s padding box, so nothing of it is cut off. */
function expectInside(part: Element, box: Element, at: string, scale: number): void {
  const rect = part.getBoundingClientRect();
  const clip = paddingBox(box, scale);
  expect(rect.left, `${at}, left`).toBeGreaterThanOrEqual(clip.left - EPSILON);
  expect(rect.top, `${at}, top`).toBeGreaterThanOrEqual(clip.top - EPSILON);
  expect(rect.right, `${at}, right`).toBeLessThanOrEqual(clip.right + EPSILON);
  expect(rect.bottom, `${at}, bottom`).toBeLessThanOrEqual(clip.bottom + EPSILON);
}

/** The row and the field box around a segment, failing when either is missing. */
function rowAndBox(segment: Element, label: string) {
  const row = segment.closest<HTMLElement>(ROW);
  const box = segment.closest<HTMLElement>(BOX);
  if (row === null || box === null) {
    throw new Error(`${label}: the segment's row and box`);
  }
  return { row, box };
}

/**
 * The focusable segments of a scope, failing unless there are `expected` of them.
 *
 * @param scope - The element around the field.
 * @param expected - How many focusable segments the scope renders.
 * @param label - The assertion label.
 * @returns The segments, in document order.
 */
export function segmentsOf(scope: ParentNode, expected: number, label: string): HTMLElement[] {
  const segments = [...scope.querySelectorAll<HTMLElement>(SEGMENTS)];
  expect(segments, `${label}: segments`).toHaveLength(expected);
  return segments;
}

/**
 * The last focusable segment of a scope, failing unless the scope has `expected` of them.
 *
 * @param scope - The element around the field.
 * @param expected - How many focusable segments the scope renders.
 * @param label - The assertion label.
 * @returns The last segment in document order.
 */
export function lastSegmentOf(scope: ParentNode, expected: number, label: string): HTMLElement {
  const last = segmentsOf(scope, expected, label).at(-1);
  if (last === undefined) {
    throw new Error(`${label}: the last segment`);
  }
  return last;
}

/**
 * Runs a check at each density. The `afterEach` in `themed-browser-render.tsx` removes the density
 * stamp after the test.
 *
 * @param check - The check, given the density.
 */
export async function atEachDensity(check: (density: Density) => void | Promise<void>): Promise<void> {
  for (const density of DENSITIES) {
    stampDensity(density);
    await check(density);
  }
}

/**
 * Asserts that the focused element is `segment` and that it lies whole inside its row and the field
 * box, measured against their own padding boxes.
 *
 * @param segment - The segment that should hold focus.
 * @param label - The assertion label.
 * @param scale - The scale a transform on an ancestor paints the field at.
 */
export function expectFocusedSegmentShows(segment: HTMLElement, label: string, scale = 1): void {
  expect(document.activeElement, `${label}: focus`).toBe(segment);
  const { row, box } = rowAndBox(segment, label);
  const at = `${label}: "${segment.textContent}"`;
  expectInside(segment, row, `${at} in its row`, scale);
  expectInside(segment, box, `${at} in the box`, scale);
}

/**
 * Asserts that focus reaches each focusable segment of a scope by ArrowRight in the reading order,
 * and that each focused segment lies whole inside its row and the field box.
 *
 * @param scope - The element around the field, such as the narrow box it sits in.
 * @param expected - How many focusable segments the scope renders, so a missing case fails.
 * @param label - The assertion label.
 * @param scale - The scale a transform on an ancestor paints the field at.
 */
export async function expectArrowedSegmentsShow(
  scope: HTMLElement,
  expected: number,
  label: string,
  scale = 1
): Promise<void> {
  const segments = segmentsOf(scope, expected, label);
  segments[0]?.focus();
  for (const [index, segment] of segments.entries()) {
    if (index > 0) {
      await userEvent.keyboard("{ArrowRight}");
    }
    expectFocusedSegmentShows(segment, `${label} segment ${String(index)}`, scale);
  }
}

/**
 * Asserts that each focusable segment of a scope, focused in turn, lies whole inside its row and
 * the field box.
 *
 * @param scope - The element around the field.
 * @param expected - How many focusable segments the scope renders.
 * @param label - The assertion label.
 */
export function expectFocusedSegmentsShow(scope: HTMLElement, expected: number, label: string): void {
  for (const [index, segment] of segmentsOf(scope, expected, label).entries()) {
    segment.focus();
    expectFocusedSegmentShows(segment, `${label} segment ${String(index)}`);
  }
}

/**
 * Asserts that a row scrolled to show its focused `segment` scrolls back to its start once focus
 * moves to `outside`. The row must have scrolled first, so a row that never scrolls fails.
 *
 * @param segment - The focused segment, one the row scrolled to show.
 * @param outside - A focusable element outside the field.
 * @param label - The assertion label.
 */
export function expectRowRestsWhenFocusLeaves(
  segment: HTMLElement,
  outside: HTMLElement,
  label: string
): void {
  const { row } = rowAndBox(segment, label);
  expect(document.activeElement, `${label}: focus`).toBe(segment);
  expect(Math.abs(row.scrollLeft), `${label}: the row scrolled to the segment`).toBeGreaterThan(1);
  outside.focus();
  expect(document.activeElement, `${label}: focus outside`).toBe(outside);
  expect(Math.abs(row.scrollLeft), `${label}: the row at rest`).toBe(0);
}

/**
 * Asserts that a pointer press at the center of a scope's calendar trigger lands on the trigger,
 * which lies whole inside the field box, and that the press opens the calendar. It first takes
 * focus off the focused element, so the rows scroll back to their start. Escape closes the calendar.
 *
 * @param scope - The element around the picker.
 * @param label - The assertion label.
 */
export async function expectTriggerPressOpens(scope: HTMLElement, label: string): Promise<void> {
  document.querySelector<HTMLElement>(":focus")?.blur();
  const trigger = scope.querySelector<HTMLElement>('[data-slot="date-picker-trigger"]');
  const box = trigger?.closest(BOX) ?? null;
  if (trigger === null || box === null) {
    throw new Error(`${label}: the trigger and its box`);
  }
  // Playwright scrolls its target into view before it presses, so the press alone would reach a
  // trigger the box cuts off.
  expect([box.scrollLeft, box.scrollTop], `${label}: the box at rest`).toEqual([0, 0]);
  expectInside(trigger, box, `${label}: the trigger in the box`, 1);
  const rect = trigger.getBoundingClientRect();
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  expect(hit !== null && trigger.contains(hit), `${label}: the trigger's center reaches it`).toBe(true);
  await userEvent.click(trigger);
  await expect.element(page.getByRole("dialog")).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
}
