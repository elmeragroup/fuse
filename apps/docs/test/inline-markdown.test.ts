import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InlineMarkdown } from "../src/components/inline-markdown";

/** The rendered markup without classes, which belong to styling, not to the markdown. */
function render(text: string): string {
  return renderToStaticMarkup(createElement(InlineMarkdown, { text })).replace(/ class="[^"]*"/g, "");
}

describe("InlineMarkdown", () => {
  it.each([
    {
      name: "an internal link",
      text: "Set it up as [Quick start](/quick-start#temporal) shows.",
      html: 'Set it up as <a href="/quick-start#temporal">Quick start</a> shows.',
    },
    {
      name: "an external link",
      text: "See [ValidityState](https://developer.mozilla.org/en-US/docs/Web/API/ValidityState).",
      html: 'See <a href="https://developer.mozilla.org/en-US/docs/Web/API/ValidityState" rel="noreferrer">ValidityState</a>.',
    },
    {
      name: "a code span holding brackets inside link text",
      text: "Pass [the `items[0]` option](/components/select) here.",
      html: 'Pass <a href="/components/select">the <code>items[0]</code> option</a> here.',
    },
    {
      name: "a link-shaped code span, which stays code",
      text: "Write `[Quick start](/quick-start#temporal)` in the description.",
      html: "Write <code>[Quick start](/quick-start#temporal)</code> in the description.",
    },
    {
      name: "brackets that form no link",
      text: "A point, [x, y], in prose.",
      html: "A point, [x, y], in prose.",
    },
    {
      name: "a scheme-relative link, which is not a site path",
      text: "See [Example](//example.com/docs).",
      html: "See [Example](//example.com/docs).",
    },
    {
      name: "a lone bracket before a link, which stays outside the link text",
      text: "Use [ literally, then see [Guide](/guide).",
      html: 'Use [ literally, then see <a href="/guide">Guide</a>.',
    },
    {
      name: "a backslash after the leading slash, which is not a site path",
      text: "See [Example](/\\example.com/docs).",
      html: "See [Example](/\\example.com/docs).",
    },
    {
      name: "a link to a target that is neither a path nor http(s)",
      text: "See [this](javascript:alert(1)).",
      html: "See [this](javascript:alert(1)).",
    },
  ])("renders $name", ({ text, html }) => {
    expect(render(text)).toBe(html);
  });
});
