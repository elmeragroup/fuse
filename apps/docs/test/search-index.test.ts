import { describe, expect, it } from "vitest";

import { COMPONENT_PAGES } from "../src/generated/component-pages";
import { SEARCH_ENTRIES } from "../src/generated/search-index";
import { NAV_GROUPS } from "../src/lib/nav";
import { HOME_PAGE, STATIC_PAGES } from "../src/lib/pages";
import { matchSearchEntries, SEARCH_RESULT_LIMIT } from "../src/lib/search";
import { docsBaseUrl } from "./docs-server";

const NAV_HREFS = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));

describe("search index (docs-site.md §3.2)", () => {
  it("is generated from the two page manifests, with nothing else in it", () => {
    expect(SEARCH_ENTRIES.map((entry) => entry.href)).toEqual([
      HOME_PAGE.href,
      ...STATIC_PAGES.map((page) => page.href),
      ...COMPONENT_PAGES.map((component) => `/components/${component.slug}`),
    ]);
  });

  it("covers every SideNav destination", () => {
    const indexed = new Set(SEARCH_ENTRIES.map((entry) => entry.href));
    for (const href of NAV_HREFS) {
      expect(indexed.has(href), href).toBe(true);
    }
  });

  it("carries a group, a description and match keywords on every entry", () => {
    for (const entry of SEARCH_ENTRIES) {
      expect(["Overview", "Handbook", "Components"], entry.href).toContain(entry.group);
      expect(entry.title, entry.href).not.toBe("");
      expect(entry.description, entry.href).not.toBe("");
      expect(entry.keywords.length, entry.href).toBeGreaterThan(0);
    }
  });

  it("indexes each component under its import specifier and API part names", () => {
    for (const component of COMPONENT_PAGES) {
      const entry = SEARCH_ENTRIES.find((candidate) => candidate.title === component.title);
      expect(entry, component.slug).toBeDefined();
      expect(entry?.keywords).toContain(component.entry);
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

describe("search matching", () => {
  it("lists the site in nav order for an empty query, capped at the result limit", () => {
    const results = matchSearchEntries("");
    expect(results.length).toBe(Math.min(SEARCH_ENTRIES.length, SEARCH_RESULT_LIMIT));
    expect(results[0]?.href).toBe(HOME_PAGE.href);
  });

  it("ranks a title prefix above a body mention", () => {
    const results = matchSearchEntries("token");
    expect(results[0]?.href).toBe("/handbook/tokens");
  });

  it("finds a component page by its title", () => {
    expect(matchSearchEntries("dialog")[0]?.href).toBe("/components/dialog");
  });

  it("finds a component page by its import specifier", () => {
    expect(matchSearchEntries("@elmeragroup/fuse/scroll-area")[0]?.href).toBe("/components/scroll-area");
  });

  it("narrows on every token rather than widening", () => {
    const both = matchSearchEntries("theme matrix");
    expect(both.map((entry) => entry.href)).toContain("/handbook/theme-matrix");
    expect(both.length).toBeLessThan(matchSearchEntries("theme").length);
  });

  it("returns nothing for a query no page matches", () => {
    expect(matchSearchEntries("zzzz-no-such-page")).toEqual([]);
  });
});
