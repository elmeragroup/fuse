import { describe, expect, it } from "vitest";

import { docsBaseUrl } from "./docs-server";

async function fetchText(pathname: string): Promise<string> {
  const response = await fetch(new URL(pathname, docsBaseUrl()));
  expect(response.ok, `${pathname} responded ${String(response.status)}`).toBe(true);
  return await response.text();
}

describe("component page anatomy (docs-site.md §3.4)", () => {
  it("renders H1, lede and the two meta links", async () => {
    const html = await fetchText("/components/button");
    expect(html).toContain("<h1>Button</h1>");
    expect(html).toContain("Triggers an action.");
    expect(html).toContain('href="/components/button.md"');
    expect(html).toContain("View as Markdown");
    expect(html).toContain(
      'href="https://github.com/elmeragroup/ui/blob/main/packages/ui/src/components/button/button.tsx"'
    );
    expect(html).toContain("View source");
  });

  it("renders the MDX shell's own prose", async () => {
    const html = await fetchText("/components/button");
    expect(html).toContain("ComponentProse");
    expect(html).toContain("looks disabled but stays interactive");
  });

  it("renders one demo frame per scenario, with stage, meta row and extracted source", async () => {
    const html = await fetchText("/components/button");
    expect([...html.matchAll(/class="DemoFrame"/g)]).toHaveLength(5);
    expect(html).toContain("DemoStage");
    expect(html).toContain("DemoSlug");
    expect(html).toContain("DemoDensity");
    expect(html).toContain("DemoSource");
    // Extracted, highlighted source of the authored demo file.
    expect(html).toContain("sh__token--keyword");
    expect(html).toContain("packages/ui/src/components/button/demos/button-variant-matrix.tsx");
  });

  it("renders the generated API tables with an RSC column", async () => {
    const html = await fetchText("/components/button");
    expect(html).toContain('id="api-reference"');
    expect(html).toContain('id="api-button"');
    expect(html).toContain('<th scope="col">RSC</th>');
    expect(html).toContain("ApiTableRsc");
    expect(html).toContain("isVisuallyDisabled");
    expect(html).toContain("predictionZoneSize");
    expect(html).toContain("forwarded props from");
  });

  it("renders the generated tokens-consumed section with swatches", async () => {
    const html = await fetchText("/components/button");
    expect(html).toContain('id="tokens-consumed"');
    expect(html).toContain("TokenSwatch");
    expect(html).toContain("--primary");
    expect(html).toContain("--control-h-md");
  });

  it("renders a namespace compound as one table per part", async () => {
    const html = await fetchText("/components/dialog");
    expect(html).toContain('id="api-dialog-root"');
    expect(html).toContain('id="api-dialog-content"');
    expect(html).toContain('id="api-dialog-footer"');
    expect(html).toContain("showCloseButton");
  });

  it("lists the page's generated sections in the on-page TOC", async () => {
    const html = await fetchText("/components/scroll-area");
    expect(html).toContain('href="#api-reference"');
    expect(html).toContain('href="#tokens-consumed"');
    expect(html).toContain('href="#vertical"');
    expect(html).toContain('href="#composition-limits"');
    expect(html).toContain('id="composition-limits"');
  });

  it("serves the per-component markdown endpoint the page links to", async () => {
    const markdown = await fetchText("/components/button.md");
    expect(markdown.startsWith("# Button")).toBe(true);
    expect(markdown).toContain("- RSC: client");
    expect(markdown).toContain("### Button");
  });

  it("keeps the docs chrome light-only — brand colour stays inside demo stages", async () => {
    const html = await fetchText("/components/dialog");
    const stage = html.indexOf("DemoStage");
    expect(stage).toBeGreaterThan(-1);
    expect(html).toContain('data-theme-brand="fkas"');
  });
});
