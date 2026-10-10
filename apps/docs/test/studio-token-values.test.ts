import { describe, expect, it } from "vitest";

import type { StudioOverrides } from "../src/lib/studio/edits";
import type { StudioSchemeSeed, StudioSeed } from "../src/lib/studio/seed";
import { MAX_VALUE_LENGTH } from "../src/lib/studio/size-policy";
import {
  aliasTarget,
  createsCycle,
  formatLength,
  lengthPx,
  parseTokenValue,
  resolvedCss,
} from "../src/lib/studio/token-values";

/** A seed holding only the tokens these tests read, written out by hand. */
function seedOf(light: Record<string, string>, dark: Record<string, string> = light): StudioSeed {
  // SAFETY: resolution reads only the tokens each test names, and every one is listed here.
  const scheme = (declared: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(declared).map(([name, css]) => [name, { css, value: "" }])
    ) as StudioSchemeSeed;
  return { slug: "internal-fkas-private", light: scheme(light), dark: scheme(dark) };
}

const SEED = seedOf({
  radius: "0.375rem",
  "radius-button": "var(--radius)",
  border: "oklch(0.9 0 0)",
  "button-outline": "var(--border)",
  primary: "var(--brand-fkas)",
});

const NONE: StudioOverrides = { light: {}, dark: {}, shared: {} };

describe("aliasTarget", () => {
  it("names the property of a single var() and nothing else", () => {
    expect(aliasTarget("var(--border)")).toBe("border");
    expect(aliasTarget(" var( --border ) ")).toBe("border");
    expect(aliasTarget("color-mix(in oklch, var(--a), var(--b) 5%)")).toBeUndefined();
    expect(aliasTarget("#ff0000")).toBeUndefined();
  });
});

describe("resolvedCss", () => {
  it("follows an alias to the base literal", () => {
    expect(resolvedCss(NONE, SEED, "light", "radius-button")).toBe("0.375rem");
  });

  it("follows an alias to an edited target", () => {
    const edited: StudioOverrides = { ...NONE, shared: { radius: "1rem" } };
    expect(resolvedCss(edited, SEED, "light", "radius-button")).toBe("1rem");
  });

  it("stops at a var() that names a primitive", () => {
    expect(resolvedCss(NONE, SEED, "light", "primary")).toBe("var(--brand-fkas)");
  });

  it("gives up on a cycle", () => {
    const cycle: StudioOverrides = {
      ...NONE,
      shared: {
        "button-outline": "var(--selection-checked-border)",
        "selection-checked-border": "var(--button-outline)",
      },
    };
    expect(resolvedCss(cycle, SEED, "light", "button-outline")).toBeUndefined();
  });

  it("has nothing to resolve before the seed loads", () => {
    expect(resolvedCss(NONE, undefined, "light", "radius")).toBeUndefined();
  });
});

describe("lengths", () => {
  it("reads px and rem at the 16px root", () => {
    expect(lengthPx("12px")).toBe(12);
    expect(lengthPx("0.75rem")).toBe(12);
    expect(lengthPx(".5rem")).toBe(8);
    expect(lengthPx("var(--radius)")).toBeUndefined();
    expect(lengthPx("1em")).toBeUndefined();
  });

  it("writes px or rem", () => {
    expect(formatLength(12, "rem")).toBe("0.75rem");
    expect(formatLength(1.5, "px")).toBe("1.5px");
  });
});

