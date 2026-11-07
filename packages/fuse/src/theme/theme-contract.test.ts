import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import * as Hex from "@elmeragroup/color/hex";
import * as Oklch from "@elmeragroup/color/oklch";
import { getOrThrow } from "@elmeragroup/color/result";

import { parseStyleRules } from "../../test/css-rules";
import { declaredThemeValue, SECONDARY_HOVER_CSS } from "../../test/theme-css-contract";
import { assertMustOverrideCoverage, composeTheme } from "./compose-theme";
import { cssVarReference } from "./css-values";
import { generateThemesCss } from "./generate-css";
import { LEGAL_THEMES, themeSlug } from "./theme-input";
import { literalContrast } from "./token-color";
import { brandDarkPalette } from "./tokens/brand-dark-palettes";
import { BRAND_PALETTES, BRANDED_IDENTITY_LAYER, paletteBrand } from "./tokens/brand-palettes";
import { brandPointer } from "./tokens/brand-pointers";
import { assignedTokenNames, LIGHT_RESET_KEYS, MUST_OVERRIDE_DARK, TOKEN_NAMES } from "./tokens/contract";
import type { LightResetKey, TokenLayer, TokenName } from "./tokens/contract";
import { DEFAULTS } from "./tokens/defaults";
import { NEUTRAL_DARK_PALETTE } from "./tokens/neutral-dark-palette";
import { paletteLayers } from "./tokens/palette-layers";
import { PRIMITIVES } from "./tokens/primitives";
import { THEME_RESET_KEYS } from "./tokens/reset-keys";
import { segmentSheet } from "./tokens/segment-sheets";

/** fkas-company's light sheet through the real accessor; the sheet table must keep it. */
function fkasCompanyLight(): TokenLayer {
  const sheet = segmentSheet("fkas", "company");
  if (sheet === undefined) {
    throw new Error("fkas-company has no segment sheet");
  }
  return sheet.light;
}

/**
 * The light reset keys every brand palette assigns itself. Composition derives the secondary
 * hover, the sidebar ring aliases the ring, and the branded identity layer sets its keys for
 * every brand.
 */
type BrandPaletteKey = Exclude<
  LightResetKey,
  "secondary-hover" | "sidebar-ring" | keyof typeof BRANDED_IDENTITY_LAYER
>;

const BRAND_PALETTE_KEYS = LIGHT_RESET_KEYS.filter(
  (key): key is BrandPaletteKey =>
    key !== "secondary-hover" && key !== "sidebar-ring" && !(key in BRANDED_IDENTITY_LAYER)
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
  '[data-theme-brand="ngfi"]',
  '[data-theme-identity="neutral"]',
  '[data-theme-identity="branded"][data-theme-brand="fkas"]',
  '[data-theme-identity="branded"][data-theme-brand="fkas"][data-theme-segment="company"]',
  '[data-theme-identity="branded"][data-theme-brand="tkas"]',
  '[data-theme-identity="branded"][data-theme-brand="guen"]',
  '[data-theme-identity="branded"][data-theme-brand="fkab"]',
  '[data-theme-identity="branded"][data-theme-brand="fkse"]',
  '[data-theme-identity="branded"][data-theme-brand="elma"]',
  '[data-theme-identity="branded"][data-theme-brand="ngfi"]',
  // The corner rules, light-only and never restated by a dark rule.
  '[data-theme-identity="neutral"]',
  '[data-theme-identity="branded"][data-theme-brand="fkas"]',
  '[data-theme-identity="branded"][data-theme-brand="tkas"]',
  '[data-theme-identity="branded"][data-theme-brand="guen"]',
  '[data-theme-identity="branded"][data-theme-brand="fkab"]',
  '[data-theme-identity="branded"][data-theme-brand="fkse"]',
  '[data-theme-identity="branded"][data-theme-brand="elma"]',
  '[data-theme-identity="branded"][data-theme-brand="ngfi"]',
];

/** The corner roles and the private Button label floor every corner rule declares, in order. */
const CORNER_DECLARATIONS = ["radius", "radius-button", "radius-field", "radius-step", "button-label-px-min"];

