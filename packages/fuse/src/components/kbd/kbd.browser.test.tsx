import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { render } from "../../../test/browser-render";
import { fkasPrivate } from "../../../test/theme-fixtures";
import { cssVarColor, px, renderThemed, stampDensity, textNamed } from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { ThemeScope } from "../../theme/theme-scope";
import { InputGroup } from "../input-group";
import { Kbd, KbdGroup } from "./kbd";

afterEach(() => {
  document.documentElement.removeAttribute("data-density");
});

function radius(element: HTMLElement): number {
  return px(getComputedStyle(element).borderTopLeftRadius);
}

function slotAround(element: HTMLElement, slot: string): HTMLElement {
  // DOM audit: a key combination has no role, so its outer `kbd` is found by the slot it writes.
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

  it("keeps one 20px cap with 12px text at both densities", () => {
    for (const density of DENSITIES) {
      stampDensity(density);
      const { unmount } = renderThemed(<Kbd>{`K ${density}`}</Kbd>);
      const style = getComputedStyle(textNamed(`K ${density}`));
      expect(px(style.height), density).toBe(20);
      expect(px(style.fontSize), density).toBe(12);
      unmount();
    }
  });

  it("paints the cap with the muted role pair", () => {
    renderThemed(<Kbd>Enter</Kbd>);
    const cap = textNamed("Enter");
    expect(getComputedStyle(cap).backgroundColor).toBe(cssVarColor(cap, "--muted"));
    expect(getComputedStyle(cap).color).toBe(cssVarColor(cap, "--muted-foreground"));
  });

  it("rounds a free group's caps with the group's rung, and an addon's group and caps with its inner corner", () => {
    // Internal at a 16px --radius: every rung is 16px, and the addon publishes the field corner
    // less its 1px border and its 5.6px padding beside a kbd, 9.4px.
    stampDensity("dense");
    render(
      <ThemeScope theme={fkasPrivate} style={{ "--radius": "1rem" }}>
        <KbdGroup>
          <Kbd>Free</Kbd>
        </KbdGroup>
        <InputGroup.Root>
          <InputGroup.Input aria-label="Search" />
          <InputGroup.Addon align="inline-end">
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </InputGroup.Addon>
        </InputGroup.Root>
      </ThemeScope>
    );
    expect(radius(textNamed("Free"))).toBe(16);
    expect(radius(slotAround(textNamed("Ctrl"), "kbd-group"))).toBeCloseTo(9.4, 1);
    expect(radius(textNamed("Ctrl"))).toBeCloseTo(9.4, 1);
    expect(radius(textNamed("K"))).toBeCloseTo(9.4, 1);
  });
});
