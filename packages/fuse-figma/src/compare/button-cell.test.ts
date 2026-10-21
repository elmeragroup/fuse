/**
 * The HTML the built Fuse Button renders for a cell. The unit under test is the Button
 * renderer, and the oracle is Button's public contract as its JSDoc states it: `disabled` sets
 * the native attribute, `isPending` stamps `data-pending` and `aria-busy` and keeps the button
 * focusable, an icon's `data-icon` marks its side, and an icon button takes its name from
 * `aria-label`.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { iconButton, labelButton } from "./button-cell";
import { renderCellHtml } from "./cell-renderers";

/** The attributes of the HTML's first `<button>` tag, by name. */
function buttonAttributes(html: string): ReadonlyMap<string, string> {
  const button = elementsOf(html).find((element) => element.name === "button");
  if (button === undefined) {
    throw new Error(`no <button> in ${html}`);
  }
  return button.attributes;
}

describe("the Button renderer", () => {
  it("renders a label Button at rest, enabled and not pending", () => {
    const html = renderCellHtml(labelButton, {
      variant: "default",
      size: "default",
      state: "rest",
      icon: "none",
    });
    const attributes = buttonAttributes(html);
    expect(attributes.get("data-slot")).toBe("button");
    expect(attributes.has("disabled")).toBe(false);
    expect(attributes.has("data-pending")).toBe(false);
    expect(html).toMatch(/>Button<\/button>$/);
  });

  it("sets the native disabled attribute for a disabled cell", () => {
    const attributes = buttonAttributes(
      renderCellHtml(labelButton, { variant: "ghost", size: "lg", state: "disabled", icon: "none" })
    );
    expect(attributes.has("disabled")).toBe(true);
    expect(attributes.has("data-pending")).toBe(false);
  });

  it("renders a pending cell busy and focusable, with the pending indicator", () => {
    const attributes = buttonAttributes(
      renderCellHtml(labelButton, { variant: "success", size: "xs", state: "pending", icon: "end" })
    );
    expect(attributes.has("data-pending")).toBe(true);
    expect(attributes.get("aria-busy")).toBe("true");
    expect(attributes.has("data-pending-indicator")).toBe(true);
    expect(attributes.has("disabled")).toBe(false);
  });

  it("puts a start icon marked inline-start before the label", () => {
    const html = renderCellHtml(labelButton, {
      variant: "outline",
      size: "sm",
      state: "rest",
      icon: "start",
    });
    expect(html).toMatch(/<svg\b[^>]*data-icon="inline-start"[^>]*>.*<\/svg>Button<\/button>$/);
  });

  it("puts an end icon marked inline-end after the label", () => {
    const html = renderCellHtml(labelButton, { variant: "outline", size: "sm", state: "rest", icon: "end" });
    expect(html).toMatch(/>Button<svg\b[^>]*data-icon="inline-end"[^>]*>.*<\/svg><\/button>$/);
  });

  it("names an icon button by aria-label and gives it one unmarked icon", () => {
    const html = renderCellHtml(iconButton, { variant: "secondary", size: "icon-sm", state: "rest" });
    expect(buttonAttributes(html).get("aria-label")).toBe("Button");
    expect(html.match(/<svg\b/g)).toHaveLength(1);
    expect(html).not.toMatch(/\sdata-icon="/);
  });
});
