import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, renderThemed, textNamed } from "../../../test/themed-browser-render";
import { Kbd, KbdGroup } from "./kbd";

afterEach(() => {
  document.documentElement.removeAttribute("data-density");
});

function slotAround(element: HTMLElement, slot: string): HTMLElement {
  // DOM audit: a key combination has no role, so this helper finds its outer `kbd` by the slot
  // that KbdGroup writes.
  const found = element.closest(`[data-slot="${slot}"]`);
  if (!(found instanceof HTMLElement)) {
    throw new Error(`expected a ${slot} around the element`);
  }
  return found;
}

describe("Kbd", () => {
  it("renders one key as a kbd element that screen readers read", async () => {
    renderThemed(<Kbd>Esc</Kbd>);
    await expect.element(page.getByText("Esc", { exact: true })).toBeVisible();
    const cap = textNamed("Esc");
    expect(cap.tagName).toBe("KBD");
    expect(cap.getAttribute("data-slot")).toBe("kbd");
    expect(cap.getAttribute("aria-hidden")).toBeNull();
  });

  it("nests the caps of a combination in an outer kbd", () => {
    renderThemed(
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    );
    const group = slotAround(textNamed("Ctrl"), "kbd-group");
    expect(group.tagName).toBe("KBD");
    expect([...group.children].map((cap) => [cap.tagName, cap.textContent])).toEqual([
      ["KBD", "Ctrl"],
      ["KBD", "K"],
    ]);
  });

  it("paints the cap with the muted role pair", () => {
    renderThemed(<Kbd>Enter</Kbd>);
    const cap = textNamed("Enter");
    expect(getComputedStyle(cap).backgroundColor).toBe(cssVarColor(cap, "--muted"));
    expect(getComputedStyle(cap).color).toBe(cssVarColor(cap, "--muted-foreground"));
  });
});
