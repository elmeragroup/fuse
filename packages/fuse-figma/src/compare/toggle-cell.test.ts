/**
 * The HTML the built Fuse Toggle renders for a cell. The unit under test is the Toggle renderer.
 * The oracle is Toggle's public contract and Base UI's documented Toggle state attributes:
 * `aria-pressed` states whether the button is pressed, `data-pressed` is present while it is
 * pressed, and `data-disabled` is present while it is disabled. A disabled Toggle is a native
 * disabled button, which leaves the tab order and so carries no `aria-disabled`.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import type { Cell } from "../components/component-spec";
import { renderCellHtml } from "./cell-renderers";
import { iconToggle, labelToggle } from "./toggle-cell";

/** The attributes of the toggle button the cell renders first. */
function toggleAttributes(html: string): ReadonlyMap<string, string> {
  const [first] = elementsOf(html);
  if (first?.name !== "button" || first.attributes.get("data-slot") !== "toggle") {
    throw new Error(`no toggle button opens ${html}`);
  }
  return first.attributes;
}

/** The `data-icon` of each icon, in document order. */
function iconMarkers(html: string): readonly (string | undefined)[] {
  return elementsOf(html)
    .filter((element) => element.name === "svg")
    .map((svg) => svg.attributes.get("data-icon"));
}

const REST: Cell = { variant: "default", size: "default", state: "rest", pressed: "off", icon: "none" };

describe("the Toggle renderer", () => {
  it("renders an unpressed, enabled Toggle at rest", () => {
    const attributes = toggleAttributes(renderCellHtml(labelToggle, REST));
    expect(attributes.get("aria-pressed")).toBe("false");
    expect(["data-pressed", "disabled", "data-disabled"].filter((name) => attributes.has(name))).toEqual([]);
  });

  it("renders a pressed cell with aria-pressed true and data-pressed", () => {
    const attributes = toggleAttributes(
      renderCellHtml(labelToggle, { ...REST, variant: "outline", pressed: "on" })
    );
    expect(attributes.get("aria-pressed")).toBe("true");
    expect(attributes.has("data-pressed")).toBe(true);
  });

  it("renders a disabled cell natively disabled, with data-disabled and no aria-disabled", () => {
    const attributes = toggleAttributes(
      renderCellHtml(labelToggle, { ...REST, size: "xs", state: "disabled" })
    );
    expect(attributes.has("disabled")).toBe(true);
    expect(attributes.has("data-disabled")).toBe(true);
    expect(attributes.has("aria-disabled")).toBe(false);
  });

  it("places a Star marked inline-start before the label, or one marked inline-end after it", () => {
    const start = renderCellHtml(labelToggle, { ...REST, icon: "start" });
    expect(iconMarkers(start)).toEqual(["inline-start"]);
    expect(start).toMatch(/<\/svg>Toggle<\/button>$/);
    const end = renderCellHtml(labelToggle, { ...REST, icon: "end" });
    expect(iconMarkers(end)).toEqual(["inline-end"]);
    expect(end).toMatch(/>Toggle<svg\b/);
  });

  it("names an icon toggle by aria-label around one Star marked inline-start", () => {
    const html = renderCellHtml(iconToggle, { variant: "outline", size: "lg", state: "rest", pressed: "on" });
    expect(toggleAttributes(html).get("aria-label")).toBe("Toggle");
    expect(iconMarkers(html)).toEqual(["inline-start"]);
  });
});
