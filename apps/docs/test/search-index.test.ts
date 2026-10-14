import { describe, expect, it } from "vitest";

import { resolveComponentPaths } from "../scripts/lib/components.ts";
import { COMPONENT_PAGES } from "../src/generated/component-pages";
import { SEARCH_ENTRIES } from "../src/generated/search-index";
import type { SearchEntry } from "../src/lib/docs-model";
import { HOME_PAGE, STATIC_PAGES } from "../src/lib/pages";
import { matchesEveryToken, queryTokens, rankEntries } from "../src/lib/search";
import { STUDIO_PAGES } from "../src/studio/registration";
import { docsBaseUrl } from "./docs-server";

describe("search index", () => {
  it("is generated from the page manifests, with nothing else in it", () => {
    expect(SEARCH_ENTRIES.map((entry) => entry.href)).toEqual([
      HOME_PAGE.href,
      ...STATIC_PAGES.map((page) => page.href),
      ...STUDIO_PAGES.map((page) => page.href),
      ...COMPONENT_PAGES.map((component) => `/components/${component.slug}`),
    ]);
  });

  it("carries a group, a description and match keywords on every entry", () => {
    for (const entry of SEARCH_ENTRIES) {
      expect(["Overview", "Handbook", "Studio", "Components"], entry.href).toContain(entry.group);
      expect(entry.title, entry.href).not.toBe("");
      expect(entry.description, entry.href).not.toBe("");
      expect(entry.keywords.length, entry.href).toBeGreaterThan(0);
    }
  });

  it("indexes each component under its import specifier and API part names", () => {
    for (const component of COMPONENT_PAGES) {
      const entry = SEARCH_ENTRIES.find((candidate) => candidate.title === component.title);
      expect(entry, component.slug).toBeDefined();
      expect(entry?.keywords).toContain(resolveComponentPaths(component.slug).entry);
      for (const name of component.partNames) {
        expect(entry?.keywords, name).toContain(name);
      }
    }
  });

  it.each(SEARCH_ENTRIES.map((entry) => entry.href))("resolves %s instead of 404ing", async (href) => {
    const response = await fetch(new URL(href, docsBaseUrl()));
    await response.arrayBuffer();
    expect(response.ok, `${href} responded ${String(response.status)}`).toBe(true);
  });
});

/** Every index page `query` matches, best first. */
function search(query: string): readonly SearchEntry[] {
  return rankEntries(SEARCH_ENTRIES, queryTokens(query), SEARCH_ENTRIES.length);
}

describe("search matching", () => {
  it.each([
    ["ranks a title prefix above a body mention", "token", "/handbook/tokens"],
    ["finds a component page by its title", "dialog", "/components/dialog"],
    [
      "finds a component page by its import specifier",
      "@elmeragroup/fuse/scroll-area",
      "/components/scroll-area",
    ],
    ["finds the theme studio by its title", "studio", "/studio"],
    ["finds the theme studio by what it is", "playground", "/studio"],
  ] as const)("%s: %s → %s", (_case, query, href) => {
    expect(search(query)[0]?.href).toBe(href);
  });

  it("narrows on every token rather than widening", () => {
    const both = search("theme matrix");
    expect(both.map((entry) => entry.href)).toContain("/handbook/theme-matrix");
    expect(both.length).toBeLessThan(search("theme").length);
  });

  it("returns nothing for a query no page matches", () => {
    expect(search("zzzz-no-such-page")).toEqual([]);
  });

  it.each([
    ["every word, in any order", "internal telinet", true],
    ["regardless of case", "TELINET", true],
    ["a blank query", "  ", true],
    ["not when one word is missing", "telinet company", false],
  ] as const)("matches a row's text on %s: %s → %s", (_case, query, expected) => {
    expect(matchesEveryToken("Telinet · Private · Internal", query)).toBe(expected);
  });
});
