/**
 * The HTML the built Fuse ConfirmButton renders for a cell. The unit under test is the Confirm
 * button renderer, and the oracle is ConfirmButton's public contract as its JSDoc states it: it
 * renders a Button with its resting label, it marks that Button `data-armed="true"` while armed,
 * keeping the resting label when no `armedChildren` is given and adding no announcement when no
 * armed label or `aria-label` is given, and turning `disabled` on disarms it.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { confirmButton } from "./confirm-button-cell";

/** The attributes of the HTML's first `<button>` tag, by name. */
function buttonAttributes(html: string): ReadonlyMap<string, string> {
  const button = elementsOf(html).find((element) => element.name === "button");
  if (button === undefined) {
    throw new Error(`no <button> in ${html}`);
  }
  return button.attributes;
}

describe("the Confirm button renderer", () => {
  it("renders a disarmed ConfirmButton as an enabled Button that holds only its label", () => {
    const html = renderCellHtml(confirmButton, {
      variant: "destructive",
      size: "default",
      state: "rest",
      armed: "off",
    });
    const attributes = buttonAttributes(html);
    expect(attributes.get("data-slot")).toBe("button");
    expect(attributes.has("data-armed")).toBe(false);
    expect(attributes.has("disabled")).toBe(false);
    expect(html).toMatch(/^<button\b[^>]*>Delete<\/button>$/);
  });

  it("arms a cell by marking the Button data-armed and changing nothing else", () => {
    const cell = { variant: "success", size: "sm", state: "rest" };
    const restingHtml = renderCellHtml(confirmButton, { ...cell, armed: "off" });
    const armedHtml = renderCellHtml(confirmButton, { ...cell, armed: "on" });
    const armed = buttonAttributes(armedHtml);
    expect(armed.get("data-armed")).toBe("true");
    expect(new Map([...armed].filter(([name]) => name !== "data-armed"))).toEqual(
      buttonAttributes(restingHtml)
    );
    expect(armedHtml).toMatch(/^<button\b[^>]*>Delete<\/button>$/);
  });

  it("renders an armed disabled cell disarmed, with the native disabled attribute", () => {
    const attributes = buttonAttributes(
      renderCellHtml(confirmButton, { variant: "destructive", size: "lg", state: "disabled", armed: "on" })
    );
    expect(attributes.has("disabled")).toBe(true);
    expect(attributes.has("data-armed")).toBe(false);
  });
});
