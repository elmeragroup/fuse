/**
 * The HTML the built Fuse TextareaField renders for a cell. The unit under test is the Textarea field
 * renderer. The oracle is TextareaField's public contract and Base UI's documented Field state
 * attributes: the field is a `Field.Root` holding a heading row with the label and, given
 * `maxLength`, the `current/max` counter, then the textarea, which `Field.Control` marks
 * `data-slot="field-control"`, then the error in an invalid field and the description. `readOnly`
 * writes `readonly` on the textarea; `isDisabled` disables the textarea and marks the root
 * `data-disabled`; `isInvalid` marks the root `data-invalid` and the textarea `aria-invalid="true"`.
 * The field sits in a host 384px wide, the width the kit draws.
 */
import { describe, expect, it } from "vitest";

import { attributesNamed, bySlot, elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { textareaField } from "./textarea-field-cell";

/** The attributes that tell the cells apart, on the element that carries them. */
const READ = ["placeholder", "readonly", "disabled", "data-disabled", "aria-invalid", "data-invalid"];

/** Each element as its tag, its parent's index, its `data-slot` and its text, and the root's and textarea's state. */
function outline(state: string, turnedOn: ReadonlySet<string> = new Set()) {
  const elements = elementsOf(renderCellHtml(textareaField, { state }, turnedOn));
  return {
    tree: elements.map((element) => [
      element.name,
      element.parent,
      element.attributes.get("data-slot"),
      element.text,
    ]),
    field: attributesNamed(bySlot(elements, "field"), READ),
    textarea: attributesNamed(bySlot(elements, "field-control"), READ),
  };
}

describe("the Textarea field renderer", () => {
  it("renders the label, the textarea with the placeholder and the description, in a host 384px wide", () => {
    expect(outline("rest")).toEqual({
      tree: [
        ["div", undefined, undefined, ""],
        ["div", 0, "field", ""],
        ["div", 1, undefined, ""],
        ["label", 2, "field-label", "Bio"],
        ["textarea", 1, "field-control", ""],
        ["p", 1, "field-description", "Shown to other users."],
      ],
      field: {},
      textarea: { placeholder: "Write a short bio." },
    });
  });

  it("renders the 0/120 counter after the label with the Counter property on", () => {
    expect(outline("rest", new Set(["Counter"])).tree.slice(2, 5)).toEqual([
      ["div", 1, undefined, ""],
      ["label", 2, "field-label", "Bio"],
      ["span", 2, undefined, "0/120"],
    ]);
  });

  it("renders a read-only textarea, and a disabled one in a disabled Field", () => {
    expect([outline("readonly").textarea, outline("disabled").field, outline("disabled").textarea]).toEqual([
      { placeholder: "Write a short bio.", readonly: "" },
      { "data-disabled": "" },
      { placeholder: "Write a short bio.", disabled: "", "data-disabled": "" },
    ]);
  });

  it("renders an invalid Field with the error between the textarea and the description", () => {
    const invalid = outline("invalid");
    expect([invalid.field, invalid.textarea]).toEqual([
      { "data-invalid": "" },
      { placeholder: "Write a short bio.", "aria-invalid": "true", "data-invalid": "" },
    ]);
    expect(invalid.tree.slice(4)).toEqual([
      ["textarea", 1, "field-control", ""],
      ["div", 1, "field-error", "Keep it under 120 characters."],
      ["p", 1, "field-description", "Shown to other users."],
    ]);
  });
});
