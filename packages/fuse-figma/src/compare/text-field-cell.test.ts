/**
 * The HTML the built Fuse TextField renders for a cell. The unit under test is the Text field
 * renderer. The oracle is TextField's public contract and Base UI's documented Field state
 * attributes: the field is a `Field.Root` holding a heading row with the label and FieldFrame's
 * content wrapper, which holds the `relative` container around the `<input data-slot="input">`, the
 * error in an invalid field and the description. The input holds the placeholder in `placeholder` or
 * a value in `value`. `isReadOnly` writes `readonly`; `isDisabled` disables the input and marks the
 * root `data-disabled`; `isInvalid` marks the root `data-invalid` and the input `aria-invalid="true"`.
 * The field sits in a host 384px wide, the width the kit draws.
 */
import { describe, expect, it } from "vitest";

import { attributesNamed, bySlot, elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { textField } from "./text-field-cell";

/** The attributes that tell the cells apart, on the element that carries them. */
const READ = [
  "placeholder",
  "value",
  "readonly",
  "disabled",
  "data-disabled",
  "aria-invalid",
  "data-invalid",
];

/** Each element as its tag, its parent's index, its `data-slot` and its text, and the root's and input's state. */
function outline(content: string, state: string) {
  const elements = elementsOf(renderCellHtml(textField, { content, state }));
  return {
    tree: elements.map((element) => [
      element.name,
      element.parent,
      element.attributes.get("data-slot"),
      element.text,
    ]),
    field: attributesNamed(bySlot(elements, "field"), READ),
    input: attributesNamed(bySlot(elements, "input"), READ),
  };
}

describe("the Text field renderer", () => {
  it("renders the label, the input with the placeholder in its container and the description, in a host 384px wide", () => {
    expect(outline("placeholder", "rest")).toEqual({
      tree: [
        ["div", undefined, undefined, ""],
        ["div", 0, "field", ""],
        ["div", 1, undefined, ""],
        ["label", 2, "field-label", "Email"],
        ["div", 1, undefined, ""],
        ["div", 4, undefined, ""],
        ["input", 5, "input", ""],
        ["p", 4, "field-description", "Work address preferred."],
      ],
      field: {},
      input: { placeholder: "name@example.com" },
    });
  });

  it("renders a value cell's text in the input's value, read-only where the cell is", () => {
    expect(outline("value", "readonly").input).toEqual({ value: "name@example.com", readonly: "" });
  });

  it("renders a disabled input in a disabled Field", () => {
    const disabled = outline("placeholder", "disabled");
    expect([disabled.field, disabled.input]).toEqual([
      { "data-disabled": "" },
      { placeholder: "name@example.com", disabled: "", "data-disabled": "" },
    ]);
  });

  it("renders an invalid Field with the error between the input's container and the description", () => {
    const invalid = outline("placeholder", "invalid");
    expect([invalid.field, invalid.input]).toEqual([
      { "data-invalid": "" },
      { placeholder: "name@example.com", "aria-invalid": "true", "data-invalid": "" },
    ]);
    expect(invalid.tree.slice(7)).toEqual([
      ["div", 4, "field-error", "Enter a work email."],
      ["p", 4, "field-description", "Work address preferred."],
    ]);
  });
});
