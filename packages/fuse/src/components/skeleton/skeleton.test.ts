import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Skeleton } from "./skeleton";

describe("Skeleton markup", () => {
  it("renders a hidden placeholder div with no role or tab stop, painting the pulse and muted surface", () => {
    expect(renderToStaticMarkup(createElement(Skeleton, null))).toBe(
      '<div data-slot="skeleton" aria-hidden="true" class="animate-pulse rounded-md bg-muted"></div>'
    );
  });
});
