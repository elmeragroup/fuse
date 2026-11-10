import type { ComponentProps } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { flightLazyElement } from "../../../test/flight-lazy-element";
import { cssVarColor, px, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Link } from "./link";

/** The underline thickness in px, or 0 while the link draws no underline. */
function underlinePx(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return style.textDecorationLine.includes("underline") ? px(style.textDecorationThickness) : 0;
}

/** A router link stand-in that marks its anchor, as React Router's and Next's links render one. */
function RouterLink(props: ComponentProps<"a">) {
  return <a data-router-link="" {...props} />;
}

describe("Link in a sentence", () => {
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
});

describe("Link underline", () => {
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
