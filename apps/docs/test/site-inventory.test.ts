import { describe, expect, it } from "vitest";

import { COMPONENT_PAGES } from "../src/generated/component-pages";
import { COMPONENT_NAV, NAV_GROUPS } from "../src/lib/nav";
import { HOME_PAGE, STATIC_PAGES } from "../src/lib/pages";
import { STUDIO_PAGES } from "../src/studio/registration";
import { COMPONENT_INVENTORY } from "./component-inventory";
import { fetchOk, fetchText } from "./docs-server";

/** The chart entry's pages, reviewed by hand: the Charts group, in its alphabetical order. */
const CHARTS = [
  "Area Chart",
  "Bar Chart",
  "Chart",
  "Line Chart",
  "Pie Chart",
  "Radar Chart",
  "Radial Chart",
  "Scatter Chart",
  "Sparkline",
];

describe("SideNav inventory", () => {
  it("carries exactly the five groups, in order, with the reviewed Overview and Handbook pages", () => {
    expect(NAV_GROUPS.map((group) => group.label)).toEqual([
      "Overview",
      "Handbook",
      "Components",
      "Charts",
      "Blocks",
    ]);
    expect(NAV_GROUPS[0]?.items.map((item) => item.label)).toEqual([
      "Quick start",
      "Accessibility",
      "Releases",
      "About",
    ]);
    expect(NAV_GROUPS[1]?.items.map((item) => item.label)).toEqual([
      "Theming",
      "Density",
      "Theme matrix",
      "Tokens",
      "Brands & segments",
      "Fonts",
      "Icons",
      "Localization",
      "llms.txt",
    ]);
  });

  it("generates the Components group from the reviewed titles, flat and alphabetical", () => {
    // Unit under test: the nav labels and their order. Oracle: the reviewed inventory
    // titles in the order the fixture lists them, which is alphabetical.
    expect(COMPONENT_NAV.map((item) => item.label)).toEqual(
      [...COMPONENT_INVENTORY.values()].map((entry) => entry.title)
    );
    const components = NAV_GROUPS[2]?.items.map((item) => item.label);
    expect(components).toEqual(
      COMPONENT_NAV.map((item) => item.label).filter((label) => !CHARTS.includes(label))
    );
  });

  it("lists the chart entry's pages under Charts, alphabetical", () => {
    expect(NAV_GROUPS[3]?.items.map((item) => item.label)).toEqual(CHARTS);
  });

  it("lists the app shell as the one block, after Charts", () => {
    expect(NAV_GROUPS[4]?.items).toEqual([{ href: "/blocks/app-shell", label: "App shell" }]);
  });

  it("serves the block page, with the SideNav marking it as the current page", async () => {
    const html = await fetchText("/blocks/app-shell");
    const links = html.match(/<a [^>]*href="\/blocks\/app-shell"[^>]*>/gu) ?? [];
    expect(links.filter((link) => link.includes('aria-current="page"'))).toHaveLength(1);
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
    expect(text).toContain("## Blocks");
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
