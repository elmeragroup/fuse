import { describe, expect, it } from "vitest";

import { DOCS_COMPONENTS } from "../src/generated/registry";
import { COMPONENT_NAV, NAV_GROUPS } from "../src/lib/nav";
import { HOME_PAGE, STATIC_PAGES } from "../src/lib/pages";
import { docsBaseUrl } from "./docs-server";

async function fetchOk(pathname: string): Promise<Response> {
  const response = await fetch(new URL(pathname, docsBaseUrl()));
  await response.arrayBuffer();
  expect(response.ok, `${pathname} responded ${String(response.status)}`).toBe(true);
  return response;
}

async function fetchText(pathname: string): Promise<string> {
  const response = await fetch(new URL(pathname, docsBaseUrl()));
  expect(response.ok, `${pathname} responded ${String(response.status)}`).toBe(true);
  return await response.text();
}

const NAV_HREFS = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));

describe("SideNav inventory (docs-site.md §3.3)", () => {
  it("carries exactly the three groups, in order", () => {
    expect(NAV_GROUPS.map((group) => group.label)).toEqual(["Overview", "Handbook", "Components"]);
  });

  it("lists the Overview and Handbook pages the spec names", () => {
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

  it("generates the Components group from the registry, flat and alphabetical", () => {
    expect(NAV_GROUPS[2]?.items).toBe(COMPONENT_NAV);
    expect(COMPONENT_NAV.map((item) => item.label)).toEqual(
      [...DOCS_COMPONENTS.map((component) => component.title)].sort((left, right) =>
        left.localeCompare(right)
      )
    );
    expect(COMPONENT_NAV.length).toBe(DOCS_COMPONENTS.length);
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

describe("llms.txt (docs-site.md §9)", () => {
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
    for (const component of DOCS_COMPONENTS) {
      expect(text, component.slug).toContain(`[${component.title}](/components/${component.slug}):`);
    }
  });

  it("links each component's markdown endpoint from its index row", async () => {
    const text = await fetchText("/llms.txt");
    for (const component of DOCS_COMPONENTS) {
      expect(text).toContain(`Markdown: ${component.markdownUrl}`);
    }
  });
});

describe("markdown endpoints (docs-site.md §9)", () => {
  it.each(DOCS_COMPONENTS.map((component) => component.markdownUrl))(
    "serves the View-as-Markdown target %s",
    async (markdownUrl) => {
      const markdown = await fetchText(markdownUrl);
      expect(markdown.startsWith("# ")).toBe(true);
      expect(markdown).toContain("## API reference");
    }
  );

  it("links a resolvable endpoint from every backfilled component page", async () => {
    for (const component of DOCS_COMPONENTS) {
      const html = await fetchText(`/components/${component.slug}`);
      expect(html, component.slug).toContain(`href="${component.markdownUrl}"`);
    }
  });
});
