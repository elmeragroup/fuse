/**
 * The HTML the built Fuse Switch renders for a cell. The unit under test is the Switch renderer.
 * The oracle is Switch's public contract and Base UI's documented Switch state attributes: the
 * track is a `<span role="switch">` whose `aria-checked` states whether it is on, carrying the
 * `data-size` it renders at and exactly one of `data-checked` and `data-unchecked`, the
 * `switch-thumb` span inside it is always mounted and carries the same checked attribute, a
 * disabled switch carries `aria-disabled="true"` and `data-disabled` and stays a span with no
 * `disabled` attribute, and a switch in an invalid field carries `aria-invalid="true"` and
 * `data-invalid`.
 */
import { describe, expect, it } from "vitest";

import { rootOf, stateAttributes } from "../../test/static-markup";
import type { MarkupNode } from "../../test/static-markup";
import type { Cell } from "../components/component-spec";
import { renderCellHtml } from "./cell-renderers";
import { switchCell } from "./switch-cell";

/** The switch's track the cell renders, wherever it sits, and the thumb inside it. */
function track(cell: Cell) {
  const element = rootOf(renderCellHtml(switchCell, cell), { slot: "switch", name: "span", role: "switch" });
  return { element, inside: element.children };
}

/** Each element inside the track: its name, its `data-slot` and its state attributes. */
function children(inside: readonly MarkupNode[]) {
  return inside.map((child) => [child.name, child.attributes.get("data-slot"), stateAttributes(child)]);
}

const REST: Cell = { size: "default", checked: "off", state: "rest" };

describe("the Switch renderer", () => {
  it("renders an unchecked, enabled, valid default switch named Notifications, around an unchecked thumb", () => {
    const { element, inside } = track(REST);
    expect(element.attributes.get("aria-checked")).toBe("false");
    expect(element.attributes.get("aria-label")).toBe("Notifications");
    expect(element.attributes.get("data-size")).toBe("default");
    expect(stateAttributes(element)).toEqual(["data-unchecked"]);
    expect(children(inside)).toEqual([["span", "switch-thumb", ["data-unchecked"]]]);
  });

  it("renders a small checked cell with aria-checked true and data-checked on the track and thumb", () => {
    const { element, inside } = track({ ...REST, size: "sm", checked: "on" });
    expect(element.attributes.get("aria-checked")).toBe("true");
    expect(element.attributes.get("data-size")).toBe("sm");
    expect(stateAttributes(element)).toEqual(["data-checked"]);
    expect(children(inside)).toEqual([["span", "switch-thumb", ["data-checked"]]]);
  });

  it("renders a disabled cell as a span with aria-disabled and data-disabled, and no disabled attribute", () => {
    const { element } = track({ ...REST, state: "disabled" });
    expect(element.attributes.get("aria-disabled")).toBe("true");
    expect(stateAttributes(element)).toEqual(["data-unchecked", "aria-disabled", "data-disabled"]);
  });

  it("renders an invalid cell with aria-invalid true and data-invalid", () => {
    const { element } = track({ ...REST, checked: "on", state: "invalid" });
    expect(element.attributes.get("aria-invalid")).toBe("true");
    expect(stateAttributes(element)).toEqual(["data-checked", "aria-invalid", "data-invalid"]);
  });
});
