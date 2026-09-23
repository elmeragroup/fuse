import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { assertMustOverrideCoverage, composeTheme, coverageSchemes } from "./compose-theme";
import { contrastRatio } from "./contrast";
import { parseStyleRules } from "./css-rules";
import { generateThemesCss } from "./generate-css";
import { brandPointer } from "./tokens/brand-pointers";
import {
  assignedTokenNames,
  EXTERNAL_RESET_KEYS,
  isDerivedTokenName,
  MUST_OVERRIDE_DARK,
  TOKEN_NAMES,
} from "./tokens/contract";
import type { LayerTokenName, TokenLayer, TokenName } from "./tokens/contract";
import { DEFAULTS } from "./tokens/defaults";
import { DERIVED_TOKEN_SOURCES } from "./tokens/derived-tokens";
import { externalDarkPalette } from "./tokens/external-dark-palettes";
import { EXTERNAL_PALETTES } from "./tokens/external-palettes";
import { INTERNAL_DARK_PALETTE } from "./tokens/internal-dark-palette";
import { paletteLayers } from "./tokens/palette-layers";
import { PRIMITIVES } from "./tokens/primitives";
import { aliasTarget, THEME_RESET_KEYS } from "./tokens/reset-keys";
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

/** The light reset keys a palette layer assigns, without the derived roles composition adds. */
const LAYER_RESET_KEYS = EXTERNAL_RESET_KEYS.filter(
  (key): key is Extract<(typeof EXTERNAL_RESET_KEYS)[number], LayerTokenName> => !isDerivedTokenName(key)
);

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

