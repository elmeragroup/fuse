import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { THEME_CATALOG } from "../src/generated/theme-catalog";
import type { ThemeCatalogEntry } from "../src/lib/docs-model";
import { docsBaseUrl } from "./docs-server";

const here = dirname(fileURLToPath(import.meta.url));
const appsRoot = join(here, "../../");

/** The four permutations the pin table forbids. */
const ILLEGAL_SLUGS = [
  "neutral-fkab-private",
  "branded-fkab-private",
  "neutral-fkse-company",
  "branded-fkse-company",
] as const;

// Counts the derived `secondary-hover` role, the `radius-step` rung spacing, the
// `radius-field` field corner, the card edge, section divider and shadow, the two outline Button roles, the resting and
// checked selection row borders and dividers, the disabled selection row fill, stripe and text,
// the pressed Toggle fill and label, the selection row title weight, the three paragraph line
// heights, the size, line height and weight of h1 to h3, the modal fill and text, the
// content panel fill and text, the 26 chart roles: 8 slot foregrounds, Other and its
// foreground, 7 ramp steps, 7 diverging steps and 2 sentiments, and 11 steps from 50 to 950 in
// each of the three brand ramps: the brand neutral ramp and brand palettes 1 and 2. Themes name
// no fonts, so `font-sans` and `font-heading` are not tokens.
const ROLE_TOKEN_COUNT = 168;

function catalogTheme(slug: string): ThemeCatalogEntry {
  const theme = THEME_CATALOG.themes.find((entry) => entry.slug === slug);
  expect(theme, slug).toBeDefined();
  if (theme === undefined) {
    throw new Error(`missing theme ${slug}`);
  }
  return theme;
}

function firstCatalogTheme(): ThemeCatalogEntry {
  const [theme] = THEME_CATALOG.themes;
  if (theme === undefined) {
    throw new Error("the theme catalog has no theme");
  }
  return theme;
}

describe("theme catalog payload", () => {
  it("emits one row per legal theme, never an illegal slug", () => {
    expect(THEME_CATALOG.legalThemeCount).toBe(24);
    expect(THEME_CATALOG.themes).toHaveLength(24);
    const slugs = THEME_CATALOG.themes.map((theme) => theme.slug);
    expect(new Set(slugs).size).toBe(24);
    for (const slug of ILLEGAL_SLUGS) {
      expect(slugs).not.toContain(slug);
    }
  });

  it("pairs each identity with the docs site.s density and stamps matching attributes on every row", () => {
    // The first and last role in TOKEN_NAMES order; the fuse catalog suite pins the full order.
    const tokenKeys = Object.keys(firstCatalogTheme().tokens);
    expect(tokenKeys).toHaveLength(ROLE_TOKEN_COUNT);
    expect(tokenKeys[0]).toBe("--background");
    expect(tokenKeys.at(-1)).toBe("--heading-3-weight");
    for (const theme of THEME_CATALOG.themes) {
      const density = theme.identity === "neutral" ? "dense" : "comfortable";
      expect(theme.density).toBe(density);
      expect(theme.attributes).toEqual({
        "data-theme-identity": theme.identity,
        "data-theme-brand": theme.brand,
        "data-theme-segment": theme.segment,
        "data-density": density,
      });
      const keys = Object.keys(theme.tokens);
      expect(keys).toHaveLength(ROLE_TOKEN_COUNT);
      expect(keys).toEqual(tokenKeys);
      for (const name of keys) {
        expect(name.startsWith("--")).toBe(true);
      }
    }
  });

  it("names the identity on the same object as that theme's token values, as the cascade writes them", () => {
    const branded = catalogTheme("branded-fkas-private");
    expect(branded.identity).toBe("branded");
    expect(branded.brand).toBe("fkas");
    expect(branded.segment).toBe("private");
    expect(branded.density).toBe("comfortable");
    expect(branded.tokens["--primary"]).toBe("oklch(0.3209 0.10325 38.8)");
    expect(branded.tokens["--primary-foreground"]).toBe("oklch(1 0 0)");

    const neutral = catalogTheme("neutral-elma-private");
    expect(neutral.identity).toBe("neutral");
    expect(neutral.brand).toBe("elma");
    expect(neutral.segment).toBe("private");
    expect(neutral.density).toBe("dense");
    expect(neutral.tokens["--primary"]).toBe("oklch(0.16 0 0)");
    expect(neutral.tokens["--primary-foreground"]).toBe("oklch(1 0 0)");

    // CSS custom-property names and var() values stay as the cascade writes them.
    expect(branded.attributes).toEqual({
      "data-theme-identity": "branded",
      "data-theme-brand": "fkas",
      "data-theme-segment": "private",
      "data-density": "comfortable",
    });
    expect(branded.tokens["--brand"]).toBe("var(--brand-fkas)");
    expect(branded.tokens["--brand-foreground"]).toBe("var(--brand-fkas-foreground)");
    expect(branded.tokens["--destructive"]).toBe("var(--error)");
    expect(branded.tokens["--sidebar-brand-foreground"]).toBe("var(--brand-foreground)");

    expect(THEME_CATALOG.primitives["--brand-fkas"]).toBe("oklch(0.68 0.21747 38.8)");
    expect(THEME_CATALOG.primitives["--brand-fkab"]).toBe("var(--brand-fkas)");
  });
});

describe("workspace package boundary", () => {
  it("does not list transpilePackages in the docs host", () => {
    // oxlint-disable-next-line fuse/no-source-reading-tests -- consumer-compatibility contract: the docs host runs Fuse's built output as a consumer does; transpilePackages would compile the source instead
    expect(readFileSync(join(appsRoot, "docs/next.config.ts"), "utf8")).not.toContain("transpilePackages");
  });
});

describe("GET /api/themes", () => {
  it("returns the catalog as JSON", async () => {
    const response = await fetch(new URL("/api/themes", docsBaseUrl()));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body: unknown = await response.json();
    expect(body).toEqual(THEME_CATALOG);
  });
});
