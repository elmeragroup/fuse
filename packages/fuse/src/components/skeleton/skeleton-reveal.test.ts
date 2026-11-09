/**
 * Unit under test: SkeletonReveal rendering in Node, as a server does. Oracle: data that is never
 * strictly equal to itself still renders once, as content. The markup contract is read off parsed
 * HTML in `skeleton-reveal-server.browser.test.tsx`.
 */
import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SkeletonReveal } from "./skeleton-reveal";

describe("SkeletonReveal server render", () => {
  it("renders NaN data as content, without re-rendering forever", () => {
    const markup = renderToStaticMarkup(
      createElement(SkeletonReveal<number>, {
        data: Number.NaN,
        label: "Henter",
        children: (value: number) => createElement("p", null, String(value)),
      })
    );
    expect(markup).toContain("<p>NaN</p>");
  });
});
