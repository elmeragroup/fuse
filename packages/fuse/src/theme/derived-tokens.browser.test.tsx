import { describe, expect, it } from "vitest";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { render } from "../../test/browser-render";
import { roleNamed } from "../../test/themed-browser-render";
import { ThemeScope } from "./theme-scope";
import { LEGAL_THEMES, themeSlug } from "./tokens/themes";

type Oklch = { readonly l: number; readonly c: number; readonly h: number };

/** Chromium serializes an `oklch()` color with space-separated L C H components. */
function readOklch(serialized: string): Oklch {
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(serialized);
  if (match === null) {
    throw new Error(`expected an opaque oklch() color, received ${serialized}`);
  }
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) };
}

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
  it("ships the secondary hover the browser's color-mix of secondary and foreground computes", () => {
    // Unit under test: the literal `--secondary-hover` each theme rule declares. Oracle: the
    // browser's own `color-mix(in oklch, …)`, which the Button recipe used before the role
    // existed, evaluated against the same scope's `--secondary` and `--foreground`.
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
        const token = readOklch(computedBackground(host, "var(--secondary-hover)"));
        const mixed = readOklch(
          computedBackground(host, "color-mix(in oklch, var(--secondary), var(--foreground) 5%)")
        );
        expect(token.l, `${context} lightness`).toBeCloseTo(mixed.l, 4);
        expect(token.c, `${context} chroma`).toBeCloseTo(mixed.c, 4);
        // Chromium serializes the mixed hue with float error, 2.46552 for internal light's 2.4655.
        expect(token.h, `${context} hue`).toBeCloseTo(mixed.h, 2);
      }
    }
  });
});
