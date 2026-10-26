/**
 * The HTML the built Fuse SelectField renders for a cell. The unit under test is the Select field
 * renderer. The oracle is SelectField's public contract and Base UI's documented Field and Select
 * attributes: the field is a `Field.Root` holding a heading row with the label, then the
 * `Select.Trigger` with `w-full` around the `Select.Value`, Base UI's hidden form `<input>`, the error
 * in an invalid field and the description. The trigger shows the placeholder and carries
 * `data-placeholder` while nothing is selected, and the selected item's label otherwise.
 * `isDisabled` disables the trigger and marks the root `data-disabled`; `isInvalid` marks the root
 * `data-invalid` and the trigger `aria-invalid="true"`. The field sits in a host 384px wide, the width
 * the kit draws.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import type { MarkupElement } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { selectField } from "./select-field-cell";

/** The attributes that tell the cells apart, on the element that carries them. */
const READ = ["data-placeholder", "disabled", "data-disabled", "aria-invalid", "data-invalid"];

function attributesOf(element: MarkupElement | undefined): Readonly<Record<string, string>> {
  return Object.fromEntries(
    READ.flatMap((name) => {
      const value = element?.attributes.get(name);
      return value === undefined ? [] : [[name, value]];
    })
  );
}

/** Each element as its tag, its parent's index, its `data-slot` and its text, and the root's and trigger's state. */
function outline(state: string, content: string) {
  const elements = elementsOf(renderCellHtml(selectField, { state, content }));
  const bySlot = (slot: string) => elements.find((element) => element.attributes.get("data-slot") === slot);
  return {
    tree: elements
      .filter((element) => element.name !== "svg" && element.name !== "path")
      .map((element) => [element.name, element.parent, element.attributes.get("data-slot"), element.text]),
    field: attributesOf(bySlot("field")),
    trigger: attributesOf(bySlot("select-trigger")),
    fills: bySlot("select-trigger")?.attributes.get("class")?.split(" ").includes("w-full"),
  };
}

describe("the Select field renderer", () => {
  it("renders the label, the filling trigger with the placeholder and the description, in a host 384px wide", () => {
    expect(outline("rest", "placeholder")).toEqual({
      tree: [
        ["div", undefined, undefined, ""],
        ["div", 0, "field", ""],
        ["div", 1, undefined, ""],
        ["label", 2, "field-label", "Plan"],
        ["button", 1, "select-trigger", ""],
        ["span", 4, "select-value", "Choose a plan"],
        ["input", 1, undefined, ""],
        ["p", 1, "field-description", "You can change plan later."],
      ],
      field: {},
      trigger: { "data-placeholder": "" },
      fills: true,
    });
  });

  it("renders the selected plan's label with no data-placeholder in a value cell", () => {
    const value = outline("rest", "value");
    expect([value.tree[5], value.trigger]).toEqual([["span", 4, "select-value", "Pro"], {}]);
  });

  it("renders a disabled trigger in a disabled Field", () => {
    const disabled = outline("disabled", "value");
    expect([disabled.field, disabled.trigger]).toEqual([
      { "data-disabled": "" },
      { disabled: "", "data-disabled": "" },
    ]);
  });

  it("renders an invalid Field with the error between the trigger and the description", () => {
    const invalid = outline("invalid", "placeholder");
    expect([invalid.field, invalid.trigger]).toEqual([
      { "data-invalid": "" },
      { "data-placeholder": "", "aria-invalid": "true", "data-invalid": "" },
    ]);
    expect(invalid.tree.slice(6)).toEqual([
      ["input", 1, undefined, ""],
      ["div", 1, "field-error", "Choose a plan to continue."],
      ["p", 1, "field-description", "You can change plan later."],
    ]);
  });
});
