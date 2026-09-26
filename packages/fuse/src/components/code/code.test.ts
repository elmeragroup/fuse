import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { cn } from "../../styles/cn";
import { Code } from "./code";

const BASE_CLASSES = "text-xs leading-relaxed max-h-160 overflow-auto font-mono";
const SNIPPET = "const answer = 42;";
const CONCAT_SNIPPET = 'const html = "<div>" + a + "</div>";';
const XSS_PAYLOAD = '<img onerror="alert(1)" src="x">';

describe("code className merge", () => {
  it("lets a consumer className coexist with the base classes", () => {
    const merged = cn(BASE_CLASSES, "rounded-md bg-muted").split(/\s+/);
    expect(merged).toEqual(
      expect.arrayContaining(["max-h-160", "overflow-auto", "font-mono", "text-xs", "leading-relaxed"])
    );
    expect(merged).toContain("rounded-md");
    expect(merged).toContain("bg-muted");
  });
});

describe("Code highlight output", () => {
  it("renders highlighted token spans whose text equals the input source", () => {
    const html = renderToStaticMarkup(createElement(Code, { code: SNIPPET }));
    expect(html).toContain('data-slot="code"');
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("sh__token");
    expect(html).toContain("<pre");
    expect(html).toContain("<code");
    expect(html.replaceAll(/<[^>]+>/g, "")).toBe(SNIPPET);
  });

  it("escapes HTML in the code string instead of executing it", () => {
    const html = renderToStaticMarkup(createElement(Code, { code: XSS_PAYLOAD }));
    expect(html).not.toMatch(/<img\b/);
    expect(html).toContain("&lt;");
  });

  it("pins v2's property classification of a bare name beside string concatenation", () => {
    const html = renderToStaticMarkup(createElement(Code, { code: CONCAT_SNIPPET }));
    // sugar-high v2 reclassifies `a` here; v1 rendered it as `sh__token--identifier`.
    expect(html).toMatch(/<span class="sh__token--property"[^>]*>a<\/span>/);
  });

  it("keeps the identifier classification for an ordinary declaration", () => {
    const html = renderToStaticMarkup(createElement(Code, { code: SNIPPET }));
    expect(html).toMatch(/<span class="sh__token--identifier"[^>]*>answer<\/span>/);
  });

  it("merges className onto the pre and forwards id and aria-label", () => {
    const html = renderToStaticMarkup(
      createElement(Code, {
        code: SNIPPET,
        className: "rounded-md",
        id: "answer",
        "aria-label": "Answer snippet",
      })
    );
    expect(html).toContain('id="answer"');
    expect(html).toContain('aria-label="Answer snippet"');
    expect(html).toContain("rounded-md");
    expect(html).toContain("max-h-160");
  });
});
