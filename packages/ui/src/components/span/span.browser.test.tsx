import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
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
    renderThemed(<Span>Inline count</Span>);
    const classes = spanNamed("Inline count").className.split(/\s+/);
    expect(classes).toContain("leading-snug");
    expect(classes).not.toContain("leading-relaxed");
  });

  it("resolves destructive onto text-error, success onto text-success, and bold onto font-medium", () => {
    renderThemed(
      <>
        <Span variant="destructive">Cancelled</Span>
        <Span variant="success">Delivered</Span>
        <Span weight="bold">Medium cap</Span>
      </>
    );
    const cancelled = spanNamed("Cancelled");
    expect(cancelled.className.split(/\s+/)).toContain("text-error");
    expect(cancelled.className).not.toContain("destructive");
    expect(spanNamed("Delivered").className.split(/\s+/)).toContain("text-success");
    expect(spanNamed("Medium cap").className.split(/\s+/)).toContain("font-medium");
    expect(spanNamed("Medium cap").className).not.toContain("font-bold");
  });

  it("cascades size=xs onto the host and descendants", () => {
    renderThemed(<Span size="xs">Tiny count</Span>);
    const classes = spanNamed("Tiny count").className.split(/\s+/);
    expect(classes).toContain("text-xs");
    expect(classes).toContain("*:text-xs");
    expect(classes).toContain("**:text-xs");
  });

  it("adds truncate and lets a className override win over the recipe", () => {
    renderThemed(
      <>
        <Span truncate>very-long-inline-value</Span>
        <Span className="text-muted-foreground">Override</Span>
      </>
    );
    expect(spanNamed("very-long-inline-value").className.split(/\s+/)).toContain("truncate");
    const override = spanNamed("Override");
    expect(override.className.split(/\s+/)).toContain("text-muted-foreground");
    expect(override.className.split(/\s+/)).not.toContain("text-inherit");
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
    expect(strong.className.split(/\s+/)).toContain("font-sans");
    expect(strong.className.split(/\s+/)).toContain("text-muted-foreground");
    expect(strong.className.split(/\s+/)).toContain("text-sm");
    expect(strong.className.split(/\s+/)).toContain("leading-snug");
  });
});
