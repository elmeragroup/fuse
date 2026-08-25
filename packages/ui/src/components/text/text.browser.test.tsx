import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
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
    const paragraph = document.querySelector("p");
    expect(paragraph).not.toBeNull();
    expect(paragraph?.tagName).toBe("P");
    expect(paragraph?.getAttribute("data-slot")).toBe("text");
    expect(paragraph?.textContent).toBe("March usage is estimated.");
    expect(paragraph?.getAttribute("role")).toBeNull();
    expect(paragraph?.getAttribute("tabindex")).toBeNull();
    for (const role of WIDGET_ROLES) {
      expect(page.getByRole(role).query(), role).toBeNull();
    }
  });

  it('renders a span when elementType is "span"', () => {
    renderThemed(<Text elementType="span">Inline note</Text>);
    const span = textNamed("Inline note");
    expect(span.tagName).toBe("SPAN");
    expect(span.getAttribute("data-slot")).toBe("text");
    expect(document.querySelector("p")).toBeNull();
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
    expect(span.className.split(/\s+/)).toContain("font-sans");
    expect(span.className.split(/\s+/)).toContain("text-muted-foreground");
    expect(span.className.split(/\s+/)).toContain("text-sm");
  });

  it("resolves destructive onto text-error and success onto text-success", () => {
    renderThemed(
      <>
        <Text variant="destructive">Cancelled</Text>
        <Text variant="success">Delivered</Text>
      </>
    );
    const cancelled = textNamed("Cancelled");
    expect(cancelled.className.split(/\s+/)).toContain("text-error");
    expect(cancelled.className).not.toContain("destructive");
    expect(textNamed("Delivered").className.split(/\s+/)).toContain("text-success");
  });

  it("lets a className override win over the recipe", () => {
    renderThemed(<Text className="text-muted-foreground">Override</Text>);
    const element = textNamed("Override");
    expect(element.className.split(/\s+/)).toContain("text-muted-foreground");
    expect(element.className.split(/\s+/)).not.toContain("text-inherit");
  });
});