describe("parseTokenValue", () => {
  it("keeps a color @elmeragroup/color reads, trimmed", () => {
    expect(parseTokenValue("primary", " #ff0000 ")).toEqual({ ok: true, css: "#ff0000" });
    expect(parseTokenValue("border", "oklch(1 0 0 / 10%)")).toEqual({ ok: true, css: "oklch(1 0 0 / 10%)" });
  });

  it("refuses a color notation the studio cannot measure", () => {
    // The knob converts these through the browser first; stored data must already be readable.
    expect(parseTokenValue("primary", "color(srgb 1 0 0)").ok).toBe(false);
    expect(parseTokenValue("primary", "red").ok).toBe(false);
  });

  it("takes an alias only to a known token of the same kind, or a primitive for a color", () => {
    expect(parseTokenValue("primary", "var(--secondary)")).toEqual({ ok: true, css: "var(--secondary)" });
    expect(parseTokenValue("primary", "var(--brand-elma)")).toEqual({ ok: true, css: "var(--brand-elma)" });
    expect(parseTokenValue("radius-button", "var(--radius)")).toEqual({ ok: true, css: "var(--radius)" });
    expect(parseTokenValue("primary", "var(--radius)")).toEqual({
      ok: false,
      reason: "--radius is not a color token",
    });
    expect(parseTokenValue("primary", "var(--unknown)")).toEqual({
      ok: false,
      reason: "--unknown is not a color token",
    });
    expect(parseTokenValue("primary", "var(--primary)")).toEqual({
      ok: false,
      reason: "A token cannot alias itself",
    });
  });

  it("keeps the theme's own color-mix() as typed, and a mix with a literal color", () => {
    const mix = "color-mix(in oklch, var(--secondary), var(--foreground) 5%)";
    expect(parseTokenValue("secondary-hover", ` ${mix} `)).toEqual({ ok: true, css: mix });
    const literal = "color-mix(in lab, var(--brand-elma) 80%, oklch(1 0 0))";
    expect(parseTokenValue("primary", literal)).toEqual({ ok: true, css: literal });
    expect(parseTokenValue("primary", "color-mix(in oklch longer hue, #ff0000, var(--secondary))").ok).toBe(
      true
    );
  });

  const NOT_A_MIX = "Only color-mix() may read another token";
  const NEEDS_SPACE = "color-mix() starts with in and a color space, such as in oklch";
  const TWO_COLORS = "color-mix() mixes two colors";
  const OPERAND = "Each color in a mix is a var() without fallback or a color the studio reads";
  const PERCENTAGE = "A mix percentage is from 0% to 100%";

  it.each([
    ["an unknown token", "color-mix(in oklch, var(--nope), #ffffff)", "--nope is not a color token"],
    [
      "a token of another kind",
      "color-mix(in oklch, var(--radius), #ffffff)",
      "--radius is not a color token",
    ],
    [
      "the token itself",
      "color-mix(in oklch, var(--secondary-hover), #ffffff)",
      "A token cannot read itself",
    ],
    ["one color", "color-mix(in oklch, var(--secondary))", TWO_COLORS],
    ["three colors", "color-mix(in oklch, var(--secondary), #ffffff, #000000)", TWO_COLORS],
    ["no color space", "color-mix(var(--secondary), #ffffff)", NEEDS_SPACE],
    ["an unknown color space", "color-mix(in nope, var(--secondary), #ffffff)", NEEDS_SPACE],
    [
      "a hue method in a rectangular space",
      "color-mix(in srgb longer hue, var(--secondary), #ffffff)",
      "Only hsl, hwb, lch and oklch take a hue method",
    ],
    ["currentcolor", "color-mix(in srgb, var(--secondary), currentcolor)", OPERAND],
    ["a named color", "color-mix(in srgb, var(--secondary), white)", OPERAND],
    ["a nested mix", "color-mix(in srgb, var(--secondary), color-mix(in srgb, #fff, #000))", OPERAND],
    ["a var() fallback", "color-mix(in oklch, var(--secondary, red), #ffffff)", OPERAND],
    ["a percentage above 100%", "color-mix(in oklch, var(--secondary) 120%, #ffffff)", PERCENTAGE],
    ["a negative percentage", "color-mix(in oklch, var(--secondary), #ffffff -5%)", PERCENTAGE],
    [
      "two percentages of 0%",
      "color-mix(in oklch, var(--secondary) 0%, #ffffff 0%)",
      "A mix needs a percentage above 0%",
    ],
    ["relative color syntax", "oklch(from var(--primary) l c h / 0.5)", NOT_A_MIX],
    ["a var() inside another color function", "rgb(var(--secondary))", NOT_A_MIX],
    ["a function that is not a color", "calc(var(--secondary))", NOT_A_MIX],
    [
      "an unclosed function",
      "color-mix(in oklch, var(--secondary), #ffffff",
      "Not a color the studio can read",
    ],
    [
      "text after the function",
      "color-mix(in oklch, var(--secondary), #ffffff) x",
      "Not a color the studio can read",
    ],
  ])("refuses a color formula with %s", (_label, css, reason) => {
    expect(parseTokenValue("secondary-hover", css)).toEqual({ ok: false, reason });
  });

  it("takes a non-negative px or rem dimension", () => {
    expect(parseTokenValue("radius", "12px")).toEqual({ ok: true, css: "12px" });
    expect(parseTokenValue("radius", "0.75rem")).toEqual({ ok: true, css: "0.75rem" });
    expect(parseTokenValue("radius", ".5rem")).toEqual({ ok: true, css: ".5rem" });
    expect(parseTokenValue("radius", "1e1px")).toEqual({ ok: true, css: "1e1px" });
    expect(parseTokenValue("radius", "1em").ok).toBe(false);
    expect(parseTokenValue("radius", "-1px").ok).toBe(false);
  });

  it.each(["1.px", ".px", "1e", "1epx", "1.5.px", "px"])(
    "refuses %s, which is not a CSS number and unit",
    (css) => {
      expect(parseTokenValue("radius", css)).toEqual({ ok: false, reason: "Not a px or rem length" });
    }
  );

  it("takes only 0px or 2px for the radius step", () => {
    expect(parseTokenValue("radius-step", "2px")).toEqual({ ok: true, css: "2px" });
    expect(parseTokenValue("radius-step", "0px")).toEqual({ ok: true, css: "0px" });
    expect(parseTokenValue("radius-step", "1px")).toEqual({
      ok: false,
      reason: "The radius step is 0px or 2px",
    });
  });

  it("takes a font stack of plain or quoted family names", () => {
    expect(parseTokenValue("font-sans", "Inter, ui-sans-serif, sans-serif")).toEqual({
      ok: true,
      css: "Inter, ui-sans-serif, sans-serif",
    });
    expect(parseTokenValue("font-sans", "'Søk Sans', serif").ok).toBe(true);
    expect(parseTokenValue("font-sans", "url(x), serif").ok).toBe(false);
    expect(parseTokenValue("font-sans", "Inter,, serif").ok).toBe(false);
    expect(parseTokenValue("font-sans", '"Unclosed, serif').ok).toBe(false);
  });

  it("takes unquoted names that are CSS identifiers, and quoted names of free text", () => {
    expect(parseTokenValue("font-sans", "-apple-system, Segoe UI, _x").ok).toBe(true);
    expect(parseTokenValue("font-sans", '"123 Sans", serif').ok).toBe(true);
    expect(parseTokenValue("font-sans", "\"inherit\", 'default', serif").ok).toBe(true);
  });

  it.each([
    ["a bare number", "123, serif"],
    ["a word that starts with a digit", "Segoe 2UI, serif"],
    ["a word that starts with a dash and a digit", "-1abc, serif"],
    ["a quote inside a quoted name", `"Søk 'Sans", serif`],
    ["an unquoted CSS-wide keyword", "inherit, serif"],
    ["an unquoted CSS-wide keyword after a family", "Inter, initial"],
    ["an unquoted CSS-wide keyword in any case", "Inter, UNSET"],
    ["an unquoted revert", "revert, serif"],
    ["an unquoted revert-layer", "Inter, revert-layer"],
    ["an unquoted default", "default, serif"],
  ])("refuses a font stack with %s", (_label, css) => {
    expect(parseTokenValue("font-sans", css).ok).toBe(false);
  });

  it("takes a font weight from 1 to 1000", () => {
    expect(parseTokenValue("selection-title-weight", "1")).toEqual({ ok: true, css: "1" });
    expect(parseTokenValue("selection-title-weight", "1000")).toEqual({ ok: true, css: "1000" });
    expect(parseTokenValue("selection-title-weight", "650.5")).toEqual({ ok: true, css: "650.5" });
    expect(parseTokenValue("selection-title-weight", "0").ok).toBe(false);
    expect(parseTokenValue("selection-title-weight", "1001").ok).toBe(false);
    expect(parseTokenValue("selection-title-weight", "bold").ok).toBe(false);
  });

  it("refuses a value over the size limit and says so", () => {
    expect(parseTokenValue("font-sans", `a${", b".repeat(MAX_VALUE_LENGTH)}`)).toEqual({
      ok: false,
      reason: `Longer than ${String(MAX_VALUE_LENGTH)} characters`,
    });
  });

  it("refuses an empty value or one that could end the declaration", () => {
    expect(parseTokenValue("primary", " ").ok).toBe(false);
    expect(parseTokenValue("font-sans", "serif; color: red").ok).toBe(false);
  });
});

