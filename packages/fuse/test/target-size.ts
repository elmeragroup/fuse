import { expect } from "vitest";

/** WCAG 2.5.8's minimum target, a 24px square around the target's centre. */
export const TARGET_SIZE = 24;

/**
 * The geometric checks' tolerance: layout rounds lengths to 1/64px, so two targets whose squares
 * touch exactly may measure a hair apart or a hair into each other.
 */
const EPSILON = 0.01;

/**
 * Where the hit-test samples sit, a pixel inside the 24px square. Chromium hit-tests a fractional
 * point up to a pixel off its painted edge, so a sample half a pixel inside can land on a neighbour
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
 * `::before` that extends it, as the `hit-area-*` utility does for a chip's remove button. The
 * pseudo-element's box comes from its computed insets, which are negative where it reaches past the
 * target, so the visible glyph's size never counts as the target's.
 *
 * @param target - The control.
 * @returns The hit area's rect.
 */
export function hitAreaOf(target: Element): DOMRect {
  const rect = target.getBoundingClientRect();
  const before = getComputedStyle(target, "::before");
  if (before.content === "none" || before.position !== "absolute") {
    return rect;
  }
  const left = Math.min(rect.left, rect.left + lengthOf(before.left));
  const top = Math.min(rect.top, rect.top + lengthOf(before.top));
  const right = Math.max(rect.right, rect.right - lengthOf(before.right));
  const bottom = Math.max(rect.bottom, rect.bottom - lengthOf(before.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

/**
 * Assert that a target's hit area is at least 24px on each side.
 *
 * @param target - The control.
 * @param label - The assertion label.
 */
export function expectTargetSize(target: Element, label: string): void {
  const area = hitAreaOf(target);
  expect(area.width, `${label} target width`).toBeGreaterThanOrEqual(TARGET_SIZE - EPSILON);
  expect(area.height, `${label} target height`).toBeGreaterThanOrEqual(TARGET_SIZE - EPSILON);
}

/** The 24px square centred on a target's hit area. */
function squareOf(target: Element): DOMRect {
  const area = hitAreaOf(target);
  const centreX = area.left + area.width / 2;
  const centreY = area.top + area.height / 2;
  return new DOMRect(centreX - TARGET_SIZE / 2, centreY - TARGET_SIZE / 2, TARGET_SIZE, TARGET_SIZE);
}

/**
 * Assert that no two targets' 24px squares, each centred on its target, overlap. Squares whose
 * edges touch exactly pass.
 *
 * @param targets - Neighbouring controls.
 * @param label - The assertion label.
 */
export function expectTargetsApart(targets: readonly Element[], label: string): void {
  for (const [index, first] of targets.entries()) {
    for (const second of targets.slice(index + 1)) {
      const a = squareOf(first);
      const b = squareOf(second);
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      const names = `${first.getAttribute("aria-label") ?? first.textContent} and ${second.getAttribute("aria-label") ?? second.textContent}`;
      expect(overlapX > EPSILON && overlapY > EPSILON, `${label} ${names} overlap`).toBe(false);
    }
  }
}

/**
 * Assert that the pointer reaches the target at every corner of the 24px square around its centre,
 * a pixel inside it (see {@link REACH}): no ancestor clips the target there and no later sibling
 * covers it. The target must be in the viewport, where `elementFromPoint` hit-tests.
 *
 * @param target - The control whose target is checked.
 * @param label - The assertion label.
 * @returns The square's rect, for a caller that also checks where it sits.
 */
export function expectTargetSquare(target: Element, label: string): DOMRect {
  const square = squareOf(target);
  const centreX = square.left + TARGET_SIZE / 2;
  const centreY = square.top + TARGET_SIZE / 2;
  for (const [dx, dy] of [
    [-REACH, -REACH],
    [REACH, -REACH],
    [-REACH, REACH],
    [REACH, REACH],
  ] as const) {
    const hit = document.elementFromPoint(centreX + dx, centreY + dy);
    expect(hit !== null && target.contains(hit), `${label} target ${dx},${dy}`).toBe(true);
  }
  return square;
}

/**
 * Assert each target's size and reach, and that their squares stay apart.
 *
 * @param targets - Neighbouring controls, in the viewport.
 * @param label - The assertion label.
 * @returns Each target's 24px square, in order.
 */
export function expectTargets(targets: readonly Element[], label: string): DOMRect[] {
  const squares = targets.map((target) => {
    const name = `${label} ${target.getAttribute("aria-label") ?? target.textContent}`;
    expectTargetSize(target, name);
    return expectTargetSquare(target, name);
  });
  expectTargetsApart(targets, label);
  return squares;
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
