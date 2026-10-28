/**
 * The HTML the built Fuse NumberField renders for a cell. The units under test are the Number field
 * stepper and Number field renderers. The oracle is NumberField's public contract and Base UI's
 * documented NumberField attributes: the field renders a group, `role="group"`, holding the input with
 * the value, the denomination when given, and the decrease and increase steppers, `<button
 * aria-label>`. A stepper at its bound is `disabled`; a read-only field marks its steppers
 * `aria-disabled="true"` and `data-readonly` and leaves them enabled; a disabled field disables them.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import type { MarkupElement } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { numberField, numberFieldStepper } from "./number-field-cell";

/** Each stepper's label and state attributes. */
function steppers(elements: readonly MarkupElement[]) {
  return elements
    .filter((element) => element.name === "button")
    .map((button) =>
      [
        button.attributes.get("aria-label"),
        ...["disabled", "data-readonly"].filter((name) => button.attributes.has(name)),
        button.attributes.get("aria-disabled") === "true" ? "aria-disabled" : undefined,
      ].filter((part) => part !== undefined)
    );
}

describe("the Number field stepper renderer", () => {
  it("renders the field's two steppers, the increase one disabled at its bound or read-only", () => {
    expect(
      ["rest", "disabled", "readonly"].map((state) =>
        steppers(elementsOf(renderCellHtml(numberFieldStepper, { state })))
      )
    ).toEqual([
      [["Decrease"], ["Increase"]],
      [["Decrease"], ["Increase", "disabled", "aria-disabled"]],
      [
        ["Decrease", "data-readonly", "aria-disabled"],
        ["Increase", "data-readonly", "aria-disabled"],
      ],
    ]);
  });
});

describe("the Number field renderer", () => {
  it("renders the value in the group's input, in a host 384px wide, and the denomination with the property on", () => {
    const plain = elementsOf(renderCellHtml(numberField, { state: "rest" }));
    const input = plain.find((element) => element.attributes.has("data-focus-ring-control"));
    expect([plain[0]?.attributes.get("style"), input?.attributes.get("value")]).toEqual(["width:384px", "4"]);
    const denominated = elementsOf(renderCellHtml(numberField, { state: "rest" }, new Set(["Denomination"])));
    expect(denominated.some((element) => element.name === "div" && element.text === "kWh")).toBe(true);
    expect(plain.some((element) => element.text === "kWh")).toBe(false);
  });

  it("disables the steppers in a disabled field and renders the error in an invalid one", () => {
    expect(steppers(elementsOf(renderCellHtml(numberField, { state: "disabled" })))).toEqual([
      ["Decrease", "disabled", "aria-disabled"],
      ["Increase", "disabled", "aria-disabled"],
    ]);
    const invalid = elementsOf(renderCellHtml(numberField, { state: "invalid" }));
    expect(invalid.find((element) => element.attributes.get("data-slot") === "field-error")?.text).toBe(
      "Enter a quantity of 1 or more."
    );
  });
});
