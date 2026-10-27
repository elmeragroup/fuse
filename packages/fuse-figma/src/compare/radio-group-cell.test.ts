/**
 * The HTML the built Fuse RadioGroup renders for a Radio group cell. The unit under test is the Radio
 * group renderer. The oracle is RadioGroup's public contract and Base UI's documented Field and radio
 * attributes: a `Field.Root` holding a `Field.Set` with the legend row, the description, the group
 * primitive with the rows and, in an invalid Field, the error. The group carries the orientation in
 * `data-direction`, the first row is checked, `isDisabled` disables every radio and `isInvalid` marks
 * the root `data-invalid`. The field sits in a host 384px wide, the width the kit draws.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { radioGroup } from "./radio-group-cell";

function render(orientation: string, state: string) {
  const elements = elementsOf(renderCellHtml(radioGroup, { orientation, state }));
  const bySlot = (slot: string) => elements.filter((element) => element.attributes.get("data-slot") === slot);
  const setIndex = elements.findIndex((element) => element.attributes.get("data-slot") === "field-set");
  return {
    host: elements[0]?.attributes.get("style"),
    set: bySlot("field-set").length,
    parts: elements
      .filter((element) => element.parent === setIndex)
      .map((element) => element.attributes.get("data-slot") ?? element.name),
    legend: bySlot("field-legend")[0]?.text,
    direction: bySlot("radio-group")[0]?.attributes.get("data-direction"),
    rows: bySlot("radio-group-item").map((radio) =>
      ["data-checked", "data-disabled"].filter((name) => radio.attributes.has(name)).join(" ")
    ),
    invalid: bySlot("field")[0]?.attributes.has("data-invalid"),
    error: bySlot("field-error")[0]?.text,
  };
}

describe("the Radio group renderer", () => {
  it("renders the legend, the description and three rows, the first checked, in a host 384px wide", () => {
    expect(render("vertical", "rest")).toEqual({
      host: "width:384px",
      set: 1,
      parts: ["div", "field-description", "radio-group"],
      legend: "Contract",
      direction: "vertical",
      rows: ["data-checked", "", ""],
      invalid: false,
      error: undefined,
    });
  });

  it("renders a horizontal group, a disabled one, and an invalid one with its error after the group", () => {
    expect(render("horizontal", "rest").direction).toBe("horizontal");
    expect(render("vertical", "disabled").rows).toEqual([
      "data-checked data-disabled",
      "data-disabled",
      "data-disabled",
    ]);
    expect(render("vertical", "invalid")).toMatchObject({
      parts: ["div", "field-description", "radio-group", "field-error"],
      invalid: true,
      error: "Pick a contract.",
    });
  });
});
