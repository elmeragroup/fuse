import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, renderThemed } from "../../../test/themed-browser-render";
import { Item } from "../item";
import { Badge } from "./badge";

function badgeNamed(label: string): HTMLElement {
  const element = page.getByText(label, { exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected a badge labelled ${label}`);
  }
  return element;
}

describe("Badge", () => {
  it("renders its children and emits data-slot=badge", async () => {
    renderThemed(<Badge>Active</Badge>);
    await expect.element(page.getByText("Active")).toBeInTheDocument();
    const badge = badgeNamed("Active");
    expect(badge.tagName).toBe("SPAN");
    expect(badge.textContent).toBe("Active");
    expect(badge.getAttribute("data-slot")).toBe("badge");
    expect(getComputedStyle(badge).display).toBe("inline-flex");
    expect(getComputedStyle(badge).borderTopWidth).toBe("1px");
  });

  // Oracle: the HTML parser. Phrasing content stays inside a `<p>`; a block-level `<div>` start
  // tag closes the paragraph and lands after it, so server HTML would not match the tree React
  // rendered. Item.Description renders a `<p>`.
  it("parses inside Item.Description's paragraph from server HTML", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(
      <Item.Description>
        Due <Badge>soon</Badge>
      </Item.Description>
    );
    // DOM audit: the parsed fragment is never mounted, and the parser's tree is the unit under
    // test, so the paragraph and the badge are located by their slots.
    const paragraph = host.querySelector('[data-slot="item-description"]');
    expect(paragraph?.tagName).toBe("P");
    expect(paragraph?.querySelector('[data-slot="badge"]')?.textContent).toBe("soon");
    expect(host.children).toHaveLength(1);
  });

  it("stays non-interactive: no role, no tabindex, no focus ring", () => {
    renderThemed(<Badge>Active</Badge>);
    const badge = badgeNamed("Active");
    expect(badge.getAttribute("role")).toBeNull();
    expect(badge.getAttribute("tabindex")).toBeNull();
    expect(getComputedStyle(badge).boxShadow).not.toContain("inset");
  });

  it.each([
    ["default", undefined, "--primary", "--primary-foreground"],
    ["destructive", "destructive", "--error", "--error-foreground"],
    ["info", "info", "--info", "--info-foreground"],
  ] as const)("paints the %s variant from its role tokens", (_label, variant, background, foreground) => {
    renderThemed(<Badge variant={variant}>Active</Badge>);
    const badge = badgeNamed("Active");
    expect(getComputedStyle(badge).backgroundColor).toBe(cssVarColor(badge, background));
    expect(getComputedStyle(badge).color).toBe(cssVarColor(badge, foreground));
  });

  it.each([
    ["outline-destructive", "--error"],
    ["outline-success", "--success"],
    ["outline-warning", "--warning"],
    ["outline-info", "--info"],
  ] as const)("draws the %s variant's border and text in its status role, with no fill", (variant, role) => {
    renderThemed(<Badge variant={variant}>Scheduled</Badge>);
    const badge = badgeNamed("Scheduled");
    const styles = getComputedStyle(badge);
    expect(styles.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(styles.borderTopColor).toBe(cssVarColor(badge, role));
    expect(styles.color).toBe(cssVarColor(badge, role));
  });

  it("scales padding and type across the three decorative sizes", () => {
    renderThemed(
      <>
        <Badge size="sm">Small</Badge>
        <Badge size="default">Default</Badge>
        <Badge size="lg">Large</Badge>
      </>
    );
    const [small, medium, large] = ["Small", "Default", "Large"].map((label) =>
      getComputedStyle(badgeNamed(label))
    );
    if (!small || !medium || !large) {
      throw new Error("expected three badges");
    }
    expect(Number.parseFloat(small.paddingLeft)).toBeLessThan(Number.parseFloat(medium.paddingLeft));
    expect(Number.parseFloat(medium.paddingLeft)).toBeLessThan(Number.parseFloat(large.paddingLeft));
    expect(Number.parseFloat(small.fontSize)).toBe(Number.parseFloat(medium.fontSize));
    expect(Number.parseFloat(large.fontSize)).toBeGreaterThan(Number.parseFloat(medium.fontSize));
  });
});
