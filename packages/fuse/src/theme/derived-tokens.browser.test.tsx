import { describe, expect, it } from "vitest";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { render } from "../../test/browser-render";
import { computedOklch, roleNamed } from "../../test/themed-browser-render";
import { composeTheme } from "./compose-theme";
import { parseOklch } from "./oklch";
import { ThemeScope } from "./theme-scope";
import { LEGAL_THEMES, themeSlug } from "./tokens/themes";

/** The color a background declaration computes to where `host` sits in the cascade. */
function computedBackground(host: HTMLElement, value: string): string {
  const probe = document.createElement("span");
  probe.style.backgroundColor = value;
  host.append(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
}

describe("derived roles", () => {
  it("composes the secondary hover literal the browser's color-mix computes in every theme", () => {
    // Unit under test: the `secondary-hover` literal that composition stores for the catalog,
    // the docs and design tools. Oracle: Chromium's own `color-mix(in oklch, …)` over the
    // same scope's `--secondary` and `--foreground`.
    const { rerender } = render(null);
    for (const scheme of ["light", "dark"] as const) {
      for (const theme of LEGAL_THEMES) {
        rerender(
          <div data-theme={scheme}>
            <ThemeScope theme={theme}>
              <div role="group" aria-label="Probe" />
            </ThemeScope>
          </div>
        );
        const host = roleNamed("group", "Probe");
        const context = `${scheme} ${themeSlug(theme)}`;
        const literal = parseOklch(composeTheme(theme, scheme)["secondary-hover"]);
        const mixed = computedOklch(
          computedBackground(host, "color-mix(in oklch, var(--secondary), var(--foreground) 5%)")
        );
        expect(literal.l, `${context} lightness`).toBeCloseTo(mixed.l, 4);
        expect(literal.c, `${context} chroma`).toBeCloseTo(mixed.c, 4);
        // Chromium serializes the mixed hue with float error, 2.46552 for internal light's 2.4655.
        expect(literal.h, `${context} hue`).toBeCloseTo(mixed.h, 2);
      }
    }
  });
});
