import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { composeTheme } from "./compose-theme";
import { contrastRatio } from "./contrast";
import {
  computeNestedThemeDeclarations,
  computeThemeDeclarations,
  cssComments,
  parseStyleRules,
} from "./css-rules";
import { generateThemesCss } from "./generate-css";
import { assignedTokenNames, EXTERNAL_RESET_KEYS } from "./tokens/contract";
import { DEFAULTS } from "./tokens/defaults";
import { EXTERNAL_PALETTES } from "./tokens/external-palettes";
import { PRIMITIVES } from "./tokens/primitives";
import { FKAS_COMPANY_DELTA } from "./tokens/segment-deltas";
import { LEGAL_THEMES, themeSlug } from "./tokens/themes";

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
  '[data-theme-variant="external"][data-theme-brand="tkas"]',
  '[data-theme-variant="external"][data-theme-brand="guen"]',
  '[data-theme-variant="external"][data-theme-brand="fkab"]',
  '[data-theme-variant="external"][data-theme-brand="fkse"]',
  '[data-theme-variant="external"][data-theme-brand="elma"]',
  '[data-theme-variant="external"][data-theme-brand="fkas"][data-theme-segment="company"]',
];

describe("theme contract", () => {
  const css = generateThemesCss();
  const rules = parseStyleRules(css);

  it("emits exactly 15 rule nodes plus a terminal dark-placeholder comment", () => {
    expect(rules.map((rule) => rule.selector)).toEqual(EXPECTED_SELECTORS);
    expect(rules).toHaveLength(15);
    expect(css).not.toMatch(/\.fkas(?:-c)?\b/);

    const comments = cssComments(css);
    const lastComment = comments.at(-1);
    expect(lastComment).toBeDefined();
    expect(lastComment).toContain('[data-theme="dark"]');
    expect(css.trimEnd().endsWith(lastComment ?? "")).toBe(true);
    expect(rules.some((rule) => rule.selector.includes('[data-theme="dark"]'))).toBe(false);
  });

  it("matches the committed themes.css snapshot", async () => {
    await expect(css).toMatchFileSnapshot("./__snapshots__/themes.css");
  });

  it("covers every key any external palette or segment delta can override", () => {
    const supplied = new Set<string>();
    for (const palette of Object.values(EXTERNAL_PALETTES)) {
      for (const name of assignedTokenNames(palette)) {
        supplied.add(name);
      }
    }
    for (const name of assignedTokenNames(FKAS_COMPANY_DELTA)) {
      supplied.add(name);
    }

    expect([...supplied].toSorted((left, right) => left.localeCompare(right))).toEqual(
      [...EXTERNAL_RESET_KEYS].toSorted((left, right) => left.localeCompare(right))
    );
  });

  it("resolves all 20 themes and 400 nested-scope reset cases", () => {
    expect(LEGAL_THEMES).toHaveLength(20);

    for (const theme of LEGAL_THEMES) {
      const expected = composeTheme(theme);
      const computed = computeThemeDeclarations(rules, theme);
      for (const key of EXTERNAL_RESET_KEYS) {
        expect(computed.get(key), `${themeSlug(theme)} ${key}`).toBe(expected[key]);
      }
      expect(computed.get("brand")).toBe(`var(--brand-${theme.brand})`);
      expect(computed.get("brand-foreground")).toBe(`var(--brand-${theme.brand}-foreground)`);
    }

    let nestedCases = 0;
    for (const outer of LEGAL_THEMES) {
      for (const inner of LEGAL_THEMES) {
        nestedCases += 1;
        const expected = composeTheme(inner);
        const computed = computeNestedThemeDeclarations(rules, outer, inner);
        const label = `${themeSlug(outer)} > ${themeSlug(inner)}`;
        for (const key of EXTERNAL_RESET_KEYS) {
          expect(computed.get(key), `${label} ${key}`).toBe(expected[key]);
        }
        expect(computed.get("brand"), `${label} brand`).toBe(`var(--brand-${inner.brand})`);
        expect(computed.get("brand-foreground"), `${label} brand-foreground`).toBe(
          `var(--brand-${inner.brand}-foreground)`
        );
      }
    }
    expect(nestedCases).toBe(400);
  });

  it("builds standalone CSS without Preflight", () => {
    const wrapper = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../scripts/standalone.css"),
      "utf8"
    );
    expect(wrapper).toContain('@import "tailwindcss/theme.css"');
    expect(wrapper).toContain('@import "tailwindcss/utilities.css"');
    expect(wrapper).not.toContain("preflight");
    expect(wrapper).toContain('@source "../dist/**/*.js"');
  });
});

describe("elma identity", () => {
  const elmaThemes = LEGAL_THEMES.filter((theme) => theme.brand === "elma");
  const elmaRules = parseStyleRules(generateThemesCss());

  it("accepts the four legal elma slugs and copies grayscale defaults plus the brand pair", () => {
    expect(elmaThemes).toHaveLength(4);
    expect(PRIMITIVES["brand-elma"]).toBe("oklch(0.29 0.05 220.14)");
    expect(PRIMITIVES["brand-elma-foreground"]).toBe("oklch(1 0 0)");
    expect(PRIMITIVES).not.toHaveProperty("brand-steddi");
    expect(PRIMITIVES).not.toHaveProperty("brand-ngef");
    expect(PRIMITIVES).not.toHaveProperty("brand-trumf");

    for (const theme of elmaThemes) {
      const composed = composeTheme(theme);
      expect(themeSlug(theme)).toBe(`${theme.variant}-elma-${theme.segment}`);
      expect(composed.brand).toBe("var(--brand-elma)");
      expect(composed["brand-foreground"]).toBe("var(--brand-elma-foreground)");
      for (const key of EXTERNAL_RESET_KEYS) {
        expect(composed[key], `${themeSlug(theme)} ${key}`).toBe(DEFAULTS[key]);
      }
    }
  });

  it("emits an isolation external rule that is a default-copy, not a customer palette", () => {
    expect(
      assignedTokenNames(EXTERNAL_PALETTES.elma).toSorted((left, right) => left.localeCompare(right))
    ).toEqual([...EXTERNAL_RESET_KEYS].toSorted((left, right) => left.localeCompare(right)));
    for (const key of EXTERNAL_RESET_KEYS) {
      expect(EXTERNAL_PALETTES.elma[key]).toBe(DEFAULTS[key]);
    }

    const externalRule = elmaRules.find(
      (rule) => rule.selector === '[data-theme-variant="external"][data-theme-brand="elma"]'
    );
    expect(externalRule).toBeDefined();
    for (const key of EXTERNAL_RESET_KEYS) {
      expect(externalRule?.declarations.find((declaration) => declaration.name === key)?.value).toBe(
        DEFAULTS[key]
      );
    }
  });
});

describe("contrast math", () => {
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
