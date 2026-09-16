import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, renderThemed, stampDensity } from "../../../test/themed-browser-render";
import { composeTheme } from "../../theme/compose-theme";
import { contrastRatio } from "../../theme/contrast";
import { ThemeScope } from "../../theme/theme-scope";
import { LEGAL_THEMES, themeSlug } from "../../theme/tokens/themes";
import { Heading } from "../heading/heading";
import { Span } from "../span/span";
import { Text } from "../text/text";
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

  it("pairs the info variant's soft surface and foreground", () => {
    renderThemed(<Badge variant="info">Scheduled</Badge>);
    const badge = badgeNamed("Scheduled");
    const styles = getComputedStyle(badge);
    expect(styles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.backgroundColor).not.toBe(styles.borderTopColor);
    expect(styles.color).toBe(cssVarColor(badge, "--info-soft-foreground"));
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

describe("badge and secondary typography contrast", () => {
  it("uses readable rendered pairs in every theme and color scheme, including badge hover", async () => {
    const { rerender } = renderThemed(null);
    for (const scheme of ["light", "dark"] as const) {
      for (const theme of LEGAL_THEMES) {
        rerender(
          <div data-theme={scheme}>
            <ThemeScope theme={theme} className="bg-background">
              <Badge variant="info" className="transition-none">
                Info sample
              </Badge>
              <Badge variant="outline-secondary" className="transition-none">
                Outline sample
              </Badge>
              <Badge variant="muted" className="transition-none">
                Muted sample
              </Badge>
              <Heading variant="secondary">Secondary heading</Heading>
              <Text variant="secondary">Secondary text</Text>
              <Span variant="secondary">Secondary span</Span>
              <Text variant="secondary" size="xs">
                Small secondary text
              </Text>
              <Span variant="secondary" size="xs">
                Small secondary span
              </Span>
            </ThemeScope>
          </div>
        );
        const tokens = composeTheme(theme, scheme);
        const context = `${themeSlug(theme)} ${scheme}`;
        for (const [label, foreground, background] of [
          ["Info sample", "info-soft-foreground", "info-soft"],
          ["Muted sample", "foreground", "muted"],
          ["Outline sample", "foreground", "background"],
        ] as const) {
          const badge = badgeNamed(label);
          expect(getComputedStyle(badge).color, context).toBe(cssVarColor(badge, `--${foreground}`));
          expect(contrastRatio(tokens[foreground], tokens[background]), context).toBeGreaterThanOrEqual(4.5);
        }
        const outline = badgeNamed("Outline sample");
        await userEvent.hover(outline);
        await vi.waitFor(() =>
          expect(getComputedStyle(outline).color).toBe(cssVarColor(outline, "--secondary-foreground"))
        );
        expect(
          contrastRatio(tokens["secondary-foreground"], tokens.secondary),
          context
        ).toBeGreaterThanOrEqual(4.5);
        await userEvent.unhover(outline);
        for (const label of [
          "Secondary heading",
          "Secondary text",
          "Secondary span",
          "Small secondary text",
          "Small secondary span",
        ]) {
          const copy = badgeNamed(label);
          expect(getComputedStyle(copy).color, context).toBe(cssVarColor(copy, "--foreground"));
          expect(contrastRatio(tokens.foreground, tokens.background), context).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  }, 30_000);
});
