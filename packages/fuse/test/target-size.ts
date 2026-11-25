import { expect } from "vitest";

/** WCAG 2.5.8's minimum target, a 24px square around the target's center. */
const TARGET_SIZE = 24;

/**
 * The geometric checks' tolerance: layout rounds lengths to 1/64px, so two targets whose squares
 * touch exactly may measure a hair apart or a hair into each other.
 */
const EPSILON = 0.01;

/**
 * Where the hit-test samples sit, a pixel inside the 24px square. Chromium hit-tests a fractional
 * point up to a pixel off its painted edge, so a sample half a pixel inside can land on a neighbor
 * whose square only touches. The hit-test only proves that the pointer reaches the target there,
 * past any clipping ancestor; {@link expectTargetSize} and {@link expectTargetsApart} measure size
 * and spacing exactly.
 */
const REACH = TARGET_SIZE / 2 - 1;

/** A computed length in px, `0` for `auto`. */
function lengthOf(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * The box a target's pointer events reach: its border box, grown by an absolutely positioned
 * pseudo-element that extends it, as the `hit-area-*` utility's `::before` does for a chip's remove
 * button. The pseudo-element's box comes from its computed insets, which are negative where it
 * reaches past the target, so the visible glyph's size never counts as the target's.
 *
 * @param target - The control.
 * @param pseudo - The pseudo-element that draws the hit area.
 * @returns The hit area's rect.
 */
export function hitAreaOf(target: Element, pseudo: "::before" | "::after" = "::before"): DOMRect {
  const rect = target.getBoundingClientRect();
  const area = getComputedStyle(target, pseudo);
  if (area.content === "none" || area.position !== "absolute") {
    return rect;
  }
  const left = Math.min(rect.left, rect.left + lengthOf(area.left));
  const top = Math.min(rect.top, rect.top + lengthOf(area.top));
  const right = Math.max(rect.right, rect.right - lengthOf(area.right));
  const bottom = Math.max(rect.bottom, rect.bottom - lengthOf(area.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

/**
 * Assert that a hit area is at least 24px on each side.
 *
 * @param area - The target's hit area.
 * @param label - The assertion label.
 */
function expectTargetSize(area: DOMRect, label: string): void {
  expect(area.width, `${label} target width`).toBeGreaterThanOrEqual(TARGET_SIZE - EPSILON);
  expect(area.height, `${label} target height`).toBeGreaterThanOrEqual(TARGET_SIZE - EPSILON);
}

/** The 24px square centered on a hit area. */
function squareOf(area: DOMRect): DOMRect {
  const centerX = area.left + area.width / 2;
  const centerY = area.top + area.height / 2;
  return new DOMRect(centerX - TARGET_SIZE / 2, centerY - TARGET_SIZE / 2, TARGET_SIZE, TARGET_SIZE);
}

/**
 * Assert that no two targets' 24px squares overlap. Squares whose edges touch exactly pass.
 *
 * @param squares - Each neighboring target's square, centered on it, with the target's name.
 * @param label - The assertion label.
 */
function expectTargetsApart(squares: readonly (readonly [string, DOMRect])[], label: string): void {
  for (const [index, [firstName, a]] of squares.entries()) {
    for (const [secondName, b] of squares.slice(index + 1)) {
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      expect(
        overlapX > EPSILON && overlapY > EPSILON,
        `${label} ${firstName} and ${secondName} overlap`
      ).toBe(false);
    }
  }
}

/**
 * Assert that the pointer reaches the target at every corner of its 24px square, a pixel inside it
 * (see {@link REACH}): no ancestor clips the target there and no later sibling covers it. The
 * target must be in the viewport, where `elementFromPoint` hit-tests.
 *
 * @param target - The control whose target is checked.
 * @param square - The 24px square centered on its hit area.
 * @param label - The assertion label.
 */
function expectTargetSquare(target: Element, square: DOMRect, label: string): void {
  const centerX = square.left + TARGET_SIZE / 2;
  const centerY = square.top + TARGET_SIZE / 2;
  for (const [dx, dy] of [
    [-REACH, -REACH],
    [REACH, -REACH],
    [-REACH, REACH],
    [REACH, REACH],
  ] as const) {
    const hit = document.elementFromPoint(centerX + dx, centerY + dy);
    expect(hit !== null && target.contains(hit), `${label} target ${dx},${dy}`).toBe(true);
  }
}

/**
 * Assert each target's size and reach, and that their squares stay apart.
 *
 * @param targets - Neighboring controls, in the viewport.
 * @param label - The assertion label.
 * @returns Each target's 24px square, in order.
 */
export function expectTargets(targets: readonly Element[], label: string): DOMRect[] {
  const named = targets.map((target) => {
    const name = target.getAttribute("aria-label") ?? target.textContent;
    const area = hitAreaOf(target);
    const square = squareOf(area);
    expectTargetSize(area, `${label} ${name}`);
    expectTargetSquare(target, square, `${label} ${name}`);
    return [name, square] as const;
  });
  expectTargetsApart(named, label);
  return named.map(([, square]) => square);
}

/**
 * Assert each target's own box is at least 24px on each side, with the same layout-rounding
 * tolerance as {@link expectTargets}, for targets that need not stay apart, such as unrelated
 * controls rendered side by side.
 *
 * @param targets - The controls.
 * @param label - The assertion label.
 */
export function expectTargetBoxes(targets: readonly Element[], label: string): void {
  for (const target of targets) {
    expectTargetSize(target.getBoundingClientRect(), `${label} ${target.getAttribute("aria-label") ?? ""}`);
  }
}

/**
 * Run a check under each host root font size, restoring the document's own size afterwards.
 *
 * @param roots - The root font sizes in px.
 * @param check - The check, given the root.
 */
export function atHostRoots(roots: readonly number[], check: (root: number) => void): void {
  try {
    for (const root of roots) {
      document.documentElement.style.fontSize = `${root}px`;
      check(root);
    }
  } finally {
    document.documentElement.style.removeProperty("font-size");
  }
}
