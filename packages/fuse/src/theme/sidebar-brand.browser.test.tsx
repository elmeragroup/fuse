import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";

import { render } from "../../test/browser-render";
import { Sidebar } from "../components/sidebar";
import { LocaleProvider } from "../intl/locale-context";
import type { ResolvedColorScheme } from "./color-scheme-types";
import { generateThemesCss } from "./generate-css";
import { ThemeScope } from "./theme-scope";
import type { ThemeInput, ThemeVariant } from "./tokens/themes";

function SidebarColors() {
  return (
    <LocaleProvider locale="en-US">
      <Sidebar.Provider>
        <Sidebar.Root collapsible="none">
          <Sidebar.Header
            data-testid="sidebar-color"
            style={{ backgroundColor: "var(--sidebar-brand)", color: "var(--sidebar-brand-foreground)" }}>
            Brand
          </Sidebar.Header>
          <span
            data-testid="brand-color"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-foreground)" }}>
            Reference
          </span>
        </Sidebar.Root>
      </Sidebar.Provider>
    </LocaleProvider>
  );
}

function colors(element: Element | null) {
  if (element === null) throw new Error("Missing color probe");
  const css = getComputedStyle(element);
  return { background: css.backgroundColor, foreground: css.color };
}

type ScopeOptions = {
  readonly theme: ThemeInput;
  readonly colorScheme: ResolvedColorScheme;
  readonly hostCss?: string;
  readonly style?: Record<string, string>;
};

/**
 * Render the probes in a theme scope under a document-like color-scheme ancestor, with an
 * optional host stylesheet after the themes, and read the sidebar and brand pairs.
 */
function probeColors({ theme, colorScheme, hostCss = "", style }: ScopeOptions) {
  const scope: ReactNode = (
    <ThemeScope theme={theme} className="custom-sidebar" style={style}>
      <SidebarColors />
    </ThemeScope>
  );
  const { host } = render(
    <>
      <style>{`${generateThemesCss()}\n${hostCss}`}</style>
      <div data-theme={colorScheme}>{scope}</div>
    </>
  );
  return {
    sidebar: colors(host.querySelector('[data-testid="sidebar-color"]')),
    brand: colors(host.querySelector('[data-testid="brand-color"]')),
  };
}

function sidebarPair(options: ScopeOptions) {
  return probeColors(options).sidebar;
}

const HOST_BRAND = { "--brand": "rgb(10, 20, 30)", "--brand-foreground": "rgb(240, 230, 220)" };

const variants = ["internal", "external"] satisfies ThemeVariant[];
const colorSchemes = ["light", "dark"] satisfies ResolvedColorScheme[];

describe("scoped sidebar brand colors", () => {
  for (const variant of variants) {
    // Gudbrandsdal's accent and its foreground read on the light sidebar, so its light sidebar
    // pair keeps the aliases. A brand whose tone is derived declares a literal instead.
    it(`${variant} light resolves aliases through a host brand-pair override`, () => {
      expect(
        sidebarPair({
          theme: { variant, brand: "guen", segment: "private" },
          colorScheme: "light",
          style: HOST_BRAND,
        })
      ).toEqual({ background: "rgb(10, 20, 30)", foreground: "rgb(240, 230, 220)" });
    });

    for (const colorScheme of colorSchemes) {
      it(`${variant} ${colorScheme} permits host overrides of both sidebar tokens on the branded scope`, () => {
        const hostCss =
          '.custom-sidebar[data-theme-brand="tkas"] { --sidebar-brand: rgb(40, 50, 60); --sidebar-brand-foreground: rgb(210, 200, 190); }';
        expect(
          sidebarPair({ theme: { variant, brand: "tkas", segment: "private" }, colorScheme, hostCss })
        ).toEqual({ background: "rgb(40, 50, 60)", foreground: "rgb(210, 200, 190)" });
      });

      // The lightest override a host writes: one class on the theme element, after the themes.
      // TrøndelagKraft's tone is derived on the light sidebar and Gudbrandsdal's on the dark one.
      const derivedBrand = colorScheme === "light" ? "tkas" : "guen";
      it(`${variant} ${colorScheme} permits a one-class override of the derived ${derivedBrand} sidebar tone`, () => {
        const hostCss =
          ".custom-sidebar { --sidebar-brand: rgb(70, 80, 90); --sidebar-brand-foreground: rgb(250, 250, 250); }";
        expect(
          sidebarPair({ theme: { variant, brand: derivedBrand, segment: "private" }, colorScheme, hostCss })
        ).toEqual({ background: "rgb(70, 80, 90)", foreground: "rgb(250, 250, 250)" });
      });
    }

    // TrøndelagKraft's brand falls short on the light sidebar and Gudbrandsdal's on the dark
    // one, so each declares a build-time tone that a host brand override does not move.
    for (const [brand, colorScheme] of [
      ["tkas", "light"],
      ["guen", "dark"],
    ] as const) {
      it(`${variant} ${colorScheme} keeps the derived ${brand} tone through a host brand override`, () => {
        const theme = { variant, brand, segment: "private" } as const;
        const derived = probeColors({ theme, colorScheme });
        expect(derived.sidebar.background).not.toBe(derived.brand.background);
        expect(probeColors({ theme, colorScheme, style: HOST_BRAND }).sidebar.background).toBe(
          derived.sidebar.background
        );
      });
    }
  }
});
