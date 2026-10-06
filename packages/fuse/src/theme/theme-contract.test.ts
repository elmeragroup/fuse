import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseStyleRules } from "../../test/css-rules";
import { declaredThemeValue, SECONDARY_HOVER_CSS } from "../../test/theme-css-contract";
import { assertMustOverrideCoverage, composeTheme } from "./compose-theme";
import { contrastRatio } from "./contrast";
import { cssVarReference } from "./css-values";
import { generateThemesCss } from "./generate-css";
import { brandPointer } from "./tokens/brand-pointers";
import { assignedTokenNames, EXTERNAL_RESET_KEYS, MUST_OVERRIDE_DARK, TOKEN_NAMES } from "./tokens/contract";
import type { ExternalResetKey, TokenLayer, TokenName } from "./tokens/contract";
import { DEFAULTS } from "./tokens/defaults";
import { externalDarkPalette } from "./tokens/external-dark-palettes";
import { EXTERNAL_PALETTES, EXTERNAL_VARIANT_LAYER } from "./tokens/external-palettes";
import { INTERNAL_DARK_PALETTE } from "./tokens/internal-dark-palette";
import { paletteLayers } from "./tokens/palette-layers";
import { PRIMITIVES } from "./tokens/primitives";
import { THEME_RESET_KEYS } from "./tokens/reset-keys";
import { segmentSheet } from "./tokens/segment-sheets";
import { LEGAL_THEMES, themeSlug } from "./tokens/themes";

/** fkas-company's light sheet through the real accessor; the sheet table must keep it. */
function fkasCompanyLight(): TokenLayer {
  const sheet = segmentSheet("fkas", "company");
  if (sheet === undefined) {
    throw new Error("fkas-company has no segment sheet");
  }
  return sheet.light;
}

/**
 * The light reset keys every external brand palette assigns itself. Composition derives the
 * secondary hover, and the external variant layer sets its keys for every brand.
 */
type BrandPaletteKey = Exclude<ExternalResetKey, "secondary-hover" | keyof typeof EXTERNAL_VARIANT_LAYER>;

const BRAND_PALETTE_KEYS = EXTERNAL_RESET_KEYS.filter(
  (key): key is BrandPaletteKey => key !== "secondary-hover" && !(key in EXTERNAL_VARIANT_LAYER)
);

/** One declaration of the rule whose first selector is `selector`. */
function declaration(rules: ReturnType<typeof parseStyleRules>, selector: string, name: string) {
  return rules
    .find((rule) => rule.selector.split(",")[0]?.trim() === selector)
    ?.declarations.find((entry) => entry.name === name)?.value;
}

const EXPECTED_SELECTORS = [
  ":root",
  '[data-theme-brand="fkas"]',
  '[data-theme-brand="tkas"]',
  '[data-theme-brand="guen"]',
  '[data-theme-brand="fkab"]',
  '[data-theme-brand="fkse"]',
  '[data-theme-brand="elma"]',
  '[data-theme-variant="internal"]',
  '[data-theme-variant="external"][data-theme-brand="fkas"]',
  '[data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"]',
  '[data-theme-variant="external"][data-theme-brand="tkas"]',
  '[data-theme-variant="external"][data-theme-brand="guen"]',
  '[data-theme-variant="external"][data-theme-brand="fkab"]',
  '[data-theme-variant="external"][data-theme-brand="fkse"]',
  '[data-theme-variant="external"][data-theme-brand="elma"]',
];

/** A dark palette body's direct/descendant selector pair. */
function darkPalette(selector: string): string[] {
  return [`[data-theme="dark"]${selector}`, `[data-theme="dark"] ${selector}`];
}

/** A brand-scoped companion's pair: the scheme and qualifiers weigh nothing, the brand one attribute. */
function darkBrandScoped(qualifiers: string, brand: string): string[] {
  const subject = `[data-theme-brand="${brand}"]`;
  return [
    `:where([data-theme="dark"]${qualifiers})${subject}`,
    `:where([data-theme="dark"] ${qualifiers})${subject}`,
  ];
}

