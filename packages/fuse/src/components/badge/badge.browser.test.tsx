import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, renderThemed, stampDensity } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { LEGAL_THEMES, themeSlug } from "../../theme/tokens/themes";
import { Heading } from "../heading/heading";
import { Span } from "../span/span";
import { Text } from "../text/text";
import { Badge } from "./badge";

const BADGE_VARIANTS = [
  "default",
  "secondary",
  "destructive",
  "success",
  "warning",
  "info",
  "outline",
  "outline-secondary",
  "outline-destructive",
  "outline-success",
  "outline-warning",
  "muted",
  "accent",
  "card",
] as const;

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

  it("keeps every variant's paint while the pointer hovers it", async () => {
    // Badge is a non-interactive <div>, so hover must not suggest an affordance.
    // `transition-none` makes a hover rule, if one existed, apply at once.
    renderThemed(
      <>
        {BADGE_VARIANTS.map((variant) => (
          <Badge key={variant} variant={variant} className="transition-none">
            {`${variant} sample`}
          </Badge>
        ))}
      </>
    );

    for (const variant of BADGE_VARIANTS) {
      const badge = badgeNamed(`${variant} sample`);
      const paint = (): readonly string[] => {
        const style = getComputedStyle(badge);
        return [style.backgroundColor, style.borderTopColor, style.color];
      };
      const atRest = paint();
      await userEvent.hover(badge);
      expect(paint(), variant).toEqual(atRest);
      await userEvent.unhover(badge);
    }
  });

  it("lets a className override win over the recipe", () => {
    renderThemed(<Badge className="bg-muted">Active</Badge>);
    const badge = badgeNamed("Active");
    expect(getComputedStyle(badge).backgroundColor).toBe(cssVarColor(badge, "--muted"));
  });
});

describe("badge and secondary typography contrast", () => {
  it("uses readable rendered pairs in every theme and color scheme", () => {
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
        const context = `${themeSlug(theme)} ${scheme}`;
        // This suite owns which rendered role each variant paints; the theme contrast matrix
        // owns the floors those roles must meet, so no ratio is recomputed here.
        for (const [label, foreground] of [
          ["Info sample", "info-soft-foreground"],
          ["Muted sample", "foreground"],
          ["Outline sample", "foreground"],
        ] as const) {
          const badge = badgeNamed(label);
          expect(getComputedStyle(badge).color, context).toBe(cssVarColor(badge, `--${foreground}`));
        }
        for (const label of [
          "Secondary heading",
          "Secondary text",
          "Secondary span",
          "Small secondary text",
          "Small secondary span",
        ]) {
          const copy = badgeNamed(label);
          // `secondary` typography is a deprecated identity alias of `foreground`:
          // `--secondary` is a surface token, and `muted-foreground` fails 4.5:1 at `xs`
          // in several themes, so the alias stays until a major removes it.
          expect(getComputedStyle(copy).color, context).toBe(cssVarColor(copy, "--foreground"));
        }
      }
    }
  }, 30_000);
});
