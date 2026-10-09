import { describe, expect, it } from "vitest";

import { COMPONENT_PAGES } from "../src/generated/component-pages";
import { COMPONENT_NAV, NAV_GROUPS } from "../src/lib/nav";
import { HOME_PAGE, STATIC_PAGES, STUDIO_PAGES } from "../src/lib/pages";
import { COMPONENT_INVENTORY } from "./component-inventory";
import { fetchOk, fetchText } from "./docs-server";

describe("SideNav inventory", () => {
  it("carries exactly the three groups, in order, with the reviewed Overview and Handbook pages", () => {
    expect(NAV_GROUPS.map((group) => group.label)).toEqual(["Overview", "Handbook", "Components"]);
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

  it("marks the current page with aria-current, so it renders as the soft pill", async () => {
    const html = await fetchText("/handbook/tokens");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('data-active="true"');
  });
});

describe("llms.txt", () => {
  it("is served as plain text from the site root, indexing every nav destination and the home page, each with a description and component markdown links", async () => {
    const { response, text } = await fetchOk("/llms.txt");
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(text).toContain(`](${HOME_PAGE.href}): ${HOME_PAGE.description}`);
    for (const page of STATIC_PAGES) {
      expect(text, page.href).toContain(`[${page.label}](${page.href}): ${page.description}`);
    }
    expect(text).toContain("## Studio");
    for (const page of STUDIO_PAGES) {
      expect(text, page.href).toContain(`[${page.title}](${page.href}): ${page.description}`);
    }
    for (const component of COMPONENT_PAGES) {
      expect(text, component.slug).toContain(`[${component.title}](/components/${component.slug}):`);
      // Each component's index row links its markdown endpoint.
      expect(text).toContain(`Markdown: ${component.markdownUrl}`);
    }
  });
});

describe("markdown endpoints", () => {
  // Every endpoint takes the same Next static-file path, and generated-output checks each
  // file's content on disk, so one endpoint proves the serving.
  it("serves the View-as-Markdown target /components/button.md", async () => {
    const markdown = await fetchText("/components/button.md");
    expect(markdown.startsWith("# ")).toBe(true);
    expect(markdown).toContain("## API reference");
  });
});
