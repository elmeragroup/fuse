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

describe("artboardStyle", () => {
  it("declares each override as a custom property", () => {
    expect(artboardStyle({ radius: "1rem", primary: "#ff0000" }, BASE)).toEqual({
      "--radius": "1rem",
      "--primary": "#ff0000",
    });
  });

  it("restates an alias of an edited token, so it resolves against the edit on this element", () => {
    expect(artboardStyle({ error: "#ff0000" }, BASE)).toEqual({
      "--error": "#ff0000",
      "--destructive": "var(--error)",
    });
  });

  it("restates a live mix of an edited token", () => {
    expect(artboardStyle({ foreground: "#000000" }, BASE)).toEqual({
      "--foreground": "#000000",
      "--secondary-hover": "color-mix(in oklch, var(--secondary), var(--foreground) 5%)",
    });
  });

  it("follows an alias chain to its end", () => {
    const chained = { ...BASE, "selection-checked-border": "var(--button-outline)" };
    expect(artboardStyle({ border: "#111111" }, chained)).toEqual({
      "--border": "#111111",
      "--button-outline": "var(--border)",
      "--selection-checked-border": "var(--button-outline)",
    });
  });

  it("keeps an edited alias's own value", () => {
    expect(artboardStyle({ error: "#ff0000", destructive: "#00ff00" }, BASE)).toEqual({
      "--error": "#ff0000",
      "--destructive": "#00ff00",
    });
  });

  it("declares the overrides alone before the base theme's declarations load", () => {
    expect(artboardStyle({ error: "#ff0000" }, undefined)).toEqual({ "--error": "#ff0000" });
  });
});

/**
 * The radius declarations of each variant, as the theme sources write them: the internal
 * variant aliases both role corners to `--radius` (tokens/defaults.ts), and external elma
 * declares its own button literal (tokens/external-palettes.ts) and keeps the field alias.
 */
const INTERNAL_RADII = {
  radius: "0.375rem",
  "radius-button": "var(--radius)",
  "radius-field": "var(--radius)",
  "radius-step": "0px",
} as const;
const EXTERNAL_RADII = {
  radius: "0.375rem",
  "radius-button": "0.375rem",
  "radius-field": "var(--radius)",
  "radius-step": "2px",
} as const;

describe("artboardStyle in a theme of the artboard's own", () => {
  // A --radius edit, as an artboard in either variant wears it.
  const EDITS = { radius: "20px" } as const;

  it("keeps an external artboard's own button corner and restates its field alias", () => {
    expect(artboardStyle(EDITS, EXTERNAL_RADII)).toEqual({
      "--radius": "20px",
      "--radius-field": "var(--radius)",
    });
  });

  it("restates an internal artboard's role corner aliases", () => {
    expect(artboardStyle(EDITS, INTERNAL_RADII)).toEqual({
      "--radius": "20px",
      "--radius-button": "var(--radius)",
      "--radius-field": "var(--radius)",
    });
  });
});
