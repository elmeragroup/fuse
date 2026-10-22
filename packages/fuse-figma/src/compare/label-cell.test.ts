/**
 * The HTML the built Fuse Field renders for a `label` cell. The unit under test is the Label
 * renderer. The oracle is Field's public contract and Base UI's documented Field state attributes:
 * `Field.Root` is a `<div data-slot="field">` and `Field.Label` a `<label data-slot="field-label">`
 * inside it holding its text, and a disabled Field marks both `data-disabled`, with no `disabled`
 * or `aria-disabled` on the label.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { label } from "./label-cell";

/** Each element as its name, its parent's index, its `data-slot` and its disabled attributes. */
function outline(state: string) {
  const html = renderCellHtml(label, { state });
  return {
    html,
    elements: elementsOf(html).map((element) => [
      element.name,
      element.parent,
      element.attributes.get("data-slot"),
      ["data-disabled", "disabled", "aria-disabled"].filter((name) => element.attributes.has(name)),
    ]),
  };
}

describe("the Label renderer", () => {
  it("renders the label Email inside an enabled Field root", () => {
    const { html, elements } = outline("rest");
    expect(elements).toEqual([
      ["div", undefined, "field", []],
      ["label", 0, "field-label", []],
    ]);
    expect(html).toMatch(/>Email<\/label><\/div>$/);
  });

  it("renders a disabled cell inside a disabled Field root, which marks both data-disabled", () => {
    expect(outline("disabled").elements).toEqual([
      ["div", undefined, "field", ["data-disabled"]],
      ["label", 0, "field-label", ["data-disabled"]],
    ]);
  });
});
