import { describe, expect, it } from "vitest";

import { render } from "../../test/browser-render";
import { Sidebar } from "../components/sidebar/sidebar";
import { LocaleProvider } from "../intl/locale-context";
import { generateThemesCss } from "./generate-css";
import { ThemeScope } from "./theme-scope";
import type { ThemeVariant } from "./tokens/themes";

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

describe("scoped sidebar brand colors", () => {
  for (const outerVariant of ["internal", "external"] as const) {
    for (const innerVariant of ["internal", "external"] as const) {
      it(`${outerVariant} fkas to ${innerVariant} tkas resolves both colors locally without a document writer`, () => {
        const { host } = render(
          <>
            <style>{generateThemesCss()}</style>
            <ThemeScope theme={{ variant: outerVariant, brand: "fkas", segment: "private" }}>
              <ThemeScope theme={{ variant: innerVariant, brand: "tkas", segment: "private" }}>
                <SidebarColors />
              </ThemeScope>
            </ThemeScope>
          </>
        );
        expect(colors(host.querySelector('[data-testid="sidebar-color"]'))).toEqual(
          colors(host.querySelector('[data-testid="brand-color"]'))
        );
      });
    }
  }

  for (const variant of ["internal", "external"] satisfies ThemeVariant[]) {
    it(`${variant} resolves aliases through a host brand-pair override`, () => {
      const style = { "--brand": "rgb(10, 20, 30)", "--brand-foreground": "rgb(240, 230, 220)" };
      const { host } = render(
        <>
          <style>{generateThemesCss()}</style>
          <ThemeScope theme={{ variant, brand: "tkas", segment: "private" }} style={style}>
            <SidebarColors />
          </ThemeScope>
        </>
      );
      expect(colors(host.querySelector('[data-testid="sidebar-color"]'))).toEqual({
        background: "rgb(10, 20, 30)",
        foreground: "rgb(240, 230, 220)",
      });
    });

    it(`${variant} permits host overrides of both sidebar aliases on the branded scope`, () => {
      const { host } = render(
        <>
          <style>
            {generateThemesCss() +
              '\n.custom-sidebar[data-theme-brand="tkas"] { --sidebar-brand: rgb(40, 50, 60); --sidebar-brand-foreground: rgb(210, 200, 190); }'}
          </style>
          <ThemeScope theme={{ variant, brand: "tkas", segment: "private" }} className="custom-sidebar">
            <SidebarColors />
          </ThemeScope>
        </>
      );
      expect(colors(host.querySelector('[data-testid="sidebar-color"]'))).toEqual({
        background: "rgb(40, 50, 60)",
        foreground: "rgb(210, 200, 190)",
      });
    });
  }
});
