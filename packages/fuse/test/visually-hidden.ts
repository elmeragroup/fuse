import { expect } from "vitest";

/**
 * Assert an element is visually hidden but stays in the accessibility tree: taken out of flow
 * and clipped to nothing, the computed contract Tailwind's `sr-only` provides (`position:
 * absolute`, `overflow: hidden`, `clip-path: inset(50%)`) or the legacy `clip: rect(0 0 0 0)`
 * spelling of the same clip. It reads computed styles, so it holds for any class that provides
 * the contract and fails when nothing does.
 *
 * @param element - The element that names something without visible text.
 * @param label - The assertion label.
 */
export function expectVisuallyHidden(element: Element, label: string): void {
  const style = getComputedStyle(element);
  expect(style.position, `${label} position`).toBe("absolute");
  expect(style.overflow, `${label} overflow`).toBe("hidden");
  const clipped = style.clipPath === "inset(50%)" || style.clip === "rect(0px, 0px, 0px, 0px)";
  expect(clipped, `${label} clipped to nothing (clip-path ${style.clipPath}, clip ${style.clip})`).toBe(true);
}
