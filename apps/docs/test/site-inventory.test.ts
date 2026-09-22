import { describe, expect, it } from "vitest";

import { COMPONENT_PAGES } from "../src/generated/component-pages";
import { COMPONENT_NAV, NAV_GROUPS } from "../src/lib/nav";
import { HOME_PAGE, STATIC_PAGES } from "../src/lib/pages";
import { COMPONENT_INVENTORY } from "./component-inventory";
import { fetchOk, fetchText } from "./docs-server";

const NAV_HREFS = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));

describe("SideNav inventory", () => {
  it("carries exactly the three groups, in order", () => {
    expect(NAV_GROUPS.map((group) => group.label)).toEqual(["Overview", "Handbook", "Components"]);
  });

  it("lists the Overview and Handbook pages in the reviewed inventory", () => {
    expect(NAV_GROUPS[0]?.items.map((item) => item.label)).toEqual([
      "Quick start",
      "Accessibility",
      "Releases",
      "About",
    ]);
    expect(NAV_GROUPS[1]?.items.map((item) => item.label)).toEqual([
      "Theming",
      "Theme matrix",
      "Tokens",
      "Brands & segments",
      "Icons",
      "Localization",
      "llms.txt",
    ]);
  });

  it("generates the Components group from the reviewed titles, flat and alphabetical", () => {
    expect(NAV_GROUPS[2]?.items).toBe(COMPONENT_NAV);
    // Unit under test: the nav labels and their order. Oracle: the reviewed inventory
    // titles in the order the fixture lists them, which is alphabetical.
    expect(COMPONENT_NAV.map((item) => item.label)).toEqual(
      [...COMPONENT_INVENTORY.values()].map((entry) => entry.title)
    );
  });

  it.each(NAV_HREFS)("resolves %s instead of 404ing", async (href) => {
    await fetchOk(href);
  });

  it("marks the current page with aria-current, so it renders as the soft pill", async () => {
    const html = await fetchText("/handbook/tokens");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('data-active="true"');
  });
});

describe("llms.txt", () => {
  it("is served from the site root", async () => {
    const response = await fetchOk("/llms.txt");
    expect(response.headers.get("content-type")).toContain("text/plain");
  });

  it("indexes every nav destination and the home page, each with a description", async () => {
    const text = await fetchText("/llms.txt");
    expect(text).toContain(`](${HOME_PAGE.href}): ${HOME_PAGE.description}`);
    for (const page of STATIC_PAGES) {
      expect(text, page.href).toContain(`[${page.label}](${page.href}): ${page.description}`);
    }
    for (const component of COMPONENT_PAGES) {
      expect(text, component.slug).toContain(`[${component.title}](/components/${component.slug}):`);
    }
  });

  it("links each component's markdown endpoint from its index row", async () => {
    const text = await fetchText("/llms.txt");
    for (const component of COMPONENT_PAGES) {
      expect(text).toContain(`Markdown: ${component.markdownUrl}`);
    }
  });
});

describe("markdown endpoints", () => {
  it.each(COMPONENT_PAGES.map((component) => component.markdownUrl))(
    "serves the View-as-Markdown target %s",
    async (markdownUrl) => {
      const markdown = await fetchText(markdownUrl);
      expect(markdown.startsWith("# ")).toBe(true);
      expect(markdown).toContain("## API reference");
    }
  );

  it("links a resolvable endpoint from every backfilled component page", async () => {
    for (const component of COMPONENT_PAGES) {
      const html = await fetchText(`/components/${component.slug}`);
      expect(html, component.slug).toContain(`href="${component.markdownUrl}"`);
    }
  });
});
