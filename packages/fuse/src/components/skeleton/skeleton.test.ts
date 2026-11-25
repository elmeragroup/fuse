import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Skeleton } from "./skeleton";

describe("Skeleton markup", () => {
  it("renders an empty, hidden placeholder div with its data-slot and no role or tab stop", () => {
    const markup = renderToStaticMarkup(createElement(Skeleton, null));
    expect(markup).toMatch(/^<div [^>]*><\/div>$/u);
    expect(markup).toContain(' data-slot="skeleton"');
    expect(markup).toContain(' aria-hidden="true"');
    expect(markup).not.toMatch(/ (?:role|tabindex)=/u);
  });
});
