import type { ReactNode } from "react";

import { afterEach } from "vitest";
import { page } from "vitest/browser";

import type { Density } from "../src/theme/density";
import { ThemeScope } from "../src/theme/theme-scope";
import { render } from "./browser-render";

export const fkasPrivate = { variant: "internal", brand: "fkas", segment: "private" } as const;
export const fkasExternal = { variant: "external", brand: "fkas", segment: "private" } as const;

/** Signed md control-rung metrics (`--control-*-md` plus the control-type pair). */
export const CONTROL_MD = {
  dense: { height: 36, px: 10, font: 14, leading: 20 },
  comfortable: { height: 44, px: 14, font: 18, leading: 24 },
} as const;

afterEach(() => {
  document.documentElement.removeAttribute("data-density");
});

/**
 * Mount under the fkas/private ThemeScope every component browser suite shares.
 * Nested ThemeScope / density stamps still go on the tree the caller passes in.
 */
export function renderThemed(node: ReactNode) {
  return render(<ThemeScope theme={fkasPrivate}>{node}</ThemeScope>);
}

export function stampDensity(density: Density): void {
  document.documentElement.setAttribute("data-density", density);
}

export function px(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a pixel length, received ${value}`);
  }
  return parsed;
}

export function textboxNamed(name: string): HTMLElement {
  const element = page.getByRole("textbox", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected textbox ${name}`);
  }
  return element;
}
