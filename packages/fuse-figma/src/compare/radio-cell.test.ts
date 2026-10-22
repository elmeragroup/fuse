/**
 * The HTML the built Fuse RadioGroupItem renders for a cell. The unit under test is the Radio
 * renderer. The oracle is RadioGroupItem's public contract and Base UI's documented Radio state
 * attributes: the root is a `<span role="radio">` whose `aria-checked` states whether it is
 * checked, `data-checked` is present while it is checked and `data-unchecked` while it is not, the
 * `radio-group-indicator` span is mounted only while it is checked and holds the dot, a disabled
 * radio carries `aria-disabled="true"` and `data-disabled` and stays a span with no `disabled`
 * attribute, and a radio in an invalid group carries `aria-invalid="true"` and `data-invalid`.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import type { MarkupElement } from "../../test/static-markup";
import type { Cell } from "../components/component-spec";
import { renderCellHtml } from "./cell-renderers";
import { radio } from "./radio-cell";

/** The radio the cell renders, wherever it sits in its group, and the elements inside it. */
function item(cell: Cell) {
  const elements = elementsOf(renderCellHtml(radio, cell));
  const index = elements.findIndex((element) => element.attributes.get("data-slot") === "radio-group-item");
  const element = elements[index];
  if (element?.name !== "span" || element.attributes.get("role") !== "radio") {
    throw new Error(`no radio span in the ${JSON.stringify(cell)} cell`);
  }
  const inside = elements.flatMap((child, childIndex) => {
    if (child.parent !== index) {
      return [];
    }
    const grandchildren = elements.filter((candidate) => candidate.parent === childIndex);
    return [
      {
        slot: child.attributes.get("data-slot"),
        children: grandchildren.map((grandchild) => [
          grandchild.name,
          grandchild.attributes.get("data-slot"),
        ]),
      },
    ];
  });
  return { element, inside };
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

const REST: Cell = { checked: "off", state: "rest" };

describe("the Radio renderer", () => {
  it("renders an unchecked, enabled, valid radio named Option, with no indicator", () => {
    const { element, inside } = item(REST);
    expect(element.attributes.get("aria-checked")).toBe("false");
    expect(element.attributes.get("aria-label")).toBe("Option");
    expect(stateAttributes(element)).toEqual(["data-unchecked"]);
    expect(inside).toEqual([]);
  });

  it("renders a checked cell with aria-checked true, data-checked and the indicator around one dot", () => {
    const { element, inside } = item({ ...REST, checked: "on" });
    expect(element.attributes.get("aria-checked")).toBe("true");
    expect(stateAttributes(element)).toEqual(["data-checked"]);
    expect(inside).toEqual([{ slot: "radio-group-indicator", children: [["span", undefined]] }]);
  });

  it("renders a disabled cell as a span with aria-disabled and data-disabled, and no disabled attribute", () => {
    const { element } = item({ ...REST, checked: "on", state: "disabled" });
    expect(element.attributes.get("aria-disabled")).toBe("true");
    expect(stateAttributes(element)).toEqual(["data-checked", "aria-disabled", "data-disabled"]);
  });

  it("renders an invalid cell with aria-invalid true and data-invalid", () => {
    const { element } = item({ ...REST, checked: "on", state: "invalid" });
    expect(element.attributes.get("aria-invalid")).toBe("true");
    expect(stateAttributes(element)).toEqual(["data-checked", "aria-invalid", "data-invalid"]);
  });
});
