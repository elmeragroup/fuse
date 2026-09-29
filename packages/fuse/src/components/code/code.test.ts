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

  // sugar-high v2 reclassifies `a` beside string concatenation; v1 rendered it as `sh__token--identifier`.
  it.each([
    [
      "a bare name beside string concatenation as a property",
      CONCAT_SNIPPET,
      /<span class="sh__token--property"[^>]*>a<\/span>/,
    ],
    [
      "an ordinary declaration's name as an identifier",
      SNIPPET,
      /<span class="sh__token--identifier"[^>]*>answer<\/span>/,
    ],
  ] as const)("pins v2's classification of %s", (_case, code, token) => {
    const html = renderToStaticMarkup(createElement(Code, { code }));
    expect(html).toMatch(token);
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
