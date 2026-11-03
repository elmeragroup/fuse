import type { ComponentProps } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { settleTransitions } from "../../../test/assert-invalid-ring";
import { flightLazyElement } from "../../../test/flight-lazy-element";
import { cssVarColor, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Link } from "./link";

/** The parent box a link sits in. */
function parentOf(element: HTMLElement): HTMLElement {
  const parent = element.parentElement;
  if (parent === null) {
    throw new Error("expected the link to sit in a box");
  }
  return parent;
}

/** The underline thickness in px, or 0 while the link draws no underline. */
function underlinePx(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return style.textDecorationLine.includes("underline")
    ? Number.parseFloat(style.textDecorationThickness)
    : 0;
}

/** A router link stand-in that marks its anchor, as React Router's and Next's links render one. */
function RouterLink(props: ComponentProps<"a">) {
  return <a data-router-link="" {...props} />;
}

describe("Link in a sentence", () => {
  it("underlines at rest in the sentence's own colour", () => {
    renderThemed(
      <p className="text-muted-foreground">
        Read the <Link href="#terms">terms of delivery</Link> first.
      </p>
    );
    const link = roleNamed("link", "terms of delivery");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("#terms");
    expect(getComputedStyle(link).textDecorationLine).toBe("underline");
    expect(getComputedStyle(link).color).toBe(getComputedStyle(parentOf(link)).color);
  });

  it("takes the sentence's font, size, weight and line height", () => {
    renderThemed(
      <p className="text-xl/loose font-semibold font-mono">
        See <Link href="#invoice">invoice 1042</Link>.
      </p>
    );
    const link = roleNamed("link", "invoice 1042");
    const own = getComputedStyle(link);
    const sentence = getComputedStyle(parentOf(link));
    for (const property of ["fontFamily", "fontSize", "fontWeight", "lineHeight"] as const) {
      expect.soft(own[property], property).toBe(sentence[property]);
    }
  });

  it("scales the underline with the text, never under 1px", () => {
    renderThemed(
      <>
        <p style={{ fontSize: 32 }}>
          <Link href="#large">Large link</Link>
        </p>
        <p style={{ fontSize: 10 }}>
          <Link href="#small">Small link</Link>
        </p>
      </>
    );
    // 0.0625em of 32px.
    expect(underlinePx(roleNamed("link", "Large link"))).toBe(2);
    // 0.0625em of 10px is 0.625px, under the 1px floor.
    expect(underlinePx(roleNamed("link", "Small link"))).toBe(1);
  });

  it("stays inline, so a long link wraps across the sentence's lines", () => {
    renderThemed(
      <p style={{ width: 160 }}>
        Download <Link href="#statement">the settlement statement for March with every meter reading</Link>.
      </p>
    );
    const link = roleNamed("link", "the settlement statement for March with every meter reading");
    expect(getComputedStyle(link).display).toBe("inline");
    expect(link.getClientRects().length).toBeGreaterThan(1);
  });

  it("draws a marked icon one em square after the text, on the text's own line", () => {
    // 100px holds the 20px text of "Status page" but not the icon after it, where Chromium would
    // otherwise break the line before the icon.
    renderThemed(
      <p style={{ fontSize: 20, width: 100 }}>
        <Link href="https://example.com/status" target="_blank" rel="noreferrer">
          Status page
          <svg aria-hidden data-icon="inline-end" viewBox="0 0 16 16">
            <rect width="16" height="16" />
          </svg>
        </Link>
      </p>
    );
    const link = roleNamed("link", "Status page");
    const icon = link.querySelector("svg");
    const text = link.firstChild;
    if (icon === null || text === null) {
      throw new Error("expected the text and the icon");
    }
    const box = icon.getBoundingClientRect();
    expect(box.width).toBe(20);
    expect(box.height).toBe(20);
    // 0.25em of 20px between the text and the icon.
    expect(getComputedStyle(icon).marginInlineStart).toBe("5px");
    const range = document.createRange();
    range.selectNodeContents(text);
    const lines = [...range.getClientRects()];
    expect(lines).toHaveLength(1);
    const [line] = lines;
    if (line === undefined) {
      throw new Error("expected the text's line box");
    }
    expect(box.left).toBeGreaterThan(line.right);
    expect(box.top).toBeGreaterThanOrEqual(line.top);
    expect(box.bottom).toBeLessThanOrEqual(line.bottom);
  });
});

