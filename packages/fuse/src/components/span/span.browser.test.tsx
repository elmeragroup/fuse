import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, fkasExternal, px, renderThemed } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { Span } from "./span";

const WIDGET_ROLES = ["button", "link", "textbox", "checkbox", "radio", "listitem", "heading"] as const;

function spanNamed(name: string): HTMLElement {
  const element = page.getByText(name, { exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected an element labelled ${name}`);
  }
  return element;
}

describe("Span", () => {
  it("adds truncate and lets a className override win over the recipe", () => {
    renderThemed(
      <>
        <Span truncate>very-long-inline-value</Span>
        <Span className="text-muted-foreground">Override</Span>
      </>
    );
    const truncated = spanNamed("very-long-inline-value");
    expect(getComputedStyle(truncated).overflow).toBe("hidden");
    expect(getComputedStyle(truncated).textOverflow).toBe("ellipsis");
    const override = spanNamed("Override");
    expect(getComputedStyle(override).color).toBe(cssVarColor(override, "--muted-foreground"));
  });

  it("renders a span with data-slot=span and no widget role, or the render element with merged recipe classes", () => {
    renderThemed(
      <>
        <Span>4 of 12</Span>
        <Span variant="muted" size="sm" render={<strong />}>
          Continue as strong
        </Span>
      </>
    );
    const span = spanNamed("4 of 12");
    expect(span.tagName).toBe("SPAN");
    expect(span.getAttribute("data-slot")).toBe("span");
    expect(span.getAttribute("role")).toBeNull();
    expect(span.getAttribute("tabindex")).toBeNull();
    for (const role of WIDGET_ROLES) {
      expect(page.getByRole(role).query(), role).toBeNull();
    }
    const strong = spanNamed("Continue as strong");
    expect(strong.tagName).toBe("STRONG");
    expect(strong.getAttribute("data-slot")).toBe("span");
    expect(getComputedStyle(strong).color).toBe(cssVarColor(strong, "--muted-foreground"));
    expect(px(getComputedStyle(strong).fontSize)).toBe(14);
  });

  it("gives an inline child the Span's snug line height and size", () => {
    renderThemed(
      <Span>
        Total <strong>42</strong>
      </Span>
    );
    // Span defaults to snug at 16px: 16 × 1.375 = 22, not text-base's own 24.
    expect(px(getComputedStyle(spanNamed("Total 42")).lineHeight)).toBe(22);
    const child = spanNamed("42");
    expect(px(getComputedStyle(child).lineHeight)).toBe(22);
    expect(px(getComputedStyle(child).fontSize)).toBe(16);
  });

  it("stays snug in an external theme instead of taking the paragraph role", () => {
    renderThemed(
      <ThemeScope theme={fkasExternal}>
        <Span size="sm">Small external</Span>
        <Span>Default external</Span>
        <Span size="lg">Large external</Span>
      </ThemeScope>
    );
    // snug 1.375 × 14, 16 and 18px, not the external 20, 22 and 24.
    expect(px(getComputedStyle(spanNamed("Small external")).lineHeight)).toBe(19.25);
    expect(px(getComputedStyle(spanNamed("Default external")).lineHeight)).toBe(22);
    expect(px(getComputedStyle(spanNamed("Large external")).lineHeight)).toBe(24.75);
  });
});
