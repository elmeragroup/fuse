/**
 * The HTML the built Fuse Checkbox renders for a cell. The unit under test is the Checkbox
 * renderer. The oracle is Checkbox's public contract and Base UI's documented Checkbox state
 * attributes: the root is a `<span role="checkbox">` whose `aria-checked` is `true`, `false` or
 * `mixed`, it carries exactly one of `data-checked`, `data-unchecked` and `data-indeterminate`,
 * the `checkbox-indicator` span is mounted only while it is checked or indeterminate and holds
 * the glyph, a disabled checkbox carries `aria-disabled="true"` and `data-disabled` and stays a
 * span with no `disabled` attribute, and a checkbox in an invalid field carries
 * `aria-invalid="true"` and `data-invalid`.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import type { MarkupElement } from "../../test/static-markup";
import type { Cell } from "../components/component-spec";
import { renderCellHtml } from "./cell-renderers";
import { checkbox } from "./checkbox-cell";

/** The checkbox the cell renders, wherever it sits, and the element names inside it. */
function box(cell: Cell) {
  const elements = elementsOf(renderCellHtml(checkbox, cell));
  const index = elements.findIndex((element) => element.attributes.get("data-slot") === "checkbox");
  const element = elements[index];
  if (element?.name !== "span" || element.attributes.get("role") !== "checkbox") {
    throw new Error(`no checkbox span in the ${JSON.stringify(cell)} cell`);
  }
  const children = elements.flatMap((child, childIndex) => (child.parent === index ? [childIndex] : []));
  const inside = children.map((childIndex) => {
    const child = elements[childIndex];
    const glyphs = elements.filter((candidate) => candidate.parent === childIndex).map(({ name }) => name);
    return { slot: child?.attributes.get("data-slot"), glyphs };
  });
  return { element, inside };
}

/** The state attributes a checkbox carries, among the ones the cells vary. */
function stateAttributes(element: MarkupElement): readonly string[] {
  return [
    "data-checked",
    "data-unchecked",
    "data-indeterminate",
    "aria-disabled",
    "data-disabled",
    "disabled",
    "aria-invalid",
    "data-invalid",
  ].filter((name) => element.attributes.has(name));
}

const REST: Cell = { checked: "off", state: "rest" };
const INDICATOR = [{ slot: "checkbox-indicator", glyphs: ["svg"] }];

describe("the Checkbox renderer", () => {
  it("renders an unchecked, enabled, valid checkbox named Accept, with no indicator", () => {
    const { element, inside } = box(REST);
    expect(element.attributes.get("aria-checked")).toBe("false");
    expect(element.attributes.get("aria-label")).toBe("Accept");
    expect(stateAttributes(element)).toEqual(["data-unchecked"]);
    expect(inside).toEqual([]);
  });

  it("renders a checked cell with aria-checked true, data-checked and the indicator around one glyph", () => {
    const { element, inside } = box({ ...REST, checked: "on" });
    expect(element.attributes.get("aria-checked")).toBe("true");
    expect(stateAttributes(element)).toEqual(["data-checked"]);
    expect(inside).toEqual(INDICATOR);
  });

  it("renders a mixed cell with aria-checked mixed, data-indeterminate and the indicator", () => {
    const { element, inside } = box({ ...REST, checked: "mixed" });
    expect(element.attributes.get("aria-checked")).toBe("mixed");
    expect(stateAttributes(element)).toEqual(["data-indeterminate"]);
    expect(inside).toEqual(INDICATOR);
  });

  it("renders a disabled cell as a span with aria-disabled and data-disabled, and no disabled attribute", () => {
    const { element } = box({ ...REST, checked: "on", state: "disabled" });
    expect(element.attributes.get("aria-disabled")).toBe("true");
    expect(stateAttributes(element)).toEqual(["data-checked", "aria-disabled", "data-disabled"]);
  });

  it("renders an invalid cell with aria-invalid true and data-invalid", () => {
    const { element } = box({ ...REST, checked: "mixed", state: "invalid" });
    expect(element.attributes.get("aria-invalid")).toBe("true");
    expect(stateAttributes(element)).toEqual(["data-indeterminate", "aria-invalid", "data-invalid"]);
  });
});
