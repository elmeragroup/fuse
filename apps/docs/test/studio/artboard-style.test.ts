import { describe, expect, it } from "vitest";

import { artboardStyle } from "../../src/studio/lib/artboard-style";

/** A base scheme's declarations, written out by hand in the forms the theme rules use. */
const BASE = {
  error: "oklch(0.6 0.2 25)",
  "error-foreground": "oklch(1 0 0)",
  destructive: "var(--error)",
  "destructive-foreground": "var(--error-foreground)",
  secondary: "oklch(0.9 0 0)",
  foreground: "oklch(0.2 0 0)",
  "secondary-hover": "color-mix(in oklch, var(--secondary), var(--foreground) 5%)",
  border: "oklch(0.8 0 0)",
  "button-outline": "var(--border)",
  ring: "oklch(0.5 0 0)",
  "sidebar-ring": "var(--ring)",
  radius: "0.75rem",
} as const;

const CHAINED = { ...BASE, "selection-checked-border": "var(--button-outline)" } as const;

describe("artboardStyle", () => {
  it.each([
    [
      "declares each override as a custom property",
      { radius: "1rem", primary: "#ff0000" },
      BASE,
      { "--radius": "1rem", "--primary": "#ff0000" },
    ],
    [
      "restates an alias of an edited token, so it resolves against the edit on this element",
      { error: "#ff0000" },
      BASE,
      { "--error": "#ff0000", "--destructive": "var(--error)" },
    ],
    [
      "restates a live mix of an edited token",
      { foreground: "#000000" },
      BASE,
      {
        "--foreground": "#000000",
        "--secondary-hover": "color-mix(in oklch, var(--secondary), var(--foreground) 5%)",
      },
    ],
    [
      "follows an alias chain to its end",
      { border: "#111111" },
      CHAINED,
      {
        "--border": "#111111",
        "--button-outline": "var(--border)",
        "--selection-checked-border": "var(--button-outline)",
      },
    ],
    [
      "keeps an edited alias's own value",
      { error: "#ff0000", destructive: "#00ff00" },
      BASE,
      { "--error": "#ff0000", "--destructive": "#00ff00" },
    ],
    [
      "declares the overrides alone before the base theme's declarations load",
      { error: "#ff0000" },
      undefined,
      { "--error": "#ff0000" },
    ],
  ] as const)("%s", (_case, overrides, theme, style) => {
    expect(artboardStyle(overrides, theme)).toEqual(style);
  });
});
