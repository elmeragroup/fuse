import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, px, renderThemed } from "../../../test/themed-browser-render";
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
  it("renders a span with data-slot=span and no widget role", () => {
    renderThemed(<Span>4 of 12</Span>);
    const span = spanNamed("4 of 12");
    expect(span.tagName).toBe("SPAN");
    expect(span.getAttribute("data-slot")).toBe("span");
    expect(span.textContent).toBe("4 of 12");
    expect(span.getAttribute("role")).toBeNull();
    expect(span.getAttribute("tabindex")).toBeNull();
    for (const role of WIDGET_ROLES) {
      expect(page.getByRole(role).query(), role).toBeNull();
    }
  });

  it("defaults leading to leading-snug", () => {
    renderThemed(
      <>
        <Span>Inline count</Span>
        <Span leading="relaxed">Relaxed count</Span>
      </>
    );
    expect(getComputedStyle(spanNamed("Inline count")).lineHeight).not.toBe(
      getComputedStyle(spanNamed("Relaxed count")).lineHeight
    );
  });

  it("resolves destructive onto text-error, success onto text-success, and bold onto font-medium", () => {
    renderThemed(
      <>
        <Span variant="destructive">Cancelled</Span>
        <Span variant="success">Delivered</Span>
        <Span weight="bold">Medium cap</Span>
        <Span weight="normal">Normal cap</Span>
      </>
    );
    const cancelled = spanNamed("Cancelled");
    expect(getComputedStyle(cancelled).color).toBe(cssVarColor(cancelled, "--error"));
    expect(getComputedStyle(spanNamed("Delivered")).color).toBe(
      cssVarColor(spanNamed("Delivered"), "--success")
    );
    expect(Number.parseInt(getComputedStyle(spanNamed("Medium cap")).fontWeight, 10)).toBeGreaterThan(
      Number.parseInt(getComputedStyle(spanNamed("Normal cap")).fontWeight, 10)
    );
  });

  it("cascades size=xs onto the host and descendants", () => {
    renderThemed(
      <>
        <Span size="xs">Tiny count</Span>
        <Span size="lg">Large count</Span>
      </>
    );
    expect(px(getComputedStyle(spanNamed("Tiny count")).fontSize)).toBeLessThan(
      px(getComputedStyle(spanNamed("Large count")).fontSize)
    );
  });

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

  it("renders the provided render element with merged recipe classes", () => {
    renderThemed(
      <Span variant="muted" size="sm" render={<strong />}>
        Continue as strong
      </Span>
    );
    const strong = spanNamed("Continue as strong");
    expect(strong.tagName).toBe("STRONG");
    expect(strong.getAttribute("data-slot")).toBe("span");
    expect(getComputedStyle(strong).color).toBe(cssVarColor(strong, "--muted-foreground"));
    expect(px(getComputedStyle(strong).fontSize)).toBe(14);
  });
});
