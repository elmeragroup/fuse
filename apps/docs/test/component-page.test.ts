import { describe, expect, it } from "vitest";

import { fetchText } from "./docs-server";

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
    expect(html).toContain("apps/docs/src/app/(docs)/components/button/demos/button-variant-matrix.tsx");
  });

  it("renders the API reference as expandable rows with a per-part RSC indicator", async () => {
    const html = await fetchText("/components/button");
    expect(html).toContain('id="api-reference"');
    expect(html).toContain('id="api-button"');
    // details/summary rows, deep-linkable per prop (docs-site.md §8).
    expect(html).toContain('class="ApiRow"');
    expect(html).toContain('id="api-button-isVisuallyDisabled"');
    expect(html).toContain('href="#api-button-isVisuallyDisabled"');
    expect(html).toContain("predictionZoneSize");
    // Prop · Type · Default header, RSC as a per-part indicator rather than a column.
    expect(html).toContain(">Prop<");
    expect(html).toContain(">Type<");
    expect(html).toContain(">Default<");
    expect(html).toContain('data-rsc="client"');
    // The indicator's own text — HTML-escaped, since the label is a quoted directive.
    expect(html).toContain("&quot;use client&quot;");
    expect(html).toContain("forwarded props from");
  });

  it("collapses long types in closed rows, keeps the full signature in the panel", async () => {
    const html = await fetchText("/components/button");
    // `onIntent` prints as `(() => void) | undefined`; the closed row says `function`.
    expect(html).toContain("<code>function</code>");
    expect(html).toContain('aria-label="Prop: onIntent, type: function"');
    // The expanded panel carries the real signature, highlighted by sugar-high.
    expect(html).toContain("ApiSignature");
    expect(html).toContain("sh__token");
    // A prop with no default renders an em-dash, never an empty cell.
    expect(html).toContain('class="ApiNoDefault">—<');
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
