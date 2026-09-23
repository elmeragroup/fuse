import type { ReactNode } from "react";

import { afterEach } from "vitest";
import { page } from "vitest/browser";

import type { ResolvedColorScheme } from "../src/theme/color-scheme";
import { remToPx } from "../src/theme/css-values";
import type { Density } from "../src/theme/density";
import { parseOklch } from "../src/theme/oklch";
import { ThemeScope } from "../src/theme/theme-scope";
import { DENSITY_METRICS } from "../src/theme/tokens/density-metrics";
import type { DensityMetricName } from "../src/theme/tokens/density-metrics";
import type { ThemeInput } from "../src/theme/tokens/themes";
import { render } from "./browser-render";
import { fkasPrivate, stampTheme } from "./theme-fixtures";

export { fkasExternal, fkasPrivate, stampTheme } from "./theme-fixtures";

/** A density metric in the pixels a browser computes, with `rem` at the 16px root. */
function metricPx(name: DensityMetricName, density: Density): number {
  return remToPx(DENSITY_METRICS[name][density]);
}

/** The md control-rung metrics in pixels per density, read from `DENSITY_METRICS`. */
function controlMd(density: Density) {
  return {
    height: metricPx("control-h-md", density),
    px: metricPx("control-px-md", density),
    font: metricPx("control-text", density),
    leading: metricPx("control-leading", density),
  };
}

/** The sm control-rung metrics in pixels per density, read from `DENSITY_METRICS`. */
function controlSm(density: Density) {
  return { height: metricPx("control-h-sm", density), px: metricPx("control-px-sm", density) };
}

/**
 * Md control-rung metrics (`--control-*-md` plus the control-type pair) in pixels. The
 * density-css cross-check ties `DENSITY_METRICS` to `fuse.css`, so a suite comparing
 * computed styles with these checks that a component binds the md rung.
 */
export const CONTROL_MD = {
  dense: controlMd("dense"),
  comfortable: controlMd("comfortable"),
} as const;

/**
 * Sm control-rung metrics (`--control-h-sm` / `--control-px-sm`) in pixels. The rung the
 * RAC tier's package-private Button defaults to, which FileTrigger's visible button and the
 * GridList drag handle use, so those suites read it here rather than restating the numbers.
 */
export const CONTROL_SM = {
  dense: controlSm("dense"),
  comfortable: controlSm("comfortable"),
} as const;

afterEach(() => {
  document.documentElement.removeAttribute("data-density");
});

/**
 * Mount under the fkas/private ThemeScope every component browser suite shares.
 * Nested ThemeScope / density stamps still go on the tree the caller passes in.
 */
export function renderThemed(node: ReactNode) {
  const result = render(<ThemeScope theme={fkasPrivate}>{node}</ThemeScope>);
  return {
    ...result,
    rerender: (next: ReactNode): void => {
      result.rerender(<ThemeScope theme={fkasPrivate}>{next}</ThemeScope>);
    },
  };
}

export function stampDensity(density: Density): void {
  document.documentElement.setAttribute("data-density", density);
}

/** The document attributes a theme stamp owns. `data-density` is separate. */
const DOCUMENT_THEME_ATTRIBUTES = [
  "data-theme",
  "data-theme-variant",
  "data-theme-brand",
  "data-theme-segment",
] as const;

/** Stamp the document: the theme axes plus the `data-theme` scheme marker. */
export function stampDocumentTheme(theme: ThemeInput, colorScheme: ResolvedColorScheme): void {
  stampTheme(document.documentElement, theme);
  document.documentElement.setAttribute("data-theme", colorScheme);
}

/**
 * Snapshot the document's theme attributes and return the restore. Suites call this in
 * `beforeEach` and the result in `afterEach`, so a test that stamps the document cannot
 * leak its theme into the next one.
 */
export function snapshotDocumentTheme(): () => void {
  const saved = DOCUMENT_THEME_ATTRIBUTES.map((name) => document.documentElement.getAttribute(name));
  return (): void => {
    for (const [index, name] of DOCUMENT_THEME_ATTRIBUTES.entries()) {
      const value = saved[index];
      if (value == null) {
        document.documentElement.removeAttribute(name);
      } else {
        document.documentElement.setAttribute(name, value);
      }
    }
  };
}

export function px(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a pixel length, received ${value}`);
  }
  return parsed;
}

/** The lightness, chroma and hue of an opaque OKLCH color, as Chromium computes it. */
export type ComputedOklch = { readonly l: number; readonly c: number; readonly h: number };

/**
 * Read a computed color that Chromium serializes as an opaque `oklch(L C H)`, through the
 * token pipeline's own `oklch()` parser.
 *
 * @param serialized - A computed color value, such as `getComputedStyle(el).backgroundColor`.
 * @returns The three components.
 * @throws When the value is not an `oklch()` color or is translucent, which is a defect in
 *   the suite.
 */
export function computedOklch(serialized: string): ComputedOklch {
  const { l, c, h, alpha } = parseOklch(serialized);
  if (alpha !== 1) {
    throw new Error(`expected an opaque oklch() color, received ${serialized}`);
  }
  return { l, c, h };
}

/**
 * The opacity an element paints at, which is its own computed opacity multiplied by every
 * ancestor's. A disabled control inside a dimmed wrapper compounds, so a suite that checks
 * that a control dims once reads this instead of the element's own `opacity`.
 */
export function effectiveOpacity(element: Element): number {
  let opacity = 1;
  for (let current: Element | null = element; current !== null; current = current.parentElement) {
    opacity *= Number.parseFloat(getComputedStyle(current).opacity);
  }
  return opacity;
}

/** The ARIA role names `page.getByRole` accepts, so callers keep the checked union. */
export type QueryableRole = Parameters<typeof page.getByRole>[0];

/**
 * The one role query every browser suite uses: exact accessible name, asserted to be an element.
 * Suites query by role and name, never by class or `data-slot`.
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

/** `textboxNamed`, narrowed to the native input so a suite can read `.value` off it. */
export function inputNamed(name: string): HTMLInputElement {
  const input = textboxNamed(name);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`expected an <input> named ${name}`);
  }
  return input;
}

/** The labelled `<form>`: forms are queried by accessible name like any other element. */
export function formNamed(name: string): HTMLFormElement {
  const form = roleNamed("form", name);
  if (!(form instanceof HTMLFormElement)) {
    throw new Error(`expected a <form> named ${name}`);
  }
  return form;
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