/** Whether a light rule is a corner rule: it declares the corner roles and nothing else. */
function isCornerRule(rule: ReturnType<typeof parseStyleRules>[number]): boolean {
  return rule.declarations.some((entry) => entry.name === "radius-step");
}

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

const NEUTRAL = '[data-theme-identity="neutral"]';
const BRANDED = '[data-theme-identity="branded"]';
const COMPANY = '[data-theme-segment="company"]';

/**
 * The dark bodies in emission order. The neutral palette is shared, and each neutral brand
 * then gets its brand-scoped companion. Each branded palette rule is followed by its own.
 */
const EXPECTED_DARK_SELECTORS = [
  darkPalette(NEUTRAL),
  ...["fkas", "tkas", "guen", "fkab", "fkse", "elma", "ngfi"].map((brand) => darkBrandScoped(NEUTRAL, brand)),
  darkPalette(`${BRANDED}[data-theme-brand="fkas"]`),
  darkBrandScoped(BRANDED, "fkas"),
  darkPalette(`${BRANDED}[data-theme-brand="fkas"]${COMPANY}`),
  darkBrandScoped(`${BRANDED}${COMPANY}`, "fkas"),
  ...["tkas", "guen", "fkab", "fkse", "elma", "ngfi"].flatMap((brand) => [
    darkPalette(`${BRANDED}[data-theme-brand="${brand}"]`),
    darkBrandScoped(BRANDED, brand),
  ]),
];

/** The derived roles that read the brand pointer, which only companion rules declare in dark. */
const BRAND_SCOPED_ROLES = ["sidebar-brand", "sidebar-brand-foreground"];

/** The generated themes.css, and its style rules, parsed once for every suite that reads them. */
const THEMES_CSS = generateThemesCss();
const THEME_RULES = parseStyleRules(THEMES_CSS);

