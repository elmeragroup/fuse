import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ToggleGroup } from "./toggle-group";

describe("toggle-group spacing=0 cap rounding", () => {
  it("puts directional cap-rounding classes on first and last items", () => {
    const html = renderToStaticMarkup(
      createElement(
        ToggleGroup.Root,
        { "aria-label": "Segmented", spacing: 0, variant: "outline" },
        createElement(ToggleGroup.Item, { value: "one" }, "One"),
        createElement(ToggleGroup.Item, { value: "two" }, "Two")
      )
    );
    const [first, last] = [...html.matchAll(/<button\b[^>]*>/g)].map((match) => match[0]);
    if (first === undefined || last === undefined) {
      throw new Error("expected two toggle-group items");
    }
    expect(first).toContain("first:rounded-l-md");
    expect(last).toContain("last:rounded-r-md");
  });
});
