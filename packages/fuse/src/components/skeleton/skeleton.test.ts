import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Skeleton } from "./skeleton";

describe("Skeleton classes", () => {
  it("paints the pulse and muted surface on a hidden placeholder div", () => {
    const html = renderToStaticMarkup(createElement(Skeleton, null));
    expect(html).toContain("animate-pulse");
    expect(html).toContain("rounded-md");
    expect(html).toContain("bg-muted");
    expect(html).toContain('data-slot="skeleton"');
    expect(html).toContain('aria-hidden="true"');
  });
});
