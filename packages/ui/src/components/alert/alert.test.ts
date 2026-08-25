import { createElement } from "react";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { Alert } from "./alert";
import { alertVariants } from "./alert-variants";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "alert.tsx"), "utf8");
const variantsSource = readFileSync(join(here, "alert-variants.ts"), "utf8");
const facade = readFileSync(join(here, "..", "..", "alert.ts"), "utf8");

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
    expect(alertVariants().base()).toBe(alertVariants({ variant: "default" }).base());
    const slots = alertVariants();
    expect(slots.base()).toContain("relative");
    expect(slots.icon()).toContain("block");
    expect(slots.icon()).toContain("size-5");
    expect(slots.icon()).toContain("shrink-0");
    expect(slots.description()).toContain("text-foreground");
    expect(slots.content()).toBeFalsy();
    expect(slots.title()).toBeFalsy();
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
      return [
        slots.base(),
        slots.icon(),
        slots.content(),
        slots.title(),
        slots.description(),
        slots.button(),
      ];
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

describe("alert source contract", () => {
  it("stays a server namespace over Item and Button with a private recipe", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(false);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).not.toContain("react-aria");
    expect(source).not.toContain('from "../react-aria');
    expect(source).not.toContain("lucide");
    expect(source).not.toContain("AlertTriangle");
    expect(source).not.toContain("OctagonX");
    expect(source).toContain('from "../item/item"');
    expect(source).toContain('from "../button/button"');
    expect(source).toContain("Item.Root");
    expect(source).toContain("Item.Media");
    expect(source).toContain("Item.Content");
    expect(source).toContain("Item.Actions");
    expect(source).toContain('role="alert"');
    expect(source).toContain('variant="outline"');
    expect(source).toContain('size="sm"');
    expect(source).toContain('type="button"');
    expect(source).toContain("Info");
    expect(source).toContain("Warning");
    expect(source).toContain("WarningOctagon");
    expect(source).toContain("CheckCircle");
    expect(source).toContain('displayName = "Alert.Root"');
    expect(source).toContain('displayName = "Alert.Icon"');
    expect(source).toContain('displayName = "Alert.Title"');
    expect(source).toContain('displayName = "Alert.Description"');
    expect(source).toContain('data-slot="item-title"');
    expect(source).toContain('data-slot="alert-icon"');
    expect(source).toContain('aria-hidden="true"');
    expect(facade).not.toContain('"use client"');
    expect(facade).toContain('export { Alert } from "./components/alert/alert"');
    expect(facade).not.toContain("alertVariants");
    expect(facade).not.toContain("AlertIcon");
    expect(facade).not.toContain("AlertTitle");
    expect(facade).not.toContain("AlertDescription");
    expect(variantsSource).toContain('variant: "default"');
    expect(variantsSource).not.toContain("dark:");
    expect(variantsSource).not.toContain("warning-accent");
    expect(variantsSource).not.toContain("bg-destructive");
    expect(variantsSource).not.toContain("bg-destructive/10");
    expect(variantsSource).not.toMatch(RAW_PALETTE_RE);
  });
});

describe("Alert server boundary", () => {
  it("imports and renders the namespace without a use client directive", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(false);
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
});