const INTERNAL = '[data-theme-variant="internal"]';
const EXTERNAL = '[data-theme-variant="external"]';
const COMPANY = '[data-theme-segment="company"]';

/**
 * The dark bodies in emission order. The internal palette is shared, and each internal brand
 * then gets its brand-scoped companion. Each external palette rule is followed by its own.
 */
const EXPECTED_DARK_SELECTORS = [
  darkPalette(INTERNAL),
  ...["fkas", "tkas", "guen", "fkab", "fkse", "elma"].map((brand) => darkBrandScoped(INTERNAL, brand)),
  darkPalette(`${EXTERNAL}[data-theme-brand="fkas"]`),
  darkBrandScoped(EXTERNAL, "fkas"),
  darkPalette(`${EXTERNAL}[data-theme-brand="fkas"]${COMPANY}`),
  darkBrandScoped(`${EXTERNAL}${COMPANY}`, "fkas"),
  ...["tkas", "guen", "fkab", "fkse", "elma"].flatMap((brand) => [
    darkPalette(`${EXTERNAL}[data-theme-brand="${brand}"]`),
    darkBrandScoped(EXTERNAL, brand),
  ]),
];

/** The derived roles that read the brand pointer, which only companion rules declare in dark. */
const BRAND_SCOPED_ROLES = ["sidebar-brand", "sidebar-brand-foreground"];

