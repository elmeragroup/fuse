import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, px, renderThemed } from "../../../test/themed-browser-render";
import { Text } from "./text";

const WIDGET_ROLES = ["button", "link", "textbox", "checkbox", "radio", "listitem", "heading"] as const;

function textNamed(name: string): HTMLElement {
  const element = page.getByText(name, { exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected an element labelled ${name}`);
  }
  return element;
}

describe("Text", () => {
  it("renders a p by default with data-slot=text and no widget role", () => {
    renderThemed(<Text>March usage is estimated.</Text>);
    const paragraph = textNamed("March usage is estimated.");
    expect(paragraph.tagName).toBe("P");
    expect(paragraph.getAttribute("data-slot")).toBe("text");
    expect(paragraph.getAttribute("role")).toBeNull();
    expect(paragraph.getAttribute("tabindex")).toBeNull();
    for (const role of WIDGET_ROLES) {
      expect(page.getByRole(role).query(), role).toBeNull();
    }
  });

  it('renders a span when elementType is "span"', () => {
    renderThemed(<Text elementType="span">Inline note</Text>);
    const span = textNamed("Inline note");
    expect(span.tagName).toBe("SPAN");
    expect(span.getAttribute("data-slot")).toBe("text");
    expect(page.getByRole("paragraph").query()).toBeNull();
  });

  it("renders the provided render element with merged recipe classes", () => {
    renderThemed(
      <Text variant="muted" size="sm" render={<span />}>
        Continue as a span
      </Text>
    );
    const span = textNamed("Continue as a span");
    expect(span.tagName).toBe("SPAN");
    expect(span.getAttribute("data-slot")).toBe("text");
    expect(getComputedStyle(span).color).toBe(cssVarColor(span, "--muted-foreground"));
    expect(px(getComputedStyle(span).fontSize)).toBe(14);
  });

  it("resolves destructive onto text-error and success onto text-success", () => {
    renderThemed(
      <>
        <Text variant="destructive">Cancelled</Text>
        <Text variant="success">Delivered</Text>
      </>
    );
    const cancelled = textNamed("Cancelled");
    expect(getComputedStyle(cancelled).color).toBe(cssVarColor(cancelled, "--error"));
    expect(getComputedStyle(textNamed("Delivered")).color).toBe(
      cssVarColor(textNamed("Delivered"), "--success")
    );
  });

  it("lets a className override win over the recipe", () => {
    renderThemed(<Text className="text-muted-foreground">Override</Text>);
    const element = textNamed("Override");
    expect(getComputedStyle(element).color).toBe(cssVarColor(element, "--muted-foreground"));
  });
});
