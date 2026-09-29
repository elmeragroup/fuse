import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Code } from "./code";

const SNIPPET = "const answer = 42;";
const CONCAT_SNIPPET = 'const html = "<div>" + a + "</div>";';

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