/** The eight dark bodies in emission order, each pinned as its direct/descendant pair. */
const EXPECTED_DARK_SELECTORS = [
  '[data-theme-variant="internal"]',
  '[data-theme-variant="external"][data-theme-brand="fkas"]',
  '[data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"]',
  '[data-theme-variant="external"][data-theme-brand="tkas"]',
  '[data-theme-variant="external"][data-theme-brand="guen"]',
  '[data-theme-variant="external"][data-theme-brand="fkab"]',
  '[data-theme-variant="external"][data-theme-brand="fkse"]',
  '[data-theme-variant="external"][data-theme-brand="elma"]',
].map((selector) => [`[data-theme="dark"]${selector}`, `[data-theme="dark"] ${selector}`]);

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
    for (const rule of rules.filter((entry) => entry.selector.includes('[data-theme="dark"]'))) {
      expect(
        rule.declarations.map((declaration) => declaration.name),
        rule.selector
      ).toEqual([...THEME_RESET_KEYS, "color-scheme"]);
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
        const baseSelector =
          theme.variant === "internal"
            ? '[data-theme-variant="internal"]'
            : `[data-theme-variant="external"][data-theme-brand="${theme.brand}"]`;
        const slotted = [baseSelector];
        if (theme.variant === "external") {
          slotted.push(`${baseSelector}[data-theme-segment="${theme.segment}"]`);
        }
        const declared = new Map<string, string>();
        for (const selector of slotted) {
          const rule = byDirectSelector.get(
            colorScheme === "dark" ? `[data-theme="dark"]${selector}` : selector
          );
          if (rule === undefined) continue;
          for (const declaration of rule.declarations) declared.set(declaration.name, declaration.value);
        }
        expect(declared.size, `${colorScheme} ${slug} base rule`).toBeGreaterThan(0);
        const composed: Readonly<Record<string, string>> = composeTheme(theme, colorScheme);
        for (const [name, value] of declared) {
          if (name === "color-scheme") continue;
          expect(value, `${colorScheme} ${slug} ${name}`).toBe(composed[name]);
        }
        // The brand pointer serves both schemes from one light rule; its inherited
        // alias values must still equal what composition resolves, or a nested scope
        // would inherit a pointer the composed theme never had.
        const pointer = byDirectSelector.get(`[data-theme-brand="${theme.brand}"]`);
        expect(pointer, `${slug} brand pointer`).toBeDefined();
        for (const name of [
          "brand",
          "brand-foreground",
          "sidebar-brand",
          "sidebar-brand-foreground",
        ] as const) {
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

  it("selects a segment sheet only for a brand/segment pair that has one", () => {
    expect(fkasCompanyLight().background).toBe("oklch(0.9823 0.01428 213.1)");
    expect(segmentSheet("fkas", "private")).toBeUndefined();
    expect(segmentSheet("tkas", "company")).toBeUndefined();
    expect(segmentSheet("elma", "company")).toBeUndefined();
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

  it("gates the light layers on dark compositions too", () => {
    expect(coverageSchemes("light")).toEqual(["light"]);
    expect(coverageSchemes("dark")).toEqual(["light", "dark"]);
    // The dark layer alone never names the light-only geometry roles, so this is the set a
    // dark composition carries if it skips the light gate; the light gate rejects it.
    const theme = { variant: "external", brand: "fkas", segment: "private" } as const;
    const darkOnly = new Set<TokenName>([
      ...assignedTokenNames(brandPointer(theme.brand)),
      ...paletteLayers(theme, "dark").flatMap((layer) => assignedTokenNames(layer)),
    ]);
    expect(() => assertMustOverrideCoverage(darkOnly, "external", "light", themeSlug(theme))).toThrow(
      /missing must-override tokens: .*radius/
    );
  });

  it("emits a dark segment rule for every light segment rule", () => {
    const lightSegments = rules
      .filter((rule) => !rule.selector.includes('[data-theme="dark"]'))
      .filter((rule) => rule.selector.includes("[data-theme-segment="))
      .map((rule) => rule.selector);
    expect(lightSegments.length).toBeGreaterThan(0);
    for (const selector of lightSegments) {
      expect(
        rules.some((rule) => rule.selector.includes(`[data-theme="dark"]${selector}`)),
        selector
      ).toBe(true);
    }
  });

  it("covers every key any external palette or segment delta can override", () => {
    const supplied = new Set<string>();
    for (const palette of Object.values(EXTERNAL_PALETTES)) {
      for (const name of assignedTokenNames(palette)) {
        supplied.add(name);
      }
    }
    for (const name of assignedTokenNames(fkasCompanyLight())) {
      supplied.add(name);
    }
    // A derived role changes wherever one of its declared sources does.
    for (const [name, sources] of Object.entries(DERIVED_TOKEN_SOURCES)) {
      if (sources.some((source) => supplied.has(source))) {
        supplied.add(name);
      }
    }

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
      const target = aliasTarget(DEFAULTS[name]);
      if (target !== undefined && reset.has(target)) {
        expect(reset.has(name), `${name} rebinds to ${target}`).toBe(true);
      }
    }
    // The brand pair, its sidebar aliases, and the locked sans stack are the brand-pointer
    // layer's and the defaults'; every other role is a key some palette can change.
    const brandPointerRoles = new Set<string>([
      "brand",
      "brand-foreground",
      "sidebar-brand",
      "sidebar-brand-foreground",
      "font-sans",
    ]);
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
      expect(dark.brand).toBe(light.brand);
      expect(dark["sidebar-brand"]).toBe(light["sidebar-brand"]);
      expect(dark["sidebar-brand-foreground"]).toBe(light["sidebar-brand-foreground"]);
      for (const key of ["radius", "radius-button", "radius-step", "font-sans", "font-heading"] as const) {
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
      for (const key of LAYER_RESET_KEYS) {
        const expected = theme.variant === "internal" ? DEFAULTS[key] : EXTERNAL_PALETTES.elma[key];
        expect(composed[key], `${themeSlug(theme)} ${key}`).toBe(expected);
      }
    }
  });

  it("emits a full external palette sourced from the Elmera sheet, not a default copy", () => {
    expect(
      assignedTokenNames(EXTERNAL_PALETTES.elma).toSorted((left, right) => left.localeCompare(right))
    ).toEqual([...LAYER_RESET_KEYS].toSorted((left, right) => left.localeCompare(right)));
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
    for (const key of LAYER_RESET_KEYS) {
      expect(externalRule?.declarations.find((declaration) => declaration.name === key)?.value).toBe(
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

  it("declares the hover in the root rule and in each rule that resets its sources", () => {
    const rules = parseStyleRules(generateThemesCss());
    const hoverIn = (selector: string): string | undefined =>
      rules
        .find((rule) => rule.selector === selector)
        ?.declarations.find((declaration) => declaration.name === "secondary-hover")?.value;
    expect(hoverIn(":root")).toBe("oklch(0.929 0.000205 2.4655)");
    expect(hoverIn('[data-theme-variant="internal"]')).toBe("oklch(0.929 0.000205 2.4655)");
    expect(hoverIn('[data-theme-variant="external"][data-theme-brand="fkas"]')).toBe(
      "oklch(0.3209 0.10325 38.8)"
    );
    // fkas-company's delta changes secondary and foreground, so its rule carries the hover.
    expect(
      hoverIn('[data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"]')
    ).toBe("oklch(0.30579 0.03693 215.45)");
  });
});

describe("radius roles", () => {
  it("aliases the internal button radius to the one radius and collapses the scale step", () => {
    const internal = composeTheme({ variant: "internal", brand: "tkas", segment: "private" });
    expect(internal["radius-button"]).toBe("var(--radius)");
    expect(internal["radius-step"]).toBe("0px");
  });

  it("keeps external brand radii and spreads the scale in 2px steps", () => {
    const fkas = composeTheme({ variant: "external", brand: "fkas", segment: "private" });
    expect(fkas.radius).toBe("0.75rem");
    expect(fkas["radius-button"]).toBe("1.8125rem");
    expect(fkas["radius-step"]).toBe("2px");
    const tkas = composeTheme({ variant: "external", brand: "tkas", segment: "company" });
    expect(tkas.radius).toBe("0.95rem");
    expect(tkas["radius-button"]).toBe("0.95rem");
    expect(tkas["radius-step"]).toBe("2px");
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
  it("measures black text on white as 21:1", () => {
    expect(contrastRatio("oklch(0 0 0)", "oklch(1 0 0)")).toBeCloseTo(21, 1);
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
