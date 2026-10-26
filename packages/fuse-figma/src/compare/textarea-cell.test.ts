/**
 * The HTML the built Fuse Textarea renders for a cell. The unit under test is the Textarea renderer.
 * The oracle is Textarea's public contract, HTML's `<textarea>` and Base UI's documented Field
 * control state attributes (`research/input-textarea.md` §2): the root is a `<textarea
 * data-slot="textarea">` that holds a placeholder in `placeholder` or a typed value as its own text.
 * `readOnly` writes `readonly`. Rendered as a `Field.Control` inside a `Field.Root`, as the docs'
 * Field demo renders it, a disabled control carries `disabled` and `data-disabled` and never
 * `aria-disabled`, and an invalid field's carries `aria-invalid="true"` and `data-invalid`. The cell
 * keeps the textarea's own `data-slot`, which `Field.Control` would replace with `field-control`. The
 * field sits in a host 384px wide, the width the kit draws.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import type { MarkupElement } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { textarea } from "./textarea-cell";

/** The attributes that tell a textarea's text and state apart. */
const READ = [
  "placeholder",
  "value",
  "readonly",
  "disabled",
  "data-disabled",
  "aria-disabled",
  "aria-invalid",
  "data-invalid",
];

function attributesOf(element: MarkupElement): Readonly<Record<string, string>> {
  return Object.fromEntries(
    READ.flatMap((name) => {
      const value = element.attributes.get(name);
      return value === undefined ? [] : [[name, value]];
    })
  );
}

/** Each element as its name, its parent's index, its `data-slot` and its inline style, and the textarea. */
function outline(content: string, state: string) {
  const elements = elementsOf(renderCellHtml(textarea, { content, state }));
  const field = elements.find((element) => element.attributes.get("data-slot") === "textarea");
  return {
    tree: elements.map((element) => [
      element.name,
      element.parent,
      element.attributes.get("data-slot"),
      element.attributes.get("style"),
    ]),
    textarea: field === undefined ? undefined : { ...attributesOf(field), text: field.text },
  };
}

describe("the Textarea renderer", () => {
  it("renders an empty textarea holding the placeholder, in a field in a host 384px wide", () => {
    expect(outline("placeholder", "rest")).toEqual({
      tree: [
        ["div", undefined, undefined, "width:384px"],
        ["div", 0, "field", undefined],
        ["textarea", 1, "textarea", undefined],
      ],
      textarea: { placeholder: "Tell us more…", text: "" },
    });
  });

  it("renders a value cell with the value as its own text and no placeholder", () => {
    expect(outline("value", "rest").textarea).toEqual({ text: "Tell us more…" });
  });

  it("renders a read-only cell with readonly, and a disabled cell with disabled and data-disabled", () => {
    expect(outline("value", "readonly").textarea).toEqual({ readonly: "", text: "Tell us more…" });
    expect(outline("placeholder", "disabled").textarea).toEqual({
      placeholder: "Tell us more…",
      disabled: "",
      "data-disabled": "",
      text: "",
    });
  });

  it("renders an invalid cell in an invalid field, which marks the textarea aria-invalid and data-invalid", () => {
    expect(outline("value", "invalid").textarea).toEqual({
      "aria-invalid": "true",
      "data-invalid": "",
      text: "Tell us more…",
    });
  });
});