describe("theme contract", () => {
  const css = generateThemesCss();
  const rules = parseStyleRules(css);

  it("retains the light selectors and scopes dark rules to a theme variant", () => {
    const lightRules = rules.filter((rule) => !rule.selector.includes('[data-theme="dark"]'));
    const darkRules = rules.filter((rule) => rule.selector.includes('[data-theme="dark"]'));
    expect(lightRules.map((rule) => rule.selector)).toEqual(EXPECTED_SELECTORS);
    expect(css).not.toMatch(/\.fkas(?:-c)?\b/);
    expect(darkRules).toHaveLength(EXPECTED_DARK_SELECTORS.length);
    for (const [index, rule] of darkRules.entries()) {
      const selectors = rule.selector.split(",").map((part) => part.trim());
      expect(selectors, rule.selector).toHaveLength(2);
      expect(selectors, rule.selector).toEqual(EXPECTED_DARK_SELECTORS[index]);
    }
  });

  it("resets only the light palette keys in light rules and every dark key in dark rules", () => {
    for (const rule of rules.filter((entry) => !entry.selector.includes('[data-theme="dark"]'))) {
      if (rule.selector === ":root") continue;
      if (rule.selector.startsWith("[data-theme-brand=")) continue;
      if (rule.selector.includes("[data-theme-segment=")) continue;
      expect(
        rule.declarations.map((declaration) => declaration.name),
        rule.selector
      ).toEqual([...EXTERNAL_RESET_KEYS, "color-scheme"]);
    }
    // A dark palette rule leaves the brand-scoped roles to its companion, which declares
    // them alone. The palette rule beside it already sets the color scheme.
    for (const rule of rules.filter((entry) => entry.selector.includes('[data-theme="dark"]'))) {
      const expected = rule.selector.startsWith(":where(")
        ? BRAND_SCOPED_ROLES
        : [...THEME_RESET_KEYS.filter((key) => !BRAND_SCOPED_ROLES.includes(key)), "color-scheme"];
      expect(
        rule.declarations.map((declaration) => declaration.name),
        rule.selector
      ).toEqual(expected);
    }
  });

  it("materializes each composed theme in its emitted rules", () => {
    // Unit under test: generateThemesCss, the emitter. Oracle: composeTheme, the upstream
    // composer whose resolution the emitter must reproduce. Drift names the offending key
    // instead of only showing up as a snapshot diff.
    const byDirectSelector = new Map(rules.map((rule) => [rule.selector.split(",")[0]?.trim() ?? "", rule]));
    for (const colorScheme of ["light", "dark"] as const) {
      for (const theme of LEGAL_THEMES) {
        const slug = themeSlug(theme);
        const brand = `[data-theme-brand="${theme.brand}"]`;
        const segment = `[data-theme-segment="${theme.segment}"]`;
        // Each slot pairs a palette rule's selector with its qualifiers without the brand. In
        // dark, the palette rule's brand-scoped companion follows it.
        const slots: (readonly [string, string])[] =
          theme.variant === "internal"
            ? [[INTERNAL, INTERNAL]]
            : [
                [`${EXTERNAL}${brand}`, EXTERNAL],
                [`${EXTERNAL}${brand}${segment}`, `${EXTERNAL}${segment}`],
              ];
        const slotted = slots.flatMap(([selector, qualifiers]) =>
          colorScheme === "light"
            ? [selector]
            : [`[data-theme="dark"]${selector}`, `:where([data-theme="dark"]${qualifiers})${brand}`]
        );
        const declared = new Map<string, string>();
        for (const selector of slotted) {
          const rule = byDirectSelector.get(selector);
          if (rule === undefined) continue;
          for (const declaration of rule.declarations) declared.set(declaration.name, declaration.value);
        }
        expect(declared.size, `${colorScheme} ${slug} base rule`).toBeGreaterThan(0);
        const composed: Readonly<Record<string, string>> = composeTheme(theme, colorScheme);
        for (const [name, value] of declared) {
          if (name === "color-scheme") continue;
          const composedValue = composed[name];
          expect(composedValue, `${colorScheme} ${slug} ${name} is composed`).toBeDefined();
          expect(value, `${colorScheme} ${slug} ${name}`).toBe(declaredThemeValue(name, composedValue ?? ""));
        }
        // The brand pointer serves both schemes' brand pair and the light brand-scoped roles
        // from one rule; its values must still equal what composition resolves, or a nested
        // scope would inherit a pointer the composed theme never had. A dark companion
        // declares its own brand-scoped roles over the pointer's.
        const pointer = byDirectSelector.get(brand);
        expect(pointer, `${slug} brand pointer`).toBeDefined();
        if (colorScheme === "dark") {
          for (const name of BRAND_SCOPED_ROLES) {
            expect(declared.has(name), `${colorScheme} ${slug} declares ${name}`).toBe(true);
          }
        }
        const pointerNames = colorScheme === "light" ? BRAND_SCOPED_ROLES : [];
        for (const name of ["brand", "brand-foreground", ...pointerNames] as const) {
          expect(
            pointer?.declarations.find((declaration) => declaration.name === name)?.value,
            `${colorScheme} ${slug} brand pointer ${name}`
          ).toBe(composed[name]);
        }
      }
    }
  });

  it("matches the committed themes.css snapshot", async () => {
    await expect(css).toMatchFileSnapshot("./__snapshots__/themes.css");
  });

  it("gives every external dark palette the full set of must-override roles", () => {
    for (const theme of LEGAL_THEMES) {
      if (theme.variant !== "external") continue;
      const supplied = new Set(assignedTokenNames(externalDarkPalette(theme.brand, theme.segment)));
      const missing = MUST_OVERRIDE_DARK.filter((key) => !supplied.has(key));
      expect(missing, themeSlug(theme)).toEqual([]);
    }
    const internal = new Set(assignedTokenNames(INTERNAL_DARK_PALETTE));
    expect(MUST_OVERRIDE_DARK.filter((key) => !internal.has(key))).toEqual([]);
  });

  it("fails the light coverage gate for a dark-only token set", () => {
    // The brand pointer and dark palette layers never name the light-only geometry roles,
    // so the light gate must reject the set they supply on their own.
    const theme = { variant: "external", brand: "fkas", segment: "private" } as const;
    const darkOnly = new Set<TokenName>([
      ...assignedTokenNames(brandPointer(theme.brand)),
      ...paletteLayers(theme, "dark").flatMap((layer) => assignedTokenNames(layer)),
    ]);
    expect(() => assertMustOverrideCoverage(darkOnly, "external", "light", themeSlug(theme))).toThrow(
      /missing must-override tokens: .*radius/
    );
  });

  it("covers every key the external variant layer, a palette or a segment delta can override", () => {
    const supplied = new Set<string>(assignedTokenNames(EXTERNAL_VARIANT_LAYER));
    for (const palette of Object.values(EXTERNAL_PALETTES)) {
      for (const name of assignedTokenNames(palette)) {
        supplied.add(name);
      }
    }
    for (const name of assignedTokenNames(fkasCompanyLight())) {
      supplied.add(name);
    }
    // The secondary hover mixes secondary toward foreground. Both are palette keys, so a
    // light rule that resets them resets the hover too.
    expect(supplied.has("secondary") && supplied.has("foreground")).toBe(true);
    supplied.add("secondary-hover");

    expect([...supplied].toSorted((left, right) => left.localeCompare(right))).toEqual(
      [...EXTERNAL_RESET_KEYS].toSorted((left, right) => left.localeCompare(right))
    );
  });

  it("resets every dark override and rebinds aliases whose source role changes", () => {
    for (const name of assignedTokenNames(INTERNAL_DARK_PALETTE)) {
      expect(THEME_RESET_KEYS, `internal ${name}`).toContain(name);
    }
    for (const theme of LEGAL_THEMES) {
      if (theme.variant !== "external") continue;
      for (const name of assignedTokenNames(externalDarkPalette(theme.brand, theme.segment))) {
        expect(THEME_RESET_KEYS, `${themeSlug(theme)} ${name}`).toContain(name);
      }
    }
    expect(THEME_RESET_KEYS).toEqual(expect.arrayContaining([...EXTERNAL_RESET_KEYS]));
    const reset = new Set<string>(THEME_RESET_KEYS);
    for (const name of TOKEN_NAMES) {
      const target = cssVarReference(DEFAULTS[name]);
      if (target !== undefined && reset.has(target)) {
        expect(reset.has(name), `${name} rebinds to ${target}`).toBe(true);
      }
    }
    // The brand pair and the locked sans stack are the brand-pointer layer's and the
    // defaults'; every other role is a key some palette can change, or reads one. The sidebar
    // brand pair reads the sidebar, which every dark palette sets.
    const brandPointerRoles = new Set<string>(["brand", "brand-foreground", "font-sans"]);
    expect(THEME_RESET_KEYS).toEqual(TOKEN_NAMES.filter((name) => !brandPointerRoles.has(name)));
  });

  it("uses neutral internal dark surfaces with brand accents and preserves the fkab external alias", () => {
    for (const theme of LEGAL_THEMES) {
      if (theme.variant !== "internal") continue;
      const dark = composeTheme(theme, "dark");
      const light = composeTheme(theme);
      expect(dark.background).toBe("oklch(0.145 0 0)");
      expect(dark.foreground).toBe("oklch(0.985 0 0)");
      expect(dark.primary).toBe("oklch(0.922 0 0)");
      expect(dark.error).toBe("oklch(0.704 0.191 22.216)");
      expect(dark.destructive).toBe("var(--error)");
      expect(dark.input).toBe("oklch(1 0 0 / 40%)");
      // The sidebar brand pair is derived per scheme, so only the brand itself must agree;
      // contrast-matrix.test.ts holds the pair's contrast in both schemes.
      expect(dark.brand).toBe(light.brand);
      for (const key of [
        "radius",
        "radius-button",
        "radius-step",
        "button-outline",
        "button-outline-width",
        "font-sans",
        "font-heading",
      ] as const) {
        expect(dark[key]).toBe(light[key]);
      }
    }
    const fkab = composeTheme({ variant: "external", brand: "fkab", segment: "company" }, "dark");
    const fkas = composeTheme({ variant: "external", brand: "fkas", segment: "private" }, "dark");
    for (const key of THEME_RESET_KEYS) {
      expect(fkab[key], key).toBe(fkas[key]);
    }
  });

  it("builds standalone CSS without Preflight", () => {
    // The wrapper's source set — `source(none)` and the single dist `@source` — is
    // asserted once, in `styles/standalone-css.test.ts`. This test owns the one rule
    // that belongs to the token contract: a library never resets the host page.
    const wrapper = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../scripts/standalone.css"),
      "utf8"
    );
    expect(wrapper).toContain('@import "tailwindcss/theme.css"');
    expect(wrapper).toContain('@import "tailwindcss/utilities.css"');
    expect(wrapper).not.toContain("preflight");
  });
});

