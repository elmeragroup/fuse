import { beforeEach, describe, expect, it, onTestFinished } from "vitest";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { computedColor } from "../../test/assert-invalid-ring";
import { render } from "../../test/browser-render";
import { BRAND_SCOPED_ROLES } from "../../test/theme-css-contract";
import {
  cssVarColor,
  fkasPrivate,
  roleNamed,
  snapshotDocumentTheme,
  stampDocumentTheme,
} from "../../test/themed-browser-render";
import { composeTheme } from "./compose-theme";
import { tokenLiteral } from "./contrast";
import { LEGAL_THEMES, themeSlug } from "./theme-input";
import type { ThemeInput } from "./theme-input";
import { ThemeScope } from "./theme-scope";

/** fkas/company, branded: a segment with its own palette rule and brand-scoped companion. */
const FKAS_COMPANY = { identity: "branded", brand: "fkas", segment: "company" } as const satisfies ThemeInput;

/** The host's colors for the brand-scoped roles, apart from every composed value, per scheme. */
const HOST_COLORS = {
  light: "oklch(0.42 0.09 30)",
  dark: "oklch(0.81 0.07 30)",
} as const;

/**
 * The override the theming handbook documents for `--sidebar-brand`, which it tells a host to copy
 * for `--brand-ink`: one rule at the brand pointer's weight, and a dark rule with a selector for a
 * theme element under a dark ancestor and one for an element that is dark itself.
 */
const HOST_OVERRIDE = `
.app-shell[data-theme-brand="fkas"] {
${BRAND_SCOPED_ROLES.map((role) => `  --${role}: ${HOST_COLORS.light};`).join("\n")}
}
[data-theme="dark"] .app-shell[data-theme-brand="fkas"],
.app-shell[data-theme="dark"][data-theme-brand="fkas"] {
${BRAND_SCOPED_ROLES.map((role) => `  --${role}: ${HOST_COLORS.dark};`).join("\n")}
}`;

function expectComposedRoles(host: HTMLElement, theme: ThemeInput, scheme: "light" | "dark", scope: string) {
  const tokens = composeTheme(theme, scheme);
  for (const role of BRAND_SCOPED_ROLES) {
    expect
      .soft(cssVarColor(host, `--${role}`), `${scope} ${scheme} ${themeSlug(theme)} ${role}`)
      .toBe(computedColor(host, tokenLiteral(tokens, role)));
  }
}

function expectHostRoles(host: HTMLElement, scheme: "light" | "dark", scope: string) {
  for (const role of BRAND_SCOPED_ROLES) {
    expect
      .soft(cssVarColor(host, `--${role}`), `${scope} ${scheme} host ${role}`)
      .toBe(computedColor(host, HOST_COLORS[scheme]));
  }
}

/** Appends the handbook's host override after the Fuse stylesheets until the test ends. */
function appendHostOverride(): void {
  const style = document.createElement("style");
  style.textContent = HOST_OVERRIDE;
  document.head.append(style);
  onTestFinished(() => style.remove());
}

describe("brand-scoped roles in the cascade", () => {
  beforeEach(() => {
    onTestFinished(snapshotDocumentTheme());
  });

  // Unit under test: the selector weights and order `themes.css` gives the brand-scoped roles.
  // Oracle: `composeTheme`, the value each theme and scheme must resolve to. The contract test
  // overlays the rules in source order; this one lets Chromium apply specificity.
  it("resolves each brand-scoped role to its composed value on a themed document", () => {
    render(<div role="group" aria-label="Probe" />);
    const host = roleNamed("group", "Probe");
    for (const scheme of ["light", "dark"] as const) {
      for (const theme of LEGAL_THEMES) {
        stampDocumentTheme(theme, scheme);
        expectComposedRoles(host, theme, scheme, "document");
      }
    }
  });

  it("resolves each brand-scoped role to its composed value in a scope nested under another theme", () => {
    const { rerender } = render(null);
    for (const scheme of ["light", "dark"] as const) {
      stampDocumentTheme(fkasPrivate, scheme);
      for (const theme of LEGAL_THEMES) {
        rerender(
          <ThemeScope theme={theme}>
            <div role="group" aria-label="Probe" />
          </ThemeScope>
        );
        expectComposedRoles(roleNamed("group", "Probe"), theme, scheme, "nested");
      }
    }
  });

  // Oracle: the handbook's override, a host rule at the brand pointer's weight after the Fuse
  // stylesheets. A palette rule or companion that outweighs the pointer would beat it.
  it("lets the handbook's host override win on a document themed to a branded segment", () => {
    appendHostOverride();
    render(<div role="group" aria-label="Document probe" />);
    const root = document.documentElement;
    root.classList.add("app-shell");
    onTestFinished(() => root.classList.remove("app-shell"));
    for (const scheme of ["light", "dark"] as const) {
      stampDocumentTheme(FKAS_COMPANY, scheme);
      expectHostRoles(roleNamed("group", "Document probe"), scheme, "document");
    }
  });

  it("lets the handbook's host override win on a branded segment scope nested under another theme", () => {
    appendHostOverride();
    render(
      <ThemeScope theme={FKAS_COMPANY} className="app-shell">
        <div role="group" aria-label="Nested probe" />
      </ThemeScope>
    );
    for (const scheme of ["light", "dark"] as const) {
      stampDocumentTheme(fkasPrivate, scheme);
      expectHostRoles(roleNamed("group", "Nested probe"), scheme, "nested");
    }
  });
});
