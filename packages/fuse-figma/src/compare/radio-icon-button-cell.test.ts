/**
 * The HTML the built Fuse RadioIconButton renders for a cell. The unit under test is the Radio
 * icon button renderer. The oracle is RadioIconButton's public contract and Base UI's documented
 * Radio state attributes: the root is a `<span role="radio">` whose `aria-checked` states whether
 * it is checked, `data-checked` is present while it is checked and `data-unchecked` while it is
 * not, a disabled radio carries `aria-disabled="true"` and `data-disabled` and stays a span with
 * no `disabled` attribute, and a radio in an invalid field carries `aria-invalid="true"` and
 * `data-invalid`.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import type { MarkupElement } from "../../test/static-markup";
import type { Cell } from "../components/component-spec";
import { renderCellHtml } from "./cell-renderers";
import { radioIconButton } from "./radio-icon-button-cell";

/** The radio the cell renders, wherever it sits in its group, and its child elements. */
function radio(cell: Cell) {
  const elements = elementsOf(renderCellHtml(radioIconButton, cell));
  const index = elements.findIndex((element) => element.attributes.get("data-slot") === "radio-icon-button");
  const element = elements[index];
  if (element?.name !== "span" || element.attributes.get("role") !== "radio") {
    throw new Error(`no radio span in the ${JSON.stringify(cell)} cell`);
  }
  return { element, icons: elements.filter((candidate) => candidate.parent === index) };
}

/** The state attributes a radio carries, among the ones the cells vary. */
function stateAttributes(element: MarkupElement): readonly string[] {
  return [
    "data-checked",
    "data-unchecked",
    "aria-disabled",
    "data-disabled",
    "disabled",
    "aria-invalid",
    "data-invalid",
  ].filter((name) => element.attributes.has(name));
}

const REST: Cell = { size: "icon", checked: "off", state: "rest" };

describe("the Radio icon button renderer", () => {
  it("renders an unchecked, enabled, valid radio at rest, named List around one List icon", () => {
    const { element, icons } = radio(REST);
    expect(element.attributes.get("aria-checked")).toBe("false");
    expect(element.attributes.get("aria-label")).toBe("List");
    expect(stateAttributes(element)).toEqual(["data-unchecked"]);
    expect(icons.map((icon) => [icon.name, icon.attributes.get("data-icon")])).toEqual([["svg", undefined]]);
  });

  it("renders a checked cell with aria-checked true and data-checked", () => {
    const { element } = radio({ ...REST, size: "icon-lg", checked: "on" });
    expect(element.attributes.get("aria-checked")).toBe("true");
    expect(stateAttributes(element)).toEqual(["data-checked"]);
  });

  it("renders a disabled cell as a span with aria-disabled and data-disabled, and no disabled attribute", () => {
    const { element } = radio({ ...REST, size: "icon-xxs", checked: "on", state: "disabled" });
    expect(element.attributes.get("aria-disabled")).toBe("true");
    expect(stateAttributes(element)).toEqual(["data-checked", "aria-disabled", "data-disabled"]);
  });

  it("renders an invalid cell with aria-invalid true and data-invalid", () => {
    const { element } = radio({ ...REST, size: "icon-sm", state: "invalid" });
    expect(element.attributes.get("aria-invalid")).toBe("true");
    expect(stateAttributes(element)).toEqual(["data-unchecked", "aria-invalid", "data-invalid"]);
  });
});