describe("elma identity", () => {
  const elmaThemes = LEGAL_THEMES.filter((theme) => theme.brand === "elma");
  const elmaRules = parseStyleRules(generateThemesCss());

  it("accepts the four legal elma slugs and pins the Elmera brand pair", () => {
    expect(elmaThemes).toHaveLength(4);
    expect(PRIMITIVES["brand-elma"]).toBe("oklch(0.28898 0.051828 217.7)");
    expect(PRIMITIVES["brand-elma-foreground"]).toBe("oklch(1 0 0)");
    expect(PRIMITIVES).not.toHaveProperty("brand-steddi");
    expect(PRIMITIVES).not.toHaveProperty("brand-ngef");
    expect(PRIMITIVES).not.toHaveProperty("brand-trumf");

    for (const theme of elmaThemes) {
      const composed = composeTheme(theme);
      expect(themeSlug(theme)).toBe(`${theme.variant}-elma-${theme.segment}`);
      expect(composed.brand).toBe("var(--brand-elma)");
      expect(composed["brand-foreground"]).toBe("var(--brand-elma-foreground)");
      for (const key of BRAND_PALETTE_KEYS) {
        const expected = theme.variant === "internal" ? DEFAULTS[key] : EXTERNAL_PALETTES.elma[key];
        expect(composed[key], `${themeSlug(theme)} ${key}`).toBe(expected);
      }
    }
  });

  it("emits a full external palette sourced from the Elmera sheet, not a default copy", () => {
    expect(
      assignedTokenNames(EXTERNAL_PALETTES.elma).toSorted((left, right) => left.localeCompare(right))
    ).toEqual([...BRAND_PALETTE_KEYS].toSorted((left, right) => left.localeCompare(right)));
    expect(EXTERNAL_PALETTES.elma.foreground).toBe("oklch(0.28898 0.051828 217.7)");
    expect(EXTERNAL_PALETTES.elma.foreground).not.toBe(DEFAULTS.foreground);
    expect(EXTERNAL_PALETTES.elma.primary).not.toBe(DEFAULTS.primary);

    const externalRule = elmaRules.find(
      (rule) => rule.selector === '[data-theme-variant="external"][data-theme-brand="elma"]'
    );
    expect(externalRule).toBeDefined();
    expect(externalRule?.declarations).toEqual(
      expect.arrayContaining([{ name: "foreground", value: "oklch(0.28898 0.051828 217.7)" }])
    );
    for (const key of BRAND_PALETTE_KEYS) {
      expect(externalRule?.declarations.find((entry) => entry.name === key)?.value).toBe(
        EXTERNAL_PALETTES.elma[key]
      );
    }
  });
});

