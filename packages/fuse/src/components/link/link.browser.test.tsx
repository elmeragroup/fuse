import type { ComponentProps } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { flightLazyElement } from "../../../test/flight-lazy-element";
import {
  computedContrast,
  cssVarColor,
  effectiveOpacity,
  px,
  renderThemed,
  roleNamed,
} from "../../../test/themed-browser-render";
import { Link } from "./link";
import type { LinkProps } from "./link";

/** The underline thickness in px, or 0 while the link draws no underline. */
function underlinePx(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return style.textDecorationLine.includes("underline") ? px(style.textDecorationThickness) : 0;
}

type LinkVariant = NonNullable<LinkProps["variant"]>;

/** Every Link color variant, keyed by itself so a variant added to the recipe fails the type check here. */
const LINK_VARIANTS = {
  default: "default",
  foreground: "foreground",
  primary: "primary",
  brand: "brand",
  muted: "muted",
  error: "error",
} as const satisfies { readonly [V in LinkVariant]: V };

/** The contrast of a link's text on the page's `--background`. */
function pageContrast(link: HTMLElement): number {
  return computedContrast(getComputedStyle(link).color, cssVarColor(link, "--background"));
}

/** The computed styles that tell a hovered `none` link from a resting one. */
function drawnLook(link: HTMLElement) {
  const style = getComputedStyle(link);
  return {
    color: style.color,
    opacity: style.opacity,
    textDecorationLine: style.textDecorationLine,
  };
}

/** A router link stand-in that marks its anchor, as React Router's and Next's links render one. */
function RouterLink(props: ComponentProps<"a">) {
  // oxlint-disable-next-line jsx-a11y/anchor-has-content -- the anchor's content is the `children` this wrapper forwards in `props`
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

  it.each(Object.values(LINK_VARIANTS))(
    "draws the %s variant with no underline at full opacity and 4.5:1, and the same on hover",
    async (variant) => {
      // An 80% fade on hover would take neutral Fjordkraft light text under the floor:
      // `--muted-foreground` reads 4.98:1 on the page and `--brand-ink` 4.66:1.
      renderThemed(
        <div className="bg-background text-foreground">
          <Link href={`#${variant}`} variant={variant} underline="none">
            Account
          </Link>
        </div>
      );
      const link = roleNamed("link", "Account");
      expect(effectiveOpacity(link)).toBe(1);
      expect(getComputedStyle(link).textDecorationLine).toBe("none");
      expect(pageContrast(link)).toBeGreaterThanOrEqual(4.5);
      const rest = drawnLook(link);
      await userEvent.hover(link);
      await Promise.all(link.getAnimations().map((animation) => animation.finished));
      expect(drawnLook(link)).toEqual(rest);
    }
  );
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
    // The slot, which the base-layer link reset keys on, moves onto the render element.
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
      // oxlint-disable-next-line jsx-a11y/anchor-has-content -- Link renders its own children inside this element once it unwraps the Flight element
      <Link render={flightLazyElement(<a href="#x" className="text-brand" />)} variant="error">
        Invoice 1044
      </Link>
    );
    const link = roleNamed("link", "Invoice 1044");
    // The slot, which the base-layer link reset keys on, moves onto the unwrapped element.
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