describe("createsCycle", () => {
  const BASE = seedOf({
    error: "oklch(0.6 0.2 25)",
    destructive: "var(--error)",
    border: "oklch(0.9 0 0)",
    secondary: "oklch(0.9 0 0)",
    foreground: "oklch(0.2 0 0)",
    "secondary-hover": "color-mix(in oklch, var(--secondary), var(--foreground) 5%)",
    "button-outline": "var(--border)",
  });

  it("finds the cycle an alias closes through a base declaration", () => {
    // destructive: var(--error) in the base, so error: var(--destructive) loops.
    expect(createsCycle(NONE, BASE, "light", "error", "var(--destructive)")).toBe(true);
    expect(createsCycle(NONE, BASE, "light", "error", "var(--border)")).toBe(false);
  });

  it("finds a self alias and a cycle through a mix", () => {
    expect(createsCycle(NONE, BASE, "light", "error", "var(--error)")).toBe(true);
    expect(createsCycle(NONE, BASE, "light", "secondary", "var(--secondary-hover)")).toBe(true);
  });

  it("finds a cycle through an edit", () => {
    const edited: StudioOverrides = { ...NONE, light: { border: "var(--secondary)" } };
    expect(createsCycle(edited, BASE, "light", "secondary", "var(--border)")).toBe(true);
    expect(createsCycle(edited, BASE, "dark", "secondary", "var(--border)")).toBe(false);
  });

  it("checks a light-only token in both schemes", () => {
    const schemes = seedOf(
      { border: "oklch(0.9 0 0)", "button-outline": "oklch(0.5 0 0)" },
      { border: "var(--button-outline)", "button-outline": "oklch(0.5 0 0)" }
    );
    expect(createsCycle(NONE, schemes, "light", "button-outline", "var(--border)")).toBe(true);
  });

  it("finds a cycle that a typed formula closes", () => {
    const formula = "color-mix(in oklch, var(--secondary-hover), #ffffff)";
    expect(createsCycle(NONE, BASE, "light", "secondary", formula)).toBe(true);
    expect(createsCycle(NONE, BASE, "light", "border", formula)).toBe(false);
  });

  it("finds no cycle in a literal", () => {
    expect(createsCycle(NONE, BASE, "light", "error", "#ff0000")).toBe(false);
  });
});
