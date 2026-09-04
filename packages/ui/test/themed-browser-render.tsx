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

/**
 * Signed `sm` control-rung metrics (`--control-h-sm` / `--control-px-sm`). The rung the
 * RAC tier's package-private Button defaults to — FileTrigger's visible button and the
 * GridList drag handle — so those suites read it here rather than restating the numbers.
 */
export const CONTROL_SM = {
  dense: { height: 32, px: 10 },
  comfortable: { height: 36, px: 14 },
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

/** The ARIA role names `page.getByRole` accepts, so callers keep the checked union. */
export type QueryableRole = Parameters<typeof page.getByRole>[0];

/**
 * The one role query every browser suite uses: exact accessible name, asserted to be an element.
 * Suites query by role and name, never by class or `data-slot` (tooling §7.2).
 */
export function roleNamed(role: QueryableRole, name: string): HTMLElement {
  const element = page.getByRole(role, { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected ${role} named ${name}`);
  }
  return element;
}

export function textboxNamed(name: string): HTMLElement {
  return roleNamed("textbox", name);
}

/** `roleNamed("heading", …)` with the optional heading level, which carries its own ARIA meaning. */
export function headingNamed(name: string, level?: 1 | 2 | 3 | 4 | 5 | 6): HTMLElement {
  const element = page.getByRole("heading", { name, exact: true, level }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected heading named ${name}`);
  }
  return element;
}

export function textNamed(name: string): HTMLElement {
  const element = page.getByText(name, { exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected text ${name}`);
  }
  return element;
}

export function fieldRootFrom(name: string): HTMLElement {
  const root = textboxNamed(name).closest("[data-orientation]");
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected field root around ${name}`);
  }
  return root;
}

/**
 * The computed colour a role token resolves to, read where `host` sits in the cascade.
 *
 * `host` must be an element mounted UNDER the `ThemeScope`: the theme attributes selecting the
 * token values are on the scope element, so the `renderThemed` host div is outside them and reads
 * whatever `:root` happens to declare — which for `--primary` is the internal default, quietly
 * right for `internal-fkas` and wrong for every other theme. A suite asserting a role token also
 * has to load the theme sheet (`import "../../../dist/themes.css"`); `dist/styles.css` declares no
 * role tokens at all. Both mistakes throw here rather than returning a plausible wrong colour.
 */
export function cssVarColor(host: HTMLElement, token: string): string {
  if (host.closest("[data-theme-variant]") === null) {
    throw new Error(
      `cssVarColor(${token}) needs an element under a ThemeScope; the renderThemed host div is outside it`
    );
  }
  if (getComputedStyle(host).getPropertyValue(token).trim() === "") {
    throw new Error(`${token} is undefined at that element — the suite must import dist/themes.css`);
  }
  const probe = document.createElement("span");
  probe.style.border = "1px solid";
  probe.style.borderColor = `var(${token})`;
  host.append(probe);
  const color = getComputedStyle(probe).borderTopColor;
  probe.remove();
  return color;
}