describe("derived roles", () => {
  const internalFkas = { variant: "internal", brand: "fkas", segment: "private" } as const;
  const externalFkas = { variant: "external", brand: "fkas", segment: "private" } as const;

  it("mixes the secondary hover 5% from secondary toward foreground in OKLCH", () => {
    // Worked by hand from each theme's own secondary and foreground literals.
    // Internal light: 0.97 0 0 toward 0.15 0.0041 49.31. L 0.9215 + 0.0075, C 0.000205,
    // H 49.31 * 0.05.
    expect(composeTheme(internalFkas)["secondary-hover"]).toBe("oklch(0.929 0.000205 2.4655)");
    // Internal dark: 0.269 0 0 toward 0.985 0 0. L 0.25555 + 0.04925.
    expect(composeTheme(internalFkas, "dark")["secondary-hover"]).toBe("oklch(0.3048 0 0)");
    // External fkas paints secondary in its foreground color, so the hover keeps that color.
    expect(composeTheme(externalFkas)["secondary-hover"]).toBe("oklch(0.3209 0.10325 38.8)");
  });

  it("declares the live hover mix in the root rule and in each rule that resets its sources", () => {
    const rules = parseStyleRules(generateThemesCss());
    for (const selector of [
      ":root",
      '[data-theme-variant="internal"]',
      '[data-theme-variant="external"][data-theme-brand="fkas"]',
      // fkas-company's delta changes secondary and foreground, so its rule mixes them again.
      '[data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"]',
      '[data-theme="dark"][data-theme-variant="internal"]',
    ]) {
      expect(declaration(rules, selector, "secondary-hover"), selector).toBe(SECONDARY_HOVER_CSS);
    }
    // The brand pointer rule touches neither source, so it leaves the hover alone.
    expect(declaration(rules, '[data-theme-brand="fkas"]', "secondary-hover")).toBeUndefined();
  });
});

