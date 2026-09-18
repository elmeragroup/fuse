import { describe, expect, it } from "vitest";

import { fetchText } from "./docs-server";

describe("component page anatomy (docs-site.md §3.4)", () => {
  it("renders H1, lede and the two meta links", async () => {
    const html = await fetchText("/components/button");
    expect(html).toMatch(/<h1[^>]*>Button<\/h1>/);
    expect(html).toContain("Triggers an action.");
    expect(html).toContain('href="/components/button.md"');
    expect(html).toContain("View as Markdown");
    expect(html).toContain(
      'href="https://github.com/elmeragroup/ui/blob/main/packages/ui/src/components/button/button.tsx"'
    );
    expect(html).toContain("View source");
  });

  it("renders the MDX shell's own prose", async () => {
    const html = await fetchText("/components/input");
    expect(html).toContain("A bare input has no accessible name");
    expect(html).toContain("Field.Root</code> with a");
  });

  it("renders one demo frame per scenario, with stage, meta row and extracted source", async () => {
    const html = await fetchText("/components/button");
    expect([...html.matchAll(/<section[^>]*data-demo-frame/g)]).toHaveLength(5);
    expect(html).toContain("data-demo-stage");
    expect(html).toContain("data-demo-slug");
    expect(html).toContain("data-demo-density");
    expect(html).toContain("data-demo-source");
    // Extracted, highlighted source of the authored demo file.
    expect(html).toContain("sh__token--keyword");
    expect(html).toContain("apps/docs/src/app/(docs)/components/button/demos/button-variant-matrix.tsx");
  });

  it("renders the API reference as expandable rows with a per-part RSC indicator", async () => {
    const html = await fetchText("/components/button");
    expect(html).toContain('id="api-reference"');
    expect(html).toContain('id="api-button"');
    // details/summary rows, deep-linkable per prop (docs-site.md §8).
    expect(html).toMatch(/<details[\s\S]*?<summary[^>]*id="api-button-isVisuallyDisabled"/);
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
    expect(html).toContain("Base UI primitive props");
    expect(html).toContain('id="api-button-focusableWhenDisabled"');
    expect(html).toContain("Whether the button should be focusable when disabled.");
    expect(html).not.toContain('id="api-button-onClick"');
    expect(html).toContain(
      'aria-label="Button Base UI primitive props: name, type, default. Each row expands."'
    );
    expect(html).not.toContain("Base UI primitive props props:");
  });

  it("collapses long types in closed rows, keeps the full signature in the panel", async () => {
    const html = await fetchText("/components/button");
    // `onIntent` prints as `(() => void) | undefined`; the closed row says `function`.
    expect(html).toMatch(/<code[^>]*>function<\/code>/);
    expect(html).toContain('aria-label="Prop: onIntent, type: function"');
    const api = html.slice(html.indexOf('id="api-reference"'));
    // The expanded panel carries the real signature, highlighted by sugar-high.
    expect(api).toContain("<pre");
    expect(api).toContain("sh__token");
    // A prop with no default renders an em-dash, never an empty cell.
    expect(api).toMatch(/<dt[^>]*>Default<\/dt>[\s\S]*?<span[^>]*>—<\/span>/);
  });

  it("renders the generated tokens-consumed section with swatches", async () => {
    const html = await fetchText("/components/button");
    expect(html).toContain('id="tokens-consumed"');
    expect(html).toContain("data-token-swatch");
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
    // RSC status per part, as a heading badge — never a per-prop column (docs-site.md §8).
    expect(markdown).toContain("### Button · RSC: client");
    expect(markdown).toContain("| Prop | Type | Default | Required | Description |");
    expect(markdown).not.toContain("| RSC |");
  });

  it("keeps the document on internal Elmera while demo stages select other brands", async () => {
    const html = await fetchText("/components/dialog");
    const stage = html.indexOf("data-demo-stage");
    expect(stage).toBeGreaterThan(-1);
    expect(html).toContain('data-theme-brand="fkas"');
    expect(html).toMatch(
      /<html[^>]+data-theme-variant="internal"[^>]+data-theme-brand="elma"[^>]+data-theme-segment="private"/
    );
  });
});
