/**
 * The HTML the built Fuse Select renders for a Select trigger cell. The unit under test is the
 * Select trigger renderer. The oracle is Select's public contract and Base UI's documented trigger
 * attributes: `Select.Trigger` renders a `<button data-slot="select-trigger">` with its `size` in
 * `data-size`, holding the `<span data-slot="select-value">` and the caret `<svg>`. Base UI marks the
 * trigger `data-placeholder` while nothing is selected, `data-popup-open`, `data-pressed` and
 * `aria-expanded="true"` while the popup is open, `disabled` and `data-disabled` while disabled, and
 * `aria-invalid="true"` and `data-invalid` inside an invalid `Field.Root`. The markup check in
 * `kit-markup.test.ts` reads the attributes the kit's variants select, so it cannot tell an open
 * cell that renders the popup from one that does not, a trigger stamped open by hand from one Base
 * UI opened, or a trigger at the wrong size.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import type { MarkupElement } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { selectTrigger } from "./select-trigger-cell";

/** The attributes that tell a trigger's size, text and state apart. */
const READ = [
  "data-size",
  "data-placeholder",
  "data-popup-open",
  "data-pressed",
  "aria-expanded",
  "disabled",
  "data-disabled",
  "aria-disabled",
  "aria-invalid",
  "data-invalid",
];

function attributesOf(element: MarkupElement | undefined): Readonly<Record<string, string>> {
  return Object.fromEntries(
    READ.flatMap((name) => {
      const value = element?.attributes.get(name);
      return value === undefined ? [] : [[name, value]];
    })
  );
}

/** A cell's elements, the trigger, the value and the caret among them, and each one's parent. */
function render(cell: Readonly<Record<string, string>>) {
  const elements = elementsOf(renderCellHtml(selectTrigger, cell));
  const slotted = (slot: string) => elements.find((element) => element.attributes.get("data-slot") === slot);
  return {
    elements,
    trigger: slotted("select-trigger"),
    value: slotted("select-value"),
    caret: elements.find((element) => element.name === "svg"),
    parentOf: (element: MarkupElement | undefined) =>
      element?.parent === undefined ? undefined : elements[element.parent],
  };
}

const REST = { size: "default", state: "rest", content: "placeholder", open: "off" };

describe("the Select trigger renderer", () => {
  it("renders a closed trigger holding the placeholder, its value and its caret", () => {
    const { trigger, value, caret, parentOf } = render(REST);
    expect(attributesOf(trigger)).toEqual({
      "data-size": "default",
      "data-placeholder": "",
      "aria-expanded": "false",
    });
    expect(value?.text).toBe("Pick a fruit");
    expect([parentOf(value), parentOf(caret)]).toEqual([trigger, trigger]);
    expect(attributesOf(caret)).toEqual({});
  });

  it("renders an open trigger as Base UI marks it while its popup is open, with no popup", () => {
    const { elements, trigger, caret } = render({ ...REST, open: "on" });
    expect(attributesOf(trigger)).toEqual({
      "data-size": "default",
      "data-placeholder": "",
      "data-popup-open": "",
      "data-pressed": "",
      "aria-expanded": "true",
    });
    expect(attributesOf(caret)).toEqual({ "data-popup-open": "" });
    expect(
      elements.filter(
        (element) =>
          (element.attributes.get("data-slot") ?? "").startsWith("select-content") ||
          element.attributes.get("role") === "listbox"
      )
    ).toEqual([]);
  });

  it("renders a value cell with the item's label and no data-placeholder", () => {
    const { trigger, value } = render({ ...REST, content: "value" });
    expect(attributesOf(trigger)).toEqual({ "data-size": "default", "aria-expanded": "false" });
    expect(value?.text).toBe("Pick a fruit");
  });

  it("renders the sm size, a disabled trigger, and an invalid one inside an invalid Field root", () => {
    expect(attributesOf(render({ ...REST, size: "sm" }).trigger)["data-size"]).toBe("sm");
    expect(attributesOf(render({ ...REST, state: "disabled" }).trigger)).toEqual({
      "data-size": "default",
      "data-placeholder": "",
      "aria-expanded": "false",
      disabled: "",
      "data-disabled": "",
    });
    const { trigger, parentOf } = render({ ...REST, state: "invalid" });
    const field = parentOf(trigger);
    expect([field?.attributes.get("data-slot"), field?.attributes.get("data-invalid")]).toEqual([
      "field",
      "",
    ]);
    expect(attributesOf(trigger)).toMatchObject({ "aria-invalid": "true", "data-invalid": "" });
  });
});
