/**
 * The HTML the built Fuse ToggleGroup renders for a cell. The unit under test is the Toggle group
 * renderer. The oracle is ToggleGroup's public contract and the docs Multiple demo: the root carries
 * `style="--gap:2"` at the default spacing and the group's variant and size, and holds the Bold,
 * Italic and Underline items, Bold pressed, each stamped with the group's variant, size and spacing.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { toggleGroup } from "./toggle-group-cell";

describe("the Toggle group renderer", () => {
  it("writes the default spacing as --gap on the root and passes the cell's variant and size to every item", () => {
    const elements = elementsOf(renderCellHtml(toggleGroup, { variant: "outline", size: "sm" }));
    const root = elements.find((element) => element.attributes.get("data-slot") === "toggle-group");
    const items = elements.filter((element) => element.attributes.get("data-slot") === "toggle-group-item");
    expect([
      root?.attributes.get("style"),
      items.map((item) => [
        item.text,
        item.attributes.get("data-variant"),
        item.attributes.get("data-size"),
        item.attributes.get("data-spacing"),
        item.attributes.get("aria-pressed"),
      ]),
    ]).toEqual([
      "--gap:2",
      [
        ["Bold", "outline", "sm", "2", "true"],
        ["Italic", "outline", "sm", "2", "false"],
        ["Underline", "outline", "sm", "2", "false"],
      ],
    ]);
  });

  it("leaves the default variant and size to the group", () => {
    const items = elementsOf(renderCellHtml(toggleGroup, { variant: "default", size: "default" })).filter(
      (element) => element.attributes.get("data-slot") === "toggle-group-item"
    );
    expect(
      items.map((item) => [item.attributes.get("data-variant"), item.attributes.get("data-size")])
    ).toEqual([
      ["default", "default"],
      ["default", "default"],
      ["default", "default"],
    ]);
  });
});
