import type { ReactElement } from "react";

import { expect } from "vitest";

import { menuPopupShellClass } from "../src/styles/inner-corner/menu";
import type { Density } from "../src/theme/density";
import { ThemeScope } from "../src/theme/theme-scope";
import type { ThemeInput } from "../src/theme/tokens/themes";
import { render } from "./browser-render";
import { fkasExternal, fkasPrivate, guenExternal, tkasCompany } from "./theme-fixtures";
import { px, roleNamed } from "./themed-browser-render";

/** The four themes the inner-corner suites measure. */
export type Variant = "internal" | "fkas" | "tkas" | "guen";

/** Each case names the theme under test and a document theme with different radii. */
export const CASES: readonly (readonly [Variant, ThemeInput, ThemeInput])[] = [
  ["internal", fkasPrivate, tkasCompany],
  ["fkas", fkasExternal, fkasPrivate],
  ["tkas", tkasCompany, fkasPrivate],
  ["guen", guenExternal, tkasCompany],
];

/** Both densities, which every geometry case runs at. */
export const DENSITIES: readonly Density[] = ["dense", "comfortable"];

/**
 * Each theme's `--radius` in px, the corner of an inner part outside any shell: 0.375rem
 * internal, and 0.75rem for fkas, 1rem for tkas and 0.5rem for guen.
 */
export const RADIUS = { internal: 6, fkas: 12, tkas: 16, guen: 8 } as const satisfies Record<Variant, number>;

/**
 * Each theme's `rounded-md` in px: `--radius` less one 2px step externally, and `--radius`
 * itself internally.
 */
export const RADIUS_MD = { internal: 6, fkas: 10, tkas: 14, guen: 6 } as const satisfies Record<
  Variant,
  number
>;

/** Each theme's `rounded-lg` in px, `--radius` itself. */
export const RADIUS_LG = RADIUS;

/** Each theme's `rounded-xl` in px: `--radius` plus two 2px steps externally. */
export const RADIUS_XL = { internal: 6, fkas: 16, tkas: 20, guen: 12 } as const satisfies Record<
  Variant,
  number
>;

/** Each theme's field corner in px: `--radius` internally and the external 4px field radius. */
export const FIELD_CORNER = { internal: 6, fkas: 4, tkas: 4, guen: 4 } as const satisfies Record<
  Variant,
  number
>;

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
    <ThemeScope theme={fkasExternal} className={menuPopupShellClass}>
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
