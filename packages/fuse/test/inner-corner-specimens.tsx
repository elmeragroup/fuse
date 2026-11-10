import type { ThemeInput } from "../src/theme/theme-input";
import { fkasBranded, fkasPrivate, guenBranded, tkasCompany } from "./theme-fixtures";
import { px } from "./themed-browser-render";

/** The four themes the inner-corner suites measure. */
type CornerCase = "neutral" | "fkas" | "tkas" | "guen";

/** Each case names the theme under test and a document theme with different radii. */
export const CASES: readonly (readonly [CornerCase, ThemeInput, ThemeInput])[] = [
  ["neutral", fkasPrivate, tkasCompany],
  ["fkas", fkasBranded, fkasPrivate],
  ["tkas", tkasCompany, fkasPrivate],
  ["guen", guenBranded, tkasCompany],
];

/**
 * Each theme's `--radius` in px, the corner of an inner part outside any shell: 0.5rem
 * neutral, and 0.75rem for fkas, 1rem for tkas and 0.5rem for guen.
 */
const RADIUS = { neutral: 8, fkas: 12, tkas: 16, guen: 8 } as const satisfies Record<CornerCase, number>;

/** Each theme's `rounded-lg` in px, `--radius` itself. */
export const RADIUS_LG = RADIUS;

/** The edge of a part that meets its shell's corner. */
type PartEdge = "start" | "end";

/**
 * The distance in px between a shell's border edge and a part's on one inline side, measured
 * from their boxes: the padding, border and margin between them.
 */
export function edgeInset(part: HTMLElement, shell: HTMLElement, edge: PartEdge): number {
  const partBox = part.getBoundingClientRect();
  const shellBox = shell.getBoundingClientRect();
  return edge === "start" ? partBox.left - shellBox.left : shellBox.right - partBox.right;
}

/** An element's top-left corner radius in px, as Chromium computes it. */
export function cornerRadius(element: HTMLElement): number {
  return px(getComputedStyle(element).borderTopLeftRadius);
}
