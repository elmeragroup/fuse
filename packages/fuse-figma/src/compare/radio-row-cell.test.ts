/**
 * The HTML the built Fuse RadioGroup renders for a Radio row cell. The unit under test is the Radio
 * row renderer. The oracle is Radio's public contract and Base UI's documented radio attributes: a
 * `<Radio>` renders `<div data-slot="field-item">` holding a `<label>` around the radio, its hidden
 * input and a `<span>` with the text. Base UI marks the radio `data-checked` while the group's value
 * is the row's, `data-disabled` with `isDisabled`, and `aria-invalid="true"` in an invalid group. A
 * hugging row sits in a horizontal group, and a filling one in a vertical group in a host 384px wide.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { radioRow } from "./radio-row-cell";

function render(cell: Readonly<Record<string, string>>) {
  const elements = elementsOf(renderCellHtml(radioRow, cell));
  const bySlot = (slot: string) => elements.find((element) => element.attributes.get("data-slot") === slot);
  const radio = bySlot("radio-group-item");
  return {
    host: elements[0]?.attributes.get("style"),
    direction: bySlot("radio-group")?.attributes.get("data-direction"),
    radio: ["data-checked", "data-unchecked", "data-disabled", "aria-invalid"].filter((name) =>
      radio?.attributes.has(name)
    ),
    text: elements.find((element) => element.name === "span" && element.text !== "")?.text,
  };
}

describe("the Radio row renderer", () => {
  it("renders a hugging row in a horizontal group and a filling one in a vertical group 384px wide", () => {
    expect([
      render({ width: "hug", checked: "on", state: "rest" }),
      render({ width: "fill", checked: "off", state: "rest" }),
    ]).toEqual([
      { host: undefined, direction: "horizontal", radio: ["data-checked"], text: "Fixed" },
      { host: "width:384px", direction: "vertical", radio: ["data-unchecked"], text: "Fixed" },
    ]);
  });

  it("renders a disabled row and a row in an invalid group", () => {
    expect([
      render({ width: "hug", checked: "off", state: "disabled" }).radio,
      render({ width: "hug", checked: "off", state: "invalid" }).radio,
    ]).toEqual([
      ["data-unchecked", "data-disabled"],
      ["data-unchecked", "aria-invalid"],
    ]);
  });
});
