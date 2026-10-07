import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LEGAL_THEMES, themeSlug } from "@elmeragroup/fuse/theme";

import { fuseSrc, sizeBudgetsFile } from "../scripts/lib/paths.ts";
import { parseBudgets } from "../scripts/lib/sizes.ts";
import { BUNDLE_SIZES, BUNDLE_SIZES_MEASURED_ON } from "../src/generated/bundle-sizes";
import { fetchText } from "./docs-server";

/** The four permutations the pin table forbids; none may reach the DOM. */
const ILLEGAL_SLUGS = [
  "internal-fkab-private",
  "external-fkab-private",
  "internal-fkse-company",
  "external-fkse-company",
] as const;

/** The grid itself, without the prose around it. */
function matrixGrid(html: string): string {
  const start = html.indexOf("data-theme-matrix");
  const end = html.indexOf('id="overlays"');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
}

describe("theme matrix", () => {
  it("renders one slug-labelled cell per legal permutation, never an illegal one and no density axis", async () => {
    const html = await fetchText("/handbook/theme-matrix");
    expect([...html.matchAll(/data-theme-matrix-cell/g)]).toHaveLength(24);
    const slugHooks = [...html.matchAll(/data-theme-slug="([^"]*)"/g)].map((match) => match[1]);
    expect(slugHooks).toEqual(LEGAL_THEMES.map(themeSlug));
    // Hatched or otherwise, no illegal permutation reaches the page.
    for (const slug of ILLEGAL_SLUGS) {
      expect(html, slug).not.toContain(slug);
    }
    // No density axis: the grid is 24 cells, not 24 × 2.
    expect(matrixGrid(html)).not.toContain("comfortable");
  });

  it("scopes each cell rather than stamping the document", async () => {
    const html = await fetchText("/handbook/theme-matrix");
    // Every cell carries its own three brand attributes.
    expect([...html.matchAll(/data-theme-brand="elma"/g)].length).toBeGreaterThanOrEqual(4);
    expect([...html.matchAll(/data-theme-variant="external"/g)]).toHaveLength(12);
    // The document root stays Elmera-internal, and dense.
    expect(/<html\b[^>]*data-theme-variant="internal"/.test(html)).toBe(true);
    expect(/<html\b[^>]*data-density="dense"/.test(html)).toBe(true);
  });

  it("puts an overlay inside every cell, so the portal target is the cell's scope", async () => {
    const html = await fetchText("/handbook/theme-matrix");
    expect([...matrixGrid(html).matchAll(/>Overlay</g)]).toHaveLength(24);
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

/**
 * The curated roster as `packages/fuse/src/icons/roster.ts` declares it. Read as text: the roster
 * is private, and apps may not import `packages/fuse/src` (the workspace boundary test).
 */
function curatedRoster(): string[] {
  const source = readFileSync(path.join(fuseSrc, "icons/roster.ts"), "utf8");
  const literal = /PHOSPHOR_ICON_NAMES = \[([^\]]*)\] as const/u.exec(source)?.[1];
  if (literal === undefined) {
    throw new Error("packages/fuse/src/icons/roster.ts no longer declares PHOSPHOR_ICON_NAMES as a literal");
  }
  return [...literal.matchAll(/"(\w+)"/gu)].map((match) => match[1] ?? "");
}

/** The icon titles inside the demo section labelled with one size class. */
function titlesInSizeSection(html: string, size: string): string[] {
  const start = html.indexOf(`<section aria-label="${size}">`);
  expect(start, size).toBeGreaterThan(-1);
  const section = html.slice(start, html.indexOf("</section>", start));
  return [...section.matchAll(/<title>([^<]*)<\/title>/gu)].map((match) => match[1] ?? "");
}

describe("icons page", () => {
  it("renders the whole curated roster, and nothing else, once per size", async () => {
    const html = await fetchText("/handbook/icons");
    const roster = curatedRoster();
    // The reader must see the real roster, so the comparison is not vacuous.
    expect(roster.length).toBeGreaterThan(100);
    expect(roster).toContain("Checks");
    for (const size of ["size-3", "size-4", "size-5"]) {
      const titles = titlesInSizeSection(html, size);
      expect(titles, `${size} renders each icon once`).toHaveLength(new Set(titles).size);
      expect(new Set(titles), size).toEqual(new Set(roster));
    }
  });

  it("draws the roster at the bold default", async () => {
    const html = await fetchText("/handbook/icons");
    // Oracle: the start of Phosphor's bold and regular Check paths (`dist/defs/Check.es.js`).
    expect(html).toContain('d="M232.49,80.49l-128,128');
    expect(html).not.toContain('d="M229.66,77.66l-128,128');
  });
});
