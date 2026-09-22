import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { Alert } from "./alert";
import { alertVariants } from "./alert-variants";

const VARIANTS = ["default", "destructive", "warning", "success"] as const;

const VARIANT_SLOTS = {
  default: {
    base: ["bg-background", "text-foreground"],
    icon: ["text-foreground"],
    button: ["bg-background", "text-foreground"],
  },
  destructive: {
    base: ["border-error", "bg-error/5", "text-error"],
    icon: ["text-error"],
    button: ["bg-error", "text-error-foreground", "hover:bg-error/90"],
  },
  warning: {
    base: ["border-warning", "bg-warning-soft", "text-warning-soft-foreground"],
    icon: ["text-warning"],
    button: ["bg-warning", "text-warning-foreground", "hover:bg-warning/90"],
  },
  success: {
    base: ["border-success", "bg-success/5", "text-foreground"],
    icon: ["text-success"],
    button: ["bg-success", "text-success-foreground", "hover:bg-success/90"],
  },
} as const;

describe("alertVariants", () => {
  it("defaults to the default variant and keeps slot bases", () => {
    const slots = alertVariants();
    expect(slots.base()).toContain("relative");
    expect(slots.base()).toContain("bg-background");
    expect(slots.base()).toContain("text-foreground");
    expect(slots.icon()).toContain("block");
    expect(slots.icon()).toContain("size-5");
    expect(slots.icon()).toContain("shrink-0");
    expect(slots.description()).toContain("text-foreground");
    expect(slots).not.toHaveProperty("content");
    expect(slots).not.toHaveProperty("title");
  });

  it("resolves every status variant onto the locked token classes", () => {
    for (const variant of VARIANTS) {
      const slots = alertVariants({ variant });
      for (const token of VARIANT_SLOTS[variant].base) {
        expect(slots.base(), `${variant} base ${token}`).toContain(token);
      }
      for (const token of VARIANT_SLOTS[variant].icon) {
        expect(slots.icon(), `${variant} icon ${token}`).toContain(token);
      }
      for (const token of VARIANT_SLOTS[variant].button) {
        expect(slots.button(), `${variant} button ${token}`).toContain(token);
      }
    }
  });

  it("carries no destructive token classes, warning-accent, raw palette, or dark classes", () => {
    const resolved = VARIANTS.flatMap((variant) => {
      const slots = alertVariants({ variant });
      return [slots.base(), slots.icon(), slots.description(), slots.button()];
    }).join(" ");
    expect(resolved).not.toContain("dark:");
    expect(resolved).not.toContain("bg-destructive");
    expect(resolved).not.toContain("text-destructive");
    expect(resolved).not.toContain("border-destructive");
    expect(resolved).not.toContain("warning-accent");
    expect(resolved).not.toContain("bg-destructive/10");
    expect(resolved).not.toMatch(RAW_PALETTE_RE);
  });

  it("lets a className merge win over a conflicting recipe class through cn", () => {
    const merged = cn(alertVariants({ variant: "destructive" }).base(), "bg-card").split(/\s+/);
    expect(merged).toContain("bg-card");
    expect(merged).not.toContain("bg-error/5");
    expect(merged).toContain("border-error");
  });
});

describe("Alert server boundary", () => {
  it("imports and renders the namespace without a use client directive", () => {
    const html = renderToStaticMarkup(
      createElement(
        Alert.Root,
        { variant: "warning" },
        createElement(Alert.Title, null, "Sync delayed"),
        createElement(Alert.Description, null, "Facility data is more than an hour old.")
      )
    );
    expect(html).toContain("Sync delayed");
    expect(html).toContain("Facility data is more than an hour old.");
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-slot="item"');
    expect(html).toContain('data-slot="item-media"');
    expect(html).toContain('data-slot="item-content"');
    expect(html).toContain('data-slot="item-title"');
    expect(html).toContain('data-slot="item-description"');
    expect(html).toContain('data-slot="alert-icon"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toMatch(/<h3[^>]*data-slot="item-title"/);
    expect(html).toMatch(/<p[^>]*data-slot="item-description"/);
    expect(html).not.toContain('data-slot="item-actions"');
    expect(html).not.toContain("bg-destructive");
    expect(html).not.toContain("warning-accent");
    expect(html).not.toMatch(RAW_PALETTE_RE);
  });

  it("renders the action button only when onAction and actionLabel are both set", () => {
    const withAction = renderToStaticMarkup(
      createElement(
        Alert.Root,
        { onAction: () => undefined, actionLabel: "Retry" },
        createElement(Alert.Title, null, "Sync delayed")
      )
    );
    expect(withAction).toContain("Retry");
    expect(withAction).toContain('data-slot="item-actions"');
    expect(withAction).toContain('type="button"');

    const withoutAction = renderToStaticMarkup(
      createElement(Alert.Root, null, createElement(Alert.Title, null, "Saved"))
    );
    expect(withoutAction).not.toContain('data-slot="item-actions"');
    expect(withoutAction).not.toContain("<button");
  });
});
