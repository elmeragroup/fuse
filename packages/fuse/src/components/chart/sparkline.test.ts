// Unit under test: Sparkline's server markup. Oracles: the input's own length, and the props.
// Every reading draws its mark and takes one hover region, however many readings there are, so a
// server render that nests per reading, and runs out of stack or past an HTML parser's depth limit,
// fails here instead of dropping data. Without hover, the marks and the name stay and no reading
// takes a region and no glide marks are written.
import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Sparkline } from "./sparkline";

const COUNT = 2000;

/** The opening tags of one element name in the markup. */
function tags(markup: string, name: string): string[] {
  return markup.match(new RegExp(`<${name}\\b[^>]*>`, "gu")) ?? [];
}

describe("Sparkline on the server", () => {
  it("writes every bar and every hover region of a 2000-value series", () => {
    const data = Array.from({ length: COUNT }, (_, index) => (index % 7) - 3);
    const markup = renderToStaticMarkup(
      createElement(Sparkline, { "aria-label": "Load", data, locale: "en-US", variant: "bar" })
    );
    const bars = tags(markup, "rect").filter(
      (tag) => tag.includes('data-slot="sparkline-bar"') && !tag.includes("data-part")
    );
    const regions = tags(markup, "g").filter((tag) => tag.includes('data-slot="sparkline-value"'));
    expect([bars.length, regions.length]).toEqual([COUNT, COUNT]);
  });

  it("writes the marks and the name and no hover region or glide marks with data-hover none", () => {
    const render = (variant: "line" | "bar") =>
      renderToStaticMarkup(
        createElement(Sparkline, {
          "aria-label": "Load",
          data: [2, 6, 4],
          locale: "en-US",
          variant,
          "data-hover": "none",
        })
      );
    const line = render("line");
    const bar = render("bar");
    expect(tags(line, "svg")[0]).toContain('aria-label="Load. Lowest 2, highest 6."');
    expect(tags(line, "path").filter((tag) => tag.includes('data-slot="sparkline-path"'))).toHaveLength(1);
    expect(tags(bar, "rect").filter((tag) => tag.includes('data-slot="sparkline-bar"'))).toHaveLength(3);
    for (const markup of [line, bar]) {
      expect(markup).not.toContain('data-slot="sparkline-value"');
      expect(markup).not.toContain('data-slot="sparkline-glide"');
    }
  });
});
