import { describe, expect, it } from "vitest";

import { cn } from "../../styles/cn";
import {
  menuGroupLabelClass,
  menuItemClass,
  menuItemIndicatorClass,
  menuSeparatorClass,
  overlayLayer,
  overlayPopupDurationClass,
  overlayPopupEdgeClass,
  overlayPopupFillClass,
  overlayPopupMotionClass,
  overlayPopupSurfaceClass,
  overlayPositionerClass,
  overlaySheetWidthClasses,
  overlaySizeClasses,
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

  it("is exactly its fill and edge parts plus the radius rung", () => {
    expect(tokens(overlayPopupSurfaceClass)).toEqual(
      new Set([...tokens(overlayPopupFillClass), ...tokens(overlayPopupEdgeClass), "rounded-md"])
    );
  });

  it("yields the radius rung to a consumer that overrides it", () => {
    expect(tokens(cn(overlayPopupSurfaceClass, "rounded-lg"))).not.toContain("rounded-md");
    expect(tokens(cn(overlayPopupSurfaceClass, "rounded-lg"))).toContain("rounded-lg");
  });

  it("yields the elevation rung to a consumer that overrides it", () => {
    const merged = tokens(cn(overlayPopupSurfaceClass, "shadow-lg"));
    expect(merged).not.toContain("shadow-md");
    expect(merged).toContain("shadow-lg");
  });

  it("yields the fill to a consumer that overrides both halves of it", () => {
    const merged = tokens(cn(overlayPopupSurfaceClass, "bg-foreground text-background"));
    expect(merged).not.toContain("bg-popover");
    expect(merged).not.toContain("text-popover-foreground");
    expect(merged).toContain("bg-foreground");
    expect(merged).toContain("text-background");
  });

  it("does NOT let a consumer subtract the ring — the reason Tooltip composes the parts", () => {
    const merged = tokens(cn(overlayPopupSurfaceClass, "ring-0"));
    expect(merged).not.toContain("ring-1");
    expect(merged).toContain("ring-0");
    expect(merged).toContain("ring-foreground/10");
  });

  it("lets Tooltip build its own surface from the fill and edge parts instead", () => {
    expect(tokens(cn(overlayPopupFillClass, "bg-foreground text-background", "rounded-md"))).toEqual(
      new Set(["bg-foreground", "text-background", "rounded-md"])
    );
  });
});

describe("overlayPopupMotionClass", () => {
  it("carries the transform origin and the open/closed pair", () => {
    for (const token of [
      "origin-(--transform-origin)",
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

  it("leaves the timing rung out, so an untimed family composes the set alone", () => {
    expect(tokens(overlayPopupMotionClass)).not.toContain("duration-100");
    expect(overlayPopupDurationClass).toBe("duration-100");
    expect(tokens(cn(overlayPopupMotionClass, overlayPopupDurationClass))).toContain("duration-100");
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

describe("overlaySheetWidthClasses", () => {
  /**
   * The guard `satisfies Record<OverlaySize, string>` cannot give: it pins the keys of
   * the two width tables, not their values. Sheet's rungs restate the cap because
   * Tailwind only emits a utility whose candidate appears literally in source, so this
   * derives the expected spelling from the `max-width` table and fails on any drift.
   */
  it("caps every rung at exactly the value overlaySizeClasses caps it at", () => {
    const asCustomProperty = Object.fromEntries(
      Object.entries(overlaySizeClasses).map(([rung, utility]) => {
        const cap = /^max-w-\[(?<cap>.+)\]$/u.exec(utility)?.groups?.cap;
        if (cap === undefined) {
          throw new Error(`overlaySizeClasses.${rung} is not an arbitrary max-width: ${utility}`);
        }
        return [rung, `[--sheet-width:${cap}]`];
      })
    );

    expect(overlaySheetWidthClasses).toEqual(asCustomProperty);
  });

  it("covers the whole axis and nothing else", () => {
    expect(Object.keys(overlaySheetWidthClasses)).toEqual(Object.keys(overlaySizeClasses));
  });
});