describe("theme contract", () => {
  const css = THEMES_CSS;
  const rules = THEME_RULES;

  it("retains the light selectors and scopes dark rules to a theme identity", () => {
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
      if (isCornerRule(rule)) {
        expect(
          rule.declarations.map((declaration) => declaration.name),
          rule.selector
        ).toEqual(CORNER_DECLARATIONS);
        continue;
      }
      expect(
        rule.declarations.map((declaration) => declaration.name),
        rule.selector
      ).toEqual([...LIGHT_RESET_KEYS, "color-scheme"]);
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
    // A neutral theme element matches two light rules of one selector, the palette reset and
    // the corner rule, so the rules are grouped by selector in emission order.
    const byDirectSelector = new Map<string, (typeof rules)[number][]>();
    for (const rule of rules) {
      const selector = rule.selector.split(",")[0]?.trim() ?? "";
      byDirectSelector.set(selector, [...(byDirectSelector.get(selector) ?? []), rule]);
    }
    for (const colorScheme of ["light", "dark"] as const) {
      for (const theme of LEGAL_THEMES) {
        const slug = themeSlug(theme);
        const brand = `[data-theme-brand="${theme.brand}"]`;
        const segment = `[data-theme-segment="${theme.segment}"]`;
        // Each slot pairs a palette rule's selector with its qualifiers without the brand. In
        // dark, the palette rule's brand-scoped companion follows it.
        const slots: (readonly [string, string])[] =
          theme.identity === "neutral"
            ? [[NEUTRAL, NEUTRAL]]
            : [
                [`${BRANDED}${brand}`, BRANDED],
                [`${BRANDED}${brand}${segment}`, `${BRANDED}${segment}`],
              ];
        const slotted = slots.flatMap(([selector, qualifiers]) =>
          colorScheme === "light"
            ? [selector]
            : [`[data-theme="dark"]${selector}`, `:where([data-theme="dark"]${qualifiers})${brand}`]
        );
        const declared = new Map<string, string>();
        for (const selector of slotted) {
          for (const rule of byDirectSelector.get(selector) ?? []) {
            for (const declaration of rule.declarations) declared.set(declaration.name, declaration.value);
          }
        }
        expect(declared.size, `${colorScheme} ${slug} base rule`).toBeGreaterThan(0);
        const composed: Readonly<Record<string, string>> = composeTheme(theme, colorScheme);
        for (const [name, value] of declared) {
          if (name === "color-scheme" || name === "button-label-px-min") continue;
          const composedValue = composed[name];
          expect(composedValue, `${colorScheme} ${slug} ${name} is composed`).toBeDefined();
          expect(value, `${colorScheme} ${slug} ${name}`).toBe(declaredThemeValue(name, composedValue ?? ""));
        }
        // The brand pointer serves both schemes' brand pair and the light brand-scoped roles
        // from one rule; its values must still equal what composition resolves, or a nested
        // scope would inherit a pointer the composed theme never had. A dark companion
        // declares its own brand-scoped roles over the pointer's.
        const pointer = byDirectSelector.get(brand)?.[0];
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

  it("declares no font in any theme rule", () => {
    // The owner ruling: themes name no fonts, and an app sets --font-sans and --font-heading.
    const declared = rules.flatMap((rule) =>
      rule.declarations
        .filter((entry) => entry.name.startsWith("font"))
        .map((entry) => `${rule.selector} ${entry.name}`)
    );
    expect(declared).toEqual([]);
  });

  it("matches the committed themes.css snapshot", async () => {
    await expect(css).toMatchFileSnapshot("./__snapshots__/themes.css");
  });

  it("gives every branded dark palette the full set of must-override roles", () => {
    for (const theme of LEGAL_THEMES) {
      if (theme.identity !== "branded") continue;
      const supplied = new Set(
        assignedTokenNames(brandDarkPalette(paletteBrand(theme.brand), theme.segment))
      );
      const missing = MUST_OVERRIDE_DARK.filter((key) => !supplied.has(key));
      expect(missing, themeSlug(theme)).toEqual([]);
    }
    const neutral = new Set(assignedTokenNames(NEUTRAL_DARK_PALETTE));
    expect(MUST_OVERRIDE_DARK.filter((key) => !neutral.has(key))).toEqual([]);
  });

  it("fails the light coverage gate when a branded theme leaves a must-override role to the defaults", () => {
    // The light layers of a branded theme supply every must-override role; drop the input
    // border from that set and the gate must name it.
    const theme = { identity: "branded", brand: "fkas", segment: "private" } as const;
    const supplied = new Set<TokenName>([
      ...assignedTokenNames(brandPointer(theme.brand)),
      ...paletteLayers(theme, "light").flatMap((layer) => assignedTokenNames(layer)),
    ]);
    expect(() => assertMustOverrideCoverage(supplied, "branded", "light", themeSlug(theme))).not.toThrow();
    supplied.delete("input");
    expect(() => assertMustOverrideCoverage(supplied, "branded", "light", themeSlug(theme))).toThrow(
      /missing must-override tokens: input$/
    );
  });

  it("covers every key the branded identity layer, a palette or a segment delta can override", () => {
    const supplied = new Set<string>(assignedTokenNames(BRANDED_IDENTITY_LAYER));
    for (const palette of Object.values(BRAND_PALETTES)) {
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
    // The sidebar ring aliases the ring, an identity-layer key, so a light rule that resets the
    // ring restates the alias too.
    expect(DEFAULTS["sidebar-ring"]).toBe("var(--ring)");
    expect(supplied.has("ring")).toBe(true);
    supplied.add("sidebar-ring");
    // No palette layer assigns a corner role: the corner sets own them.
    for (const name of ["radius", "radius-button", "radius-field", "radius-step"]) {
      expect(supplied.has(name), name).toBe(false);
    }

    expect([...supplied].toSorted((left, right) => left.localeCompare(right))).toEqual(
      [...LIGHT_RESET_KEYS].toSorted((left, right) => left.localeCompare(right))
    );
  });

  it("resets every dark override and rebinds aliases whose source role changes", () => {
    for (const name of assignedTokenNames(NEUTRAL_DARK_PALETTE)) {
      expect(THEME_RESET_KEYS, `neutral ${name}`).toContain(name);
    }
    for (const theme of LEGAL_THEMES) {
      if (theme.identity !== "branded") continue;
      for (const name of assignedTokenNames(brandDarkPalette(paletteBrand(theme.brand), theme.segment))) {
        expect(THEME_RESET_KEYS, `${themeSlug(theme)} ${name}`).toContain(name);
      }
    }
    expect(THEME_RESET_KEYS).toEqual(expect.arrayContaining([...LIGHT_RESET_KEYS]));
    const reset = new Set<string>(THEME_RESET_KEYS);
    for (const name of TOKEN_NAMES) {
      const target = cssVarReference(DEFAULTS[name]);
      if (target !== undefined && reset.has(target)) {
        expect(reset.has(name), `${name} rebinds to ${target}`).toBe(true);
      }
    }
    // The brand pair is the brand-pointer layer's and the corner roles are the corner sets';
    // every other role is a key some palette can change, or reads one. The sidebar brand pair
    // reads the sidebar, which every dark palette sets.
    const notPaletteRoles = new Set<string>([
      "brand",
      "brand-foreground",
      "radius",
      "radius-button",
      "radius-field",
      "radius-step",
    ]);
    expect(THEME_RESET_KEYS).toEqual(TOKEN_NAMES.filter((name) => !notPaletteRoles.has(name)));
  });

  it("uses neutral dark surfaces with brand accents", () => {
    for (const theme of LEGAL_THEMES) {
      if (theme.identity !== "neutral") continue;
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
        "radius-field",
        "radius-step",
        "card-border",
        "card-section-divider",
        "card-shadow",
        "button-outline",
        "selection-border",
        "selection-checked-border",
        "selection-divider",
        "selection-checked-divider",
        "selection-disabled-background",
        "selection-disabled-hatch",
        "selection-disabled-foreground",
        "toggle-pressed",
        "toggle-pressed-foreground",
        "button-outline-width",
        "selection-title-weight",
        "paragraph-leading-sm",
        "paragraph-leading-base",
        "paragraph-leading-lg",
        "heading-1-size",
        "heading-1-leading",
        "heading-1-weight",
        "heading-2-size",
        "heading-2-leading",
        "heading-2-weight",
        "heading-3-size",
        "heading-3-leading",
        "heading-3-weight",
      ] as const) {
        expect(dark[key]).toBe(light[key]);
      }
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
  const elmaRules = THEME_RULES;

  it("accepts the four legal elma slugs and pins the Elmera brand pair", () => {
    expect(elmaThemes).toHaveLength(4);
    expect(PRIMITIVES["brand-elma"]).toBe("oklch(0.28898 0.051828 217.7)");
    expect(PRIMITIVES["brand-elma-foreground"]).toBe("oklch(1 0 0)");
    expect(PRIMITIVES).not.toHaveProperty("brand-steddi");
    expect(PRIMITIVES).not.toHaveProperty("brand-trumf");

    for (const theme of elmaThemes) {
      const composed = composeTheme(theme);
      expect(themeSlug(theme)).toBe(`${theme.identity}-elma-${theme.segment}`);
      expect(composed.brand).toBe("var(--brand-elma)");
      expect(composed["brand-foreground"]).toBe("var(--brand-elma-foreground)");
      for (const key of BRAND_PALETTE_KEYS) {
        const expected = theme.identity === "neutral" ? DEFAULTS[key] : BRAND_PALETTES.elma[key];
        expect(composed[key], `${themeSlug(theme)} ${key}`).toBe(expected);
      }
    }
  });

  it("emits a full branded palette sourced from the Elmera sheet, not a default copy", () => {
    expect(
      assignedTokenNames(BRAND_PALETTES.elma).toSorted((left, right) => left.localeCompare(right))
    ).toEqual([...BRAND_PALETTE_KEYS].toSorted((left, right) => left.localeCompare(right)));
    expect(BRAND_PALETTES.elma.foreground).toBe("oklch(0.28898 0.051828 217.7)");
    expect(BRAND_PALETTES.elma.foreground).not.toBe(DEFAULTS.foreground);
    expect(BRAND_PALETTES.elma.primary).not.toBe(DEFAULTS.primary);

    const brandedRule = elmaRules.find(
      (rule) =>
        rule.selector === '[data-theme-identity="branded"][data-theme-brand="elma"]' && !isCornerRule(rule)
    );
    expect(brandedRule).toBeDefined();
    expect(brandedRule?.declarations).toEqual(
      expect.arrayContaining([{ name: "foreground", value: "oklch(0.28898 0.051828 217.7)" }])
    );
    for (const key of BRAND_PALETTE_KEYS) {
      expect(brandedRule?.declarations.find((entry) => entry.name === key)?.value).toBe(
        BRAND_PALETTES.elma[key]
      );
    }
  });
});

/** A token literal as the opaque sRGB hex Figma shows, through the shared color parser. */
function figmaHex(value: string): string {
  return Hex.formatOpaque(Oklch.toSrgb(getOrThrow(Oklch.parse(value)))).toUpperCase();
}

describe("ngfi identity", () => {
  // The oracle is the Nordic Green Energy Material 3 scheme in Figma file
  // q1sEYcZWmf1HUeuiaJFqm6, section 129:12419, read 2026-10-05, mapped to roles by meaning.
  const LIGHT_SCHEME: readonly (readonly [TokenName, string])[] = [
    ["background", "#F7FAF6"], // surface
    ["foreground", "#181C1A"], // on-surface
    ["card", "#FFFFFF"], // surface-container-lowest
    ["card-foreground", "#181C1A"],
    ["card-soft", "#F1F4F1"], // surface-container-low
    ["muted-foreground", "#3F4944"], // on-surface-variant
    ["primary", "#004B39"],
    ["primary-foreground", "#FFFFFF"], // on-primary
    ["primary-soft", "#CEEEDF"], // secondary-container
    ["primary-soft-foreground", "#345045"], // on-secondary-container
    ["secondary", "#181C1A"],
    ["secondary-soft", "#CEEEDF"],
    ["feature", "#1E725A"], // primary-container
    ["feature-foreground", "#FFFFFF"], // on-primary-container
    ["feature-bright", "#87D6B9"], // primary-fixed-dim
    ["border", "#BEC9C3"], // outline-variant
  ];
  const DARK_SCHEME: readonly (readonly [TokenName, string])[] = [
    ["background", "#101412"], // surface
    ["foreground", "#E0E3E0"], // on-surface
    ["card", "#1C201E"], // surface-container
    ["card-soft", "#101412"],
    ["primary", "#87D6B9"],
    ["primary-foreground", "#00382A"], // on-primary
    ["primary-soft", "#29453B"], // secondary-container
    ["primary-soft-foreground", "#BCDBCD"], // on-secondary-container
    ["secondary", "#E0E3E0"],
    ["secondary-foreground", "#1A362C"], // on-secondary
    ["feature", "#005742"], // primary-container
    ["feature-foreground", "#A9F9DA"], // on-primary-container
    ["feature-bright", "#1C201E"], // surface-container, the card tone as on the other dark sheets
  ];

  it("accepts the four legal ngfi slugs and pins the Nordic Green Energy brand pair", () => {
    const ngfiThemes = LEGAL_THEMES.filter((theme) => theme.brand === "ngfi");
    expect(ngfiThemes.map(themeSlug)).toEqual([
      "neutral-ngfi-private",
      "neutral-ngfi-company",
      "branded-ngfi-private",
      "branded-ngfi-company",
    ]);
    expect(figmaHex(PRIMITIVES["brand-ngfi"])).toBe("#004B39");
    expect(PRIMITIVES["brand-ngfi-foreground"]).toBe("oklch(1 0 0)");
    for (const theme of ngfiThemes) {
      const composed = composeTheme(theme);
      expect(composed.brand).toBe("var(--brand-ngfi)");
      expect(composed["brand-foreground"]).toBe("var(--brand-ngfi-foreground)");
    }
  });

  it("paints the branded light and dark roles from the Nordic Green Energy scheme", () => {
    for (const segment of ["private", "company"] as const) {
      const light = composeTheme({ identity: "branded", brand: "ngfi", segment });
      const dark = composeTheme({ identity: "branded", brand: "ngfi", segment }, "dark");
      for (const [role, hex] of LIGHT_SCHEME) {
        expect(figmaHex(light[role]), `light ${segment} ${role}`).toBe(hex);
      }
      for (const [role, hex] of DARK_SCHEME) {
        expect(figmaHex(dark[role]), `dark ${segment} ${role}`).toBe(hex);
      }
    }
  });
});

describe("fkse identity", () => {
  // The oracle is the Alias/Surface/On Surface Variant colour in the Telinet Figma file
  // gzLEvCCAiwRqzoEPMBesdx, the role `feature-foreground` maps onto.
  it("paints the branded light feature foreground in the Telinet green", () => {
    const light = composeTheme({ identity: "branded", brand: "fkse", segment: "private" });
    expect(figmaHex(light["feature-foreground"])).toBe("#36C275");
  });
});

describe("derived roles", () => {
  const neutralFkas = { identity: "neutral", brand: "fkas", segment: "private" } as const;
  const brandedFkas = { identity: "branded", brand: "fkas", segment: "private" } as const;

  it("mixes the secondary hover 5% from secondary toward foreground in OKLCH", () => {
    // Worked by hand from each theme's own secondary and foreground literals.
    // Neutral light: 0.97 0 0 toward 0.15 0.0041 49.31. L 0.9215 + 0.0075, C 0.000205,
    // H 49.31 * 0.05.
    expect(composeTheme(neutralFkas)["secondary-hover"]).toBe("oklch(0.929 0.000205 2.4655)");
    // Neutral dark: 0.269 0 0 toward 0.985 0 0. L 0.25555 + 0.04925.
    expect(composeTheme(neutralFkas, "dark")["secondary-hover"]).toBe("oklch(0.3048 0 0)");
    // Branded fkas light: its orange secondary 0.4848 0.16637 35.92 toward its foreground
    // 0.3209 0.10325 38.8. L 0.46056 + 0.016045, C 0.1580515 + 0.0051625, H 34.124 + 1.94.
    expect(composeTheme(brandedFkas)["secondary-hover"]).toBe("oklch(0.476605 0.163214 36.064)");
  });

  it("declares the live hover mix in the root rule and in each rule that resets its sources", () => {
    const rules = THEME_RULES;
    for (const selector of [
      ":root",
      '[data-theme-identity="neutral"]',
      '[data-theme-identity="branded"][data-theme-brand="fkas"]',
      // fkas-company's delta changes secondary and foreground, so its rule mixes them again.
      '[data-theme-identity="branded"][data-theme-brand="fkas"][data-theme-segment="company"]',
      '[data-theme="dark"][data-theme-identity="neutral"]',
    ]) {
      expect(declaration(rules, selector, "secondary-hover"), selector).toBe(SECONDARY_HOVER_CSS);
    }
    // The brand pointer rule touches neither source, so it leaves the hover alone.
    expect(declaration(rules, '[data-theme-brand="fkas"]', "secondary-hover")).toBeUndefined();
  });
});

describe("branded identity layer roles", () => {
  const rules = THEME_RULES;

  it("sets the transparent card edge and shadow, the page-tinted card section divider, the reference's 2px text-color outline, the transparent selection row edge, checked or not, the grey divider between stacked rows, the card-filled unstriped disabled row with its muted text, the primary pressed toggle, the medium selection row title, the 14/20, 16/22 and 18/24 paragraph line heights and the bold 24/32 h1 and 20/32 h2 and h3 once for the branded identity", () => {
    const branded = {
      "card-border": "oklch(0 0 0 / 0)",
      "card-section-divider": "var(--background)",
      "card-shadow": "oklch(0 0 0 / 0)",
      "button-outline": "var(--foreground)",
      "button-outline-width": "2px",
      "selection-border": "oklch(0 0 0 / 0)",
      "selection-checked-border": "var(--selection-border)",
      "selection-divider": "var(--border)",
      "selection-checked-divider": "var(--selection-divider)",
      "selection-disabled-background": "var(--card)",
      "selection-disabled-hatch": "oklch(0 0 0 / 0)",
      "selection-disabled-foreground": "var(--muted-foreground)",
      "toggle-pressed": "var(--primary)",
      "toggle-pressed-foreground": "var(--primary-foreground)",
      "selection-title-weight": "500",
      "paragraph-leading-sm": "1.25rem",
      "paragraph-leading-base": "1.375rem",
      "paragraph-leading-lg": "1.5rem",
      "heading-1-size": "1.5rem",
      "heading-1-leading": "2rem",
      "heading-1-weight": "700",
      "heading-2-size": "1.25rem",
      "heading-2-leading": "2rem",
      "heading-2-weight": "700",
      "heading-3-size": "1.25rem",
      "heading-3-leading": "2rem",
      "heading-3-weight": "700",
    } as const;
    for (const [brand, palette] of Object.entries(BRAND_PALETTES)) {
      for (const key of Object.keys(branded)) {
        expect(palette, brand).not.toHaveProperty(key);
      }
    }
    for (const brand of ["fkas", "tkas", "guen", "fkab", "fkse", "elma", "ngfi"]) {
      const selector = `[data-theme-identity="branded"][data-theme-brand="${brand}"]`;
      for (const [key, value] of Object.entries(branded)) {
        expect(declaration(rules, selector, key), `${selector} ${key}`).toBe(value);
      }
    }
    // Neutral themes and the root keep the border-coloured card edge, Tailwind's 5% black card
    // shadow, the 1px border hairline,
    // the border-coloured selection row edge, the primary checked-row edge, dividers that follow
    // those edges, the muted disabled row striped in black at 2% with foreground text, the
    // muted pressed toggle with foreground text, the regular selection row title, the relaxed 1.625 paragraph line heights at 14, 16 and 18px,
    // the 500-weight h1 at 24px, h2 at 18px and h3 at 16px with snug 1.375 line heights, 33,
    // 24.75 and 22px.
    for (const selector of [":root", '[data-theme-identity="neutral"]']) {
      expect(declaration(rules, selector, "card-border"), selector).toBe("var(--border)");
      expect(declaration(rules, selector, "card-section-divider"), selector).toBe("var(--border)");
      expect(declaration(rules, selector, "card-shadow"), selector).toBe("oklch(0 0 0 / 0.05)");
      expect(declaration(rules, selector, "button-outline"), selector).toBe("var(--border)");
      expect(declaration(rules, selector, "selection-border"), selector).toBe("var(--border)");
      expect(declaration(rules, selector, "selection-checked-border"), selector).toBe("var(--primary)");
      expect(declaration(rules, selector, "selection-divider"), selector).toBe("var(--selection-border)");
      expect(declaration(rules, selector, "selection-checked-divider"), selector).toBe(
        "var(--selection-checked-border)"
      );
      expect(declaration(rules, selector, "selection-disabled-background"), selector).toBe("var(--muted)");
      expect(declaration(rules, selector, "selection-disabled-hatch"), selector).toBe("oklch(0 0 0 / 0.02)");
      expect(declaration(rules, selector, "selection-disabled-foreground"), selector).toBe(
        "var(--foreground)"
      );
      expect(declaration(rules, selector, "toggle-pressed"), selector).toBe("var(--muted)");
      expect(declaration(rules, selector, "toggle-pressed-foreground"), selector).toBe("var(--foreground)");
      expect(declaration(rules, selector, "button-outline-width"), selector).toBe("1px");
      expect(declaration(rules, selector, "selection-title-weight"), selector).toBe("400");
      expect(declaration(rules, selector, "paragraph-leading-sm"), selector).toBe("1.421875rem");
      expect(declaration(rules, selector, "paragraph-leading-base"), selector).toBe("1.625rem");
      expect(declaration(rules, selector, "paragraph-leading-lg"), selector).toBe("1.828125rem");
      for (const [key, value] of [
        ["heading-1-size", "1.5rem"],
        ["heading-1-leading", "2.0625rem"],
        ["heading-1-weight", "500"],
        ["heading-2-size", "1.125rem"],
        ["heading-2-leading", "1.546875rem"],
        ["heading-2-weight", "500"],
        ["heading-3-size", "1rem"],
        ["heading-3-leading", "1.375rem"],
        ["heading-3-weight", "500"],
      ] as const) {
        expect(declaration(rules, selector, key), `${selector} ${key}`).toBe(value);
      }
    }
  });
});

describe("corner rules", () => {
  const rules = THEME_RULES;
  const cornerRules = rules.filter(isCornerRule);

  /** The declarations of the one corner rule whose selector is `selector`. */
  function corners(selector: string): Record<string, string> {
    const matched = cornerRules.filter((rule) => rule.selector === selector);
    expect(matched, selector).toHaveLength(1);
    return Object.fromEntries((matched[0]?.declarations ?? []).map((entry) => [entry.name, entry.value]));
  }

  // The oracle is the corner policy, written out: neutral rounds every element with one 8px
  // radius and steps 0px; each brand takes its own radius and button radius and steps 2px.
  // Every set ties the field corner to the element's own --radius, and only branded buttons
  // floor their label edges at 12px.
  const BRANDED_CORNERS = {
    fkas: ["0.75rem", "1.8125rem"],
    tkas: ["1rem", "1rem"],
    guen: ["0.5rem", "0.5rem"],
    fkab: ["0.75rem", "1.8125rem"],
    fkse: ["0.75rem", "1.8125rem"],
    elma: ["0.375rem", "0.375rem"],
    ngfi: ["0.375rem", "1.8125rem"],
  } as const;

  it("gives neutral theme elements the one radius and a zero step", () => {
    expect(corners(NEUTRAL)).toEqual({
      radius: "0.5rem",
      "radius-button": "var(--radius)",
      "radius-field": "var(--radius)",
      "radius-step": "0px",
      "button-label-px-min": "0px",
    });
  });

  it.each(Object.entries(BRANDED_CORNERS))(
    "gives branded %s its brand corners",
    (brand, [radius, button]) => {
      expect(corners(`${BRANDED}[data-theme-brand="${brand}"]`)).toEqual({
        radius,
        "radius-button": button,
        "radius-field": "var(--radius)",
        "radius-step": "2px",
        "button-label-px-min": "0.75rem",
      });
    }
  );

  it("keeps corners out of the dark rules and the color scheme out of the corner rules", () => {
    const cornerNames = new Set(CORNER_DECLARATIONS);
    for (const rule of rules.filter((entry) => entry.selector.includes('[data-theme="dark"]'))) {
      expect(
        rule.declarations.filter((entry) => cornerNames.has(entry.name)),
        rule.selector
      ).toEqual([]);
    }
    for (const rule of cornerRules) {
      expect(
        rule.declarations.map((entry) => entry.name),
        rule.selector
      ).not.toContain("color-scheme");
    }
  });

  it("composes each theme's corners into its full contract in both schemes", () => {
    // Unit under test: composeTheme. Oracle: the corner policy above, which the catalog and the
    // Figma sync read through the composed contract.
    for (const theme of LEGAL_THEMES) {
      for (const scheme of ["light", "dark"] as const) {
        const composed = composeTheme(theme, scheme);
        const [radius, button] =
          theme.identity === "neutral" ? ["0.5rem", "var(--radius)"] : BRANDED_CORNERS[theme.brand];
        expect(
          [composed.radius, composed["radius-button"], composed["radius-field"], composed["radius-step"]],
          `${themeSlug(theme)} ${scheme}`
        ).toEqual([radius, button, "var(--radius)", theme.identity === "neutral" ? "0px" : "2px"]);
      }
    }
  });
});

describe("branded soft tones", () => {
  it("uses P-95 for primary-soft wherever the brand sheet supplies it, the same tone as secondary-soft", () => {
    for (const brand of ["fkas", "tkas", "fkse", "elma", "ngfi"] as const) {
      expect(BRAND_PALETTES[brand]["primary-soft"], brand).toBe(BRAND_PALETTES[brand]["secondary-soft"]);
    }
    const company = fkasCompanyLight();
    expect(company["primary-soft"]).toBe(company["secondary-soft"]);
  });
});

describe("contrast math", () => {
  it("composites percentage and decimal alpha in sRGB before measuring luminance", () => {
    expect(literalContrast("oklch(1 0 0 / 50%)", "oklch(0 0 0)")).toBeCloseTo(5.2808, 4);
    expect(literalContrast("oklch(1 0 0 / 0.5)", "oklch(0 0 0)")).toBeCloseTo(5.2808, 4);
  });

  it("proves the specified Elmera brand pair meets the text-grade floor", () => {
    expect(
      literalContrast(PRIMITIVES["brand-elma-foreground"], PRIMITIVES["brand-elma"])
    ).toBeGreaterThanOrEqual(4.5);
    expect(literalContrast(PRIMITIVES["brand-elma-foreground"], PRIMITIVES["brand-elma"])).toBeCloseTo(
      13.93,
      1
    );
  });
});
