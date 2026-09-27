import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { themeSlug } from "@elmeragroup/fuse/theme";

import { sizeBudgetsFile } from "../scripts/lib/paths.ts";
import { parseBudgets } from "../scripts/lib/sizes.ts";
import { BUNDLE_SIZES, BUNDLE_SIZES_MEASURED_ON } from "../src/generated/bundle-sizes";
import { COLOR_TOKENS } from "../src/generated/token-reference";
import { LEGAL_THEMES } from "../src/lib/theme";
import { fetchText } from "./docs-server";

/** The four permutations the pin table forbids; none may reach the DOM. */
const ILLEGAL_SLUGS = [
  "internal-fkab-private",
  "external-fkab-private",
  "internal-fkse-company",
  "external-fkse-company",
] as const;

/** The grid itself, without the prose around it. */
async function matrixGrid(): Promise<string> {
  const html = await fetchText("/handbook/theme-matrix");
  const start = html.indexOf("data-theme-matrix");
  const end = html.indexOf('id="overlays"');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
}

describe("theme matrix", () => {
  it("enumerates 20 legal permutations, including elma", () => {
    expect(LEGAL_THEMES).toHaveLength(20);
    expect(LEGAL_THEMES.filter((theme) => theme.brand === "elma")).toHaveLength(4);
    for (const slug of ILLEGAL_SLUGS) {
      expect(LEGAL_THEMES.map(themeSlug)).not.toContain(slug);
    }
  });

  it("renders one slug-labelled cell per legal permutation", async () => {
    const html = await fetchText("/handbook/theme-matrix");
    expect([...html.matchAll(/data-theme-matrix-cell/g)]).toHaveLength(20);
    const slugHooks = [...html.matchAll(/data-theme-slug="([^"]*)"/g)].map((match) => match[1]);
    expect(slugHooks).toEqual(LEGAL_THEMES.map(themeSlug));
  });

  it("scopes each cell rather than stamping the document", async () => {
    const html = await fetchText("/handbook/theme-matrix");
    // Every cell carries its own three brand attributes.
    expect([...html.matchAll(/data-theme-brand="elma"/g)].length).toBeGreaterThanOrEqual(4);
    expect([...html.matchAll(/data-theme-variant="external"/g)]).toHaveLength(10);
    // The document root stays Elmera-internal, and dense.
    expect(/<html\b[^>]*data-theme-variant="internal"/.test(html)).toBe(true);
    expect(/<html\b[^>]*data-density="dense"/.test(html)).toBe(true);
  });

  it("never renders an illegal permutation, hatched or otherwise", async () => {
    const html = await fetchText("/handbook/theme-matrix");
    for (const slug of ILLEGAL_SLUGS) {
      expect(html, slug).not.toContain(slug);
    }
  });

  it("puts an overlay inside every cell, so the portal target is the cell's scope", async () => {
    expect([...(await matrixGrid()).matchAll(/>Overlay</g)]).toHaveLength(20);
  });

  it("adds no density axis — the grid is 20 cells, not 20 × 2", async () => {
    expect(await matrixGrid()).not.toContain("comfortable");
  });
});

describe("tokens page", () => {
  it("publishes a measured size and a ceiling for every budgeted entry", async () => {
    const html = await fetchText("/handbook/tokens");
    expect(BUNDLE_SIZES.length).toBeGreaterThan(0);
    expect(html).toContain(BUNDLE_SIZES_MEASURED_ON);
    for (const entry of BUNDLE_SIZES) {
      const label = entry.name === "." ? "@elmeragroup/fuse" : `@elmeragroup/fuse/${entry.name}`;
      expect(html, entry.name).toContain(label);
      expect(entry.measuredGzip).toBeGreaterThan(0);
      expect(entry.ceilingGzip).toBeGreaterThan(0);
    }
  });

  it("covers every published JS entry the library budgets", () => {
    const liveNames = parseBudgets(readFileSync(sizeBudgetsFile, "utf8"), sizeBudgetsFile).map(
      (budget) => budget.name
    );
    expect([...BUNDLE_SIZES.map((entry) => entry.name)].sort()).toEqual([...liveNames].sort());
  });

  it("lists the generated token reference with swatches", async () => {
    const html = await fetchText("/handbook/tokens");
    expect(COLOR_TOKENS).toContain("--primary");
    expect(html).toContain("data-token-swatch");
    expect(html).toContain("--primary");
  });
});

describe("localization page", () => {
  it("documents the mechanism, the locale union, precedence and a switcher", async () => {
    const html = await fetchText("/handbook/localization");
    for (const locale of ["nb-NO", "sv-SE", "en-US", "fi-FI"]) {
      expect(html, locale).toContain(locale);
    }
    expect(html).toContain('id="mechanism"');
    expect(html).toContain('id="supported-locales"');
    expect(html).toContain('id="override-precedence"');
    expect(html).toContain('id="language-switcher"');
    expect(html).toContain("LocaleProvider");
  });
});

describe("quick start page", () => {
  it("shows the app page scaffold once — landmarks, skip link and lang", async () => {
    const html = await fetchText("/quick-start");
    expect(html).toContain('id="page-scaffold"');
    expect(html).toContain("themeAttributes");
    expect(html).toContain("ColorSchemeScript");
    expect(html).toContain("lang=");
    expect(html).toContain("Hopp til innholdet");
  });

  it("offers both CSS modes and a snippet that uses a real Button variant", async () => {
    const html = await fetchText("/quick-start");
    // React escapes quotes and angle brackets in text children, so snippet code renders as entities.
    // The prose also names `@source`, so the Tailwind and Button checks match snippet-only strings.
    expect(html, "the Tailwind-source snippet must import the Fuse CSS entry").toContain(
      "@import &quot;@elmeragroup/fuse/css&quot;"
    );
    expect(html, "the Tailwind-source snippet must point @source at the package").toContain(
      "@source &quot;../node_modules/@elmeragroup/fuse&quot;"
    );
    expect(html, "standalone mode must be shown").toContain("@elmeragroup/fuse/styles.css");
    expect(html, "the quick-start Button snippet must be shown").toContain(
      "&lt;Button&gt;Lagre&lt;/Button&gt;"
    );
    expect(html, "the quick-start Button snippet must not use a variant Button lacks").not.toContain(
      "variant=&quot;primary&quot;"
    );
  });
});
