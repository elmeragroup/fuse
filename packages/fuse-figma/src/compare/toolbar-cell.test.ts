/**
 * The HTML the built Fuse Toolbar renders for a cell. The unit under test is the Toolbar renderer.
 * The oracle is Toolbar's public contract, Base UI's documented toolbar attributes and the docs
 * Basic demo: the bar, `role="toolbar"`, carries its orientation and holds the File group's two
 * buttons, the separator in the opposite orientation and the Delete button, which Base UI marks
 * `aria-disabled="true"` and `data-disabled`.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { toolbar } from "./toolbar-cell";

describe("the Toolbar renderer", () => {
  it("renders the Basic demo's bar in each orientation, its separator across it", () => {
    expect(
      ["horizontal", "vertical"].map((orientation) => {
        const elements = elementsOf(renderCellHtml(toolbar, { orientation }));
        const slot = (name: string) =>
          elements.filter((element) => element.attributes.get("data-slot") === name);
        return [
          slot("toolbar")[0]?.attributes.get("data-orientation"),
          slot("toolbar-button").map((button) => button.text),
          slot("toolbar-separator")[0]?.attributes.get("data-orientation"),
        ];
      })
    ).toEqual([
      ["horizontal", ["Download", "Duplicate", "Delete"], "vertical"],
      ["vertical", ["Download", "Duplicate", "Delete"], "horizontal"],
    ]);
  });

  it("marks only the Delete button disabled, as Base UI marks a toolbar button", () => {
    const buttons = elementsOf(renderCellHtml(toolbar, { orientation: "horizontal" })).filter(
      (element) => element.attributes.get("data-slot") === "toolbar-button"
    );
    expect(
      buttons.map((button) => [
        button.attributes.get("aria-disabled"),
        button.attributes.has("data-disabled"),
      ])
    ).toEqual([
      ["false", false],
      ["false", false],
      ["true", true],
    ]);
  });
});