describe("external variant layer roles", () => {
  const rules = parseStyleRules(generateThemesCss());

  it("sets the radius step and the reference's 2px text-color outline once for the external variant", () => {
    const external = {
      "radius-step": "2px",
      "button-outline": "var(--foreground)",
      "button-outline-width": "2px",
    } as const;
    for (const [brand, palette] of Object.entries(EXTERNAL_PALETTES)) {
      for (const key of Object.keys(external)) {
        expect(palette, brand).not.toHaveProperty(key);
      }
    }
    for (const brand of ["fkas", "tkas", "guen", "fkab", "fkse", "elma"]) {
      const selector = `[data-theme-variant="external"][data-theme-brand="${brand}"]`;
      for (const [key, value] of Object.entries(external)) {
        expect(declaration(rules, selector, key), `${selector} ${key}`).toBe(value);
      }
    }
    // Internal themes and the root keep the 1px border hairline.
    for (const selector of [":root", '[data-theme-variant="internal"]']) {
      expect(declaration(rules, selector, "button-outline"), selector).toBe("var(--border)");
      expect(declaration(rules, selector, "button-outline-width"), selector).toBe("1px");
    }
  });
});

describe("external soft tones", () => {
  it("uses P-95 for primary-soft wherever the brand sheet supplies it, the same tone as secondary-soft", () => {
    for (const brand of ["fkas", "tkas", "fkse", "elma"] as const) {
      expect(EXTERNAL_PALETTES[brand]["primary-soft"], brand).toBe(
        EXTERNAL_PALETTES[brand]["secondary-soft"]
      );
    }
    const company = fkasCompanyLight();
    expect(company["primary-soft"]).toBe(company["secondary-soft"]);
  });
});

describe("contrast math", () => {
  it("composites percentage and decimal alpha in sRGB before measuring luminance", () => {
    expect(contrastRatio("oklch(1 0 0 / 50%)", "oklch(0 0 0)")).toBeCloseTo(5.2808, 4);
    expect(contrastRatio("oklch(1 0 0 / 0.5)", "oklch(0 0 0)")).toBeCloseTo(5.2808, 4);
  });

  it("proves the specified Elmera brand pair meets the text-grade floor", () => {
    expect(
      contrastRatio(PRIMITIVES["brand-elma-foreground"], PRIMITIVES["brand-elma"])
    ).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(PRIMITIVES["brand-elma-foreground"], PRIMITIVES["brand-elma"])).toBeCloseTo(
      13.93,
      1
    );
  });
});
