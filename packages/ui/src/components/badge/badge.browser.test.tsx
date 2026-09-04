import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, renderThemed, stampDensity } from "../../../test/themed-browser-render";
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
    expect(badge.tagName).toBe("DIV");
    expect(badge.textContent).toBe("Active");
    expect(badge.getAttribute("data-slot")).toBe("badge");
  });

  it("stays non-interactive: no role, no tabindex, no focus ring", () => {
    renderThemed(<Badge>Active</Badge>);
    const badge = badgeNamed("Active");
    expect(badge.getAttribute("role")).toBeNull();
    expect(badge.getAttribute("tabindex")).toBeNull();
    expect(getComputedStyle(badge).boxShadow).not.toContain("inset");
  });

  it("paints the default variant from the primary role token", () => {
    renderThemed(<Badge>Active</Badge>);
    const badge = badgeNamed("Active");
    expect(getComputedStyle(badge).backgroundColor).toBe(cssVarColor(badge, "--primary"));
    expect(getComputedStyle(badge).color).toBe(cssVarColor(badge, "--primary-foreground"));
    expect(getComputedStyle(badge).display).toBe("inline-flex");
    expect(getComputedStyle(badge).borderTopWidth).toBe("1px");
  });

  it("derives the info variant's surface from the --info token via color-mix", () => {
    renderThemed(<Badge variant="info">Scheduled</Badge>);
    const badge = badgeNamed("Scheduled");
    const styles = getComputedStyle(badge);
    expect(styles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.backgroundColor).not.toBe(styles.borderTopColor);
    expect(styles.color).toBe(cssVarColor(badge, "--info-foreground"));
  });

  it("renders the destructive variant on the error token", () => {
    renderThemed(<Badge variant="destructive">Cancelled</Badge>);
    const badge = badgeNamed("Cancelled");
    expect(getComputedStyle(badge).backgroundColor).toBe(cssVarColor(badge, "--error"));
    expect(getComputedStyle(badge).color).toBe(cssVarColor(badge, "--error-foreground"));
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

  it("is density-independent: the decorative size axis is not a control rung", () => {
    renderThemed(<Badge>Active</Badge>);
    const dense = getComputedStyle(badgeNamed("Active"));
    const denseMetrics = { px: dense.paddingLeft, font: dense.fontSize };
    stampDensity("comfortable");
    const comfortable = getComputedStyle(badgeNamed("Active"));
    expect(comfortable.paddingLeft).toBe(denseMetrics.px);
    expect(comfortable.fontSize).toBe(denseMetrics.font);
  });

  it("lets a className override win over the recipe", () => {
    renderThemed(<Badge className="bg-muted">Active</Badge>);
    const badge = badgeNamed("Active");
    expect(getComputedStyle(badge).backgroundColor).toBe(cssVarColor(badge, "--muted"));
  });
});
