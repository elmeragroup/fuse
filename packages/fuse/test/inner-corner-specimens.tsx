import type { ReactElement } from "react";

import { expect } from "vitest";

import { menuPopupShellClass } from "../src/styles/inner-corner/menu";
import type { ThemeInput } from "../src/theme/theme-input";
import { ThemeScope } from "../src/theme/theme-scope";
import { render } from "./browser-render";
import { fkasBranded, fkasPrivate, guenBranded, tkasCompany } from "./theme-fixtures";
import { px, roleNamed } from "./themed-browser-render";

/** The four themes the inner-corner suites measure. */
export type CornerCase = "neutral" | "fkas" | "tkas" | "guen";

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
export const RADIUS = { neutral: 8, fkas: 12, tkas: 16, guen: 8 } as const satisfies Record<
  CornerCase,
  number
>;

/**
 * Each theme's `rounded-md` in px: `--radius` less one 2px step externally, and `--radius`
 * itself internally.
 */
export const RADIUS_MD = { neutral: 8, fkas: 10, tkas: 14, guen: 6 } as const satisfies Record<
  CornerCase,
  number
>;

/** Each theme's `rounded-lg` in px, `--radius` itself. */
export const RADIUS_LG = RADIUS;

/** Each theme's `rounded-xl` in px: `--radius` plus two 2px steps externally. */
export const RADIUS_XL = { neutral: 8, fkas: 16, tkas: 20, guen: 12 } as const satisfies Record<
  CornerCase,
  number
>;

/**
 * Each theme's field corner in px. `--radius-field` aliases `--radius` in both variants, so a
 * field box rounds like a card's `rounded-lg`.
 */
export const FIELD_CORNER = RADIUS_LG;

/** The edge of a part that meets its shell's corner. */
export type PartEdge = "start" | "end";

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

/** A ThemeScope that is also a menu shell, with one inner part directly inside it. */
function SameElementShell(): ReactElement {
  return (
    <ThemeScope theme={fkasBranded} className={menuPopupShellClass}>
      <div role="group" aria-label="Scope row" className="rounded-inner" />
    </ThemeScope>
  );
}

/**
 * Render a shell on an element that carries theme attributes and check that the shell's
 * `--inner-corner` wins over the reset those attributes apply. The caller supplies the
 * stylesheet mode and the document theme.
 */
export function expectShellOnThemeElementWins(): void {
  render(<SameElementShell />);
  // fkas: rounded-md is 12px less one 2px step, 10px, and the padding is 4px.
  expect(cornerRadius(roleNamed("group", "Scope row"))).toBe(6);
}
