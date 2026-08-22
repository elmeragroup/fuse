import type { CSSProperties } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed, stampDensity } from "../../../test/themed-browser-render";
import { Badge } from "./badge";

function badgeElement(): HTMLElement {
  const element = document.querySelector('[data-slot="badge"]');
  if (!(element instanceof HTMLElement)) {
    throw new Error('expected an element with data-slot="badge"');
  }
  return element;
}

describe("Badge", () => {
  it("renders its children and emits data-slot=badge", async () => {
    renderThemed(<Badge>Active</Badge>);
    await expect.element(page.getByText("Active")).toBeInTheDocument();
    const badge = badgeElement();
    expect(badge.tagName).toBe("DIV");
    expect(badge.textContent).toBe("Active");
  });

  it("stays non-interactive: no role, no tabindex, no focus ring", () => {
    renderThemed(<Badge>Active</Badge>);
    const badge = badgeElement();
    expect(badge.getAttribute("role")).toBeNull();
    expect(badge.getAttribute("tabindex")).toBeNull();
    expect(badge.className).not.toContain("focus:");
    expect(badge.className).not.toContain("focus-visible:");
    expect(getComputedStyle(badge).boxShadow).not.toContain("inset");
  });

  it("paints the default variant from role tokens, never a raw palette or dark class", () => {
    renderThemed(<Badge>Active</Badge>);
    const badge = badgeElement();
    expect(badge.className).not.toContain("dark:");
    expect(badge.className.split(/\s+/)).toContain("bg-primary");
    expect(badge.className.split(/\s+/)).toContain("text-primary-foreground");
    expect(badge.className).not.toMatch(/\b(?:bg|text|border)-(?:white|black|gray|zinc|slate|neutral)\b/);
    // Radius derives from the brand `--radius` scale, never a literal (badge.md §5).
    expect(badge.className.split(/\s+/)).toContain("rounded-lg");
    expect(getComputedStyle(badge).display).toBe("inline-flex");
    expect(getComputedStyle(badge).borderTopWidth).toBe("1px");
  });

  it("derives the info variant's surface from the --info token via the sanctioned color-mix", () => {
    // The browser suite loads styles.css only, so the token is supplied locally to prove the
    // color-mix actually resolves against `--info` (badge.md §4/§8.3).
    // SAFETY: React's CSSProperties does not model custom properties; the value is a plain string.
    const infoToken = { "--info": "oklch(0.6 0.15 250)" } as CSSProperties;
    renderThemed(
      <Badge variant="info" style={infoToken}>
        Scheduled
      </Badge>
    );
    const badge = badgeElement();
    expect(badge.className).toContain("bg-[color-mix(in_oklch,var(--info)_8%,transparent)]");
    expect(badge.className).toContain("border-[color-mix(in_oklch,var(--info)_16%,transparent)]");
    expect(badge.className.split(/\s+/)).toContain("text-info-foreground");
    const styles = getComputedStyle(badge);
    expect(styles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.backgroundColor).not.toBe(styles.borderTopColor);
  });

  it("renders the destructive variant on the error token, never a destructive class", () => {
    renderThemed(<Badge variant="destructive">Cancelled</Badge>);
    const badge = badgeElement();
    expect(badge.className).not.toContain("destructive");
    expect(badge.className.split(/\s+/)).toContain("bg-error");
    expect(badge.className.split(/\s+/)).toContain("text-error-foreground");
    expect(badge.className.split(/\s+/)).toContain("border-transparent");
  });

  it("scales padding and type across the three decorative sizes", () => {
    renderThemed(
      <>
        <Badge size="sm">Small</Badge>
        <Badge size="default">Default</Badge>
        <Badge size="lg">Large</Badge>
      </>
    );
    const [small, medium, large] = ["Small", "Default", "Large"].map((label) => {
      const element = page.getByText(label).element();
      if (!(element instanceof HTMLElement)) {
        throw new Error(`expected a badge labelled ${label}`);
      }
      return getComputedStyle(element);
    });
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
    const dense = getComputedStyle(badgeElement());
    const denseMetrics = { px: dense.paddingLeft, font: dense.fontSize };
    stampDensity("comfortable");
    const comfortable = getComputedStyle(badgeElement());
    expect(comfortable.paddingLeft).toBe(denseMetrics.px);
    expect(comfortable.fontSize).toBe(denseMetrics.font);
  });

  it("lets a className override win over the recipe", () => {
    renderThemed(<Badge className="bg-muted">Active</Badge>);
    const badge = badgeElement();
    expect(badge.className.split(/\s+/)).toContain("bg-muted");
    expect(badge.className.split(/\s+/)).not.toContain("bg-primary");
  });
});
