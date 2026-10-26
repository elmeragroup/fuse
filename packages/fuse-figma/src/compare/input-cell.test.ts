/**
 * The HTML the built Fuse Input renders for a cell. The unit under test is the Input renderer. The
 * oracle is Input's public contract, HTML's `<input>` attributes and Base UI's documented Field
 * control state attributes (`research/input-textarea.md` §2): the root is an `<input
 * data-slot="input">` with no text of its own, holding a placeholder in `placeholder` or a typed
 * value in `value`. `readOnly` writes `readonly`, a disabled input carries `disabled` and
 * `data-disabled` and never `aria-disabled`, and an input inside an invalid `Field.Root` carries
 * `aria-invalid="true"` and `data-invalid`. The cell sits in a host 384px wide, the width the kit
 * draws.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import type { MarkupElement } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { input } from "./input-cell";

/** The attributes that tell an input's text and state apart. */
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

/** Each element as its name, its parent's index, its `data-slot`, its inline style and its own text. */
function outline(content: string, state: string) {
  const elements = elementsOf(renderCellHtml(input, { content, state }));
  const field = elements.find((element) => element.attributes.get("data-slot") === "input");
  return {
    tree: elements.map((element) => [
      element.name,
      element.parent,
      element.attributes.get("data-slot"),
      element.attributes.get("style"),
      element.text,
    ]),
    input: field === undefined ? undefined : attributesOf(field),
  };
}

const HOST = ["div", undefined, undefined, "width:384px", ""];

describe("the Input renderer", () => {
  it("renders an empty input holding the placeholder, in a host 384px wide", () => {
    expect(outline("placeholder", "rest")).toEqual({
      tree: [HOST, ["input", 0, "input", undefined, ""]],
      input: { placeholder: "name@example.com" },
    });
  });

  it("renders a value cell with the value and no placeholder", () => {
    expect(outline("value", "rest").input).toEqual({ value: "name@example.com" });
  });

  it("renders a read-only cell with readonly, and a disabled cell with disabled and data-disabled", () => {
    expect(outline("value", "readonly").input).toEqual({ value: "name@example.com", readonly: "" });
    expect(outline("placeholder", "disabled").input).toEqual({
      placeholder: "name@example.com",
      disabled: "",
      "data-disabled": "",
    });
  });

  it("renders an invalid cell inside an invalid Field root, which marks the input aria-invalid and data-invalid", () => {
    const { tree, input: attributes } = outline("value", "invalid");
    expect(tree.map(([name, parent, slot]) => [name, parent, slot])).toEqual([
      ["div", undefined, undefined],
      ["div", 0, "field"],
      ["input", 1, "input"],
    ]);
    expect(attributes).toEqual({ value: "name@example.com", "aria-invalid": "true", "data-invalid": "" });
  });
});