describe("Link underline", () => {
  it("thickens the resting underline under the pointer", async () => {
    renderThemed(
      <p style={{ fontSize: 16 }}>
        <Link href="#always" className="transition-none">
          Always
        </Link>
      </p>
    );
    const link = roleNamed("link", "Always");
    expect(underlinePx(link)).toBe(1);
    await userEvent.hover(link);
    settleTransitions(link);
    expect(underlinePx(link)).toBe(2);
  });

  it("underlines a hover link only under the pointer", async () => {
    renderThemed(
      <Link href="#hover" underline="hover">
        Hover
      </Link>
    );
    const link = roleNamed("link", "Hover");
    expect(getComputedStyle(link).textDecorationLine).toBe("none");
    await userEvent.hover(link);
    expect(getComputedStyle(link).textDecorationLine).toBe("underline");
  });

  it("never underlines a none link, and fades it under the pointer", async () => {
    renderThemed(
      <Link href="#none" underline="none" className="transition-none">
        None
      </Link>
    );
    const link = roleNamed("link", "None");
    expect(getComputedStyle(link).textDecorationLine).toBe("none");
    await userEvent.hover(link);
    settleTransitions(link);
    expect(getComputedStyle(link).textDecorationLine).toBe("none");
    expect(getComputedStyle(link).opacity).toBe("0.8");
  });
});

describe("Link composition", () => {
  it("merges its classes, slot and props onto a router link passed as render", () => {
    renderThemed(
      <Link render={<RouterLink href="/invoices/1042" />} variant="error">
        Invoice 1042
      </Link>
    );
    const link = roleNamed("link", "Invoice 1042");
    expect(link.hasAttribute("data-router-link")).toBe(true);
    expect(link.getAttribute("href")).toBe("/invoices/1042");
    // DOM audit: the slot, which the base-layer link reset keys on, moves onto the render element.
    expect(link.dataset.slot).toBe("link");
    expect(getComputedStyle(link).color).toBe(cssVarColor(link, "--error"));
    expect(getComputedStyle(link).textDecorationLine).toBe("underline");
  });

  it("merges a render element's own className after its classes, so the element's class wins", () => {
    renderThemed(
      <Link render={<RouterLink href="/invoices/1043" className="text-brand" />} variant="error">
        Invoice 1043
      </Link>
    );
    const link = roleNamed("link", "Invoice 1043");
    expect(getComputedStyle(link).color).toBe(cssVarColor(link, "--brand"));
    expect(getComputedStyle(link).textDecorationLine).toBe("underline");
  });

  it("merges a Server Component render element's className, which React Flight hands over lazy", () => {
    renderThemed(
      <Link render={flightLazyElement(<a href="#x" className="text-brand" />)} variant="error">
        Invoice 1044
      </Link>
    );
    const link = roleNamed("link", "Invoice 1044");
    // DOM audit: the slot, which the base-layer link reset keys on, moves onto the unwrapped element.
    expect(link.dataset.slot).toBe("link");
    expect(getComputedStyle(link).color).toBe(cssVarColor(link, "--brand"));
    expect(getComputedStyle(link).textDecorationLine).toBe("underline");
  });

  it("forwards a ref to the anchor", () => {
    let anchor: HTMLAnchorElement | null = null;
    renderThemed(
      <Link
        href="#ref"
        ref={(node) => {
          anchor = node;
        }}>
        Referenced
      </Link>
    );
    expect(anchor).toBe(roleNamed("link", "Referenced"));
  });

  it("paints the error variant with the status token, and merges a caller className last", () => {
    renderThemed(
      <>
        <Link href="#plain" variant="error">
          Invoice 1042
        </Link>
        <Link href="#overridden" variant="error" className="text-brand no-underline">
          Invoice 1043
        </Link>
      </>
    );
    const plain = roleNamed("link", "Invoice 1042");
    const overridden = roleNamed("link", "Invoice 1043");
    expect(getComputedStyle(plain).color).toBe(cssVarColor(plain, "--error"));
    expect(getComputedStyle(overridden).color).toBe(cssVarColor(overridden, "--brand"));
    expect(getComputedStyle(overridden).textDecorationLine).toBe("none");
  });

  it("paints the shared self ring on keyboard focus only, at both densities", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Link href="#focus">Invoice 1042</Link>
      </>
    );
    await expect.element(page.getByRole("link", { name: "Invoice 1042" })).toBeVisible();
    await assertFocusRingAtBothDensities(roleNamed("button", "Before"), roleNamed("link", "Invoice 1042"));
  });
});
