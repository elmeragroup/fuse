import { describe, expect, it } from "vitest";

import { cn } from "../../styles/cn";
import {
  menuGroupLabelClass,
  menuItemClass,
  menuItemIndicatorClass,
  menuSeparatorClass,
  overlayLayer,
  overlayPopupMotionClass,
  overlayPopupSurfaceClass,
  overlayPositionerClass,
} from "./overlay-classes";

function tokens(value: string): Set<string> {
  return new Set(value.split(/\s+/u).filter(Boolean));
}

describe("overlayPositionerClass", () => {
  it("is one stacking context plus the single shared overlay layer", () => {
    expect(overlayPositionerClass).toBe(`isolate ${overlayLayer}`);
    expect(tokens(overlayPositionerClass)).toEqual(new Set(["isolate", "z-50"]));
  });

  it("lets a site-specific extra ride along without a second layer", () => {
    expect(tokens(cn(overlayPositionerClass, "pointer-events-none"))).toEqual(
      new Set(["isolate", "z-50", "pointer-events-none"])
    );
  });
});

describe("overlayPopupSurfaceClass", () => {
  it("paints the popup from tokens only, at the md elevation and radius rung", () => {
    expect(tokens(overlayPopupSurfaceClass)).toEqual(
      new Set([
        "shadow-md",
        "rounded-md",
        "bg-popover",
        "text-popover-foreground",
        "ring-1",
        "ring-foreground/10",
      ])
    );
  });

  it("yields the radius rung to a consumer that overrides it", () => {
    expect(tokens(cn(overlayPopupSurfaceClass, "rounded-lg"))).not.toContain("rounded-md");
    expect(tokens(cn(overlayPopupSurfaceClass, "rounded-lg"))).toContain("rounded-lg");
  });
});

describe("overlayPopupMotionClass", () => {
  it("carries the transform origin, the 100ms rung, and the open/closed pair", () => {
    for (const token of [
      "origin-(--transform-origin)",
      "duration-100",
      "data-open:animate-in",
      "data-open:fade-in-0",
      "data-open:zoom-in-95",
      "data-closed:animate-out",
      "data-closed:fade-out-0",
      "data-closed:zoom-out-95",
    ]) {
      expect(tokens(overlayPopupMotionClass)).toContain(token);
    }
  });

  it("slides in from the opposite edge on all six placements base-ui emits", () => {
    const sides = ["bottom", "top", "left", "right", "inline-start", "inline-end"];
    for (const side of sides) {
      expect(overlayPopupMotionClass).toContain(`data-[side=${side}]:slide-in-from-`);
    }
    expect(overlayPopupMotionClass.match(/slide-in-from-/gu)).toHaveLength(sides.length);
  });

  it("paints no surface of its own, so a popup picks its own fill", () => {
    for (const token of tokens(overlayPopupMotionClass)) {
      expect(token).not.toMatch(/^(?:bg-|text-|ring-|shadow-|rounded-)/u);
    }
  });
});

describe("menu part classes", () => {
  it("leaves the highlight face to the family, which base-ui spells two ways", () => {
    expect(menuItemClass).not.toContain("focus:");
    expect(menuItemClass).not.toContain("data-highlighted:");
  });

  it("owns the disabled face and the icon sizing every menu family shares", () => {
    for (const token of [
      "data-disabled:pointer-events-none",
      "data-disabled:opacity-50",
      "[&_svg]:shrink-0",
      "[&_svg:not([class*='size-'])]:size-4",
    ]) {
      expect(tokens(menuItemClass)).toContain(token);
    }
  });

  it("positions the indicator, rule, and group label from tokens only", () => {
    expect(tokens(menuItemIndicatorClass)).toContain("absolute");
    expect(tokens(menuItemIndicatorClass)).toContain("right-2");
    expect(tokens(menuSeparatorClass)).toContain("bg-border");
    expect(tokens(menuSeparatorClass)).toContain("h-px");
    expect(tokens(menuGroupLabelClass)).toContain("text-muted-foreground");
  });
});
