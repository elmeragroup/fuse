import { createElement } from "react";

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { toggleVariants as publicToggleVariants } from "../../toggle";
import { toggleVariants } from "../toggle/toggle-variants";
import { ToggleGroup } from "./toggle-group";

const here = dirname(fileURLToPath(import.meta.url));

describe("toggle-group recipe borrow", () => {
  it("imports the public toggleVariants identity and has no local tv fork", () => {
    expect(toggleVariants).toBe(publicToggleVariants);
    expect(existsSync(join(here, "toggle-group-variants.ts"))).toBe(false);
  });
});

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
