import { describe, expect, it } from "vitest";

import { cn } from "../../styles/cn";
import {
  overlayPopupMotionClass,
  overlayPopupSurfaceClass,
  overlayPositionerClass,
  overlayTimedPopupClass,
} from "./overlay-classes";

function tokens(value: string): Set<string> {
  return new Set(value.split(/\s+/u).filter(Boolean));
}

describe("overlayPositionerClass", () => {
  it("is one stacking context plus the single shared overlay layer", () => {
    expect(tokens(overlayPositionerClass)).toEqual(new Set(["isolate", "z-50"]));
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

  it.each([
    ["radius rung", "rounded-lg", ["rounded-md"], ["rounded-lg"]],
    ["elevation rung", "shadow-lg", ["shadow-md"], ["shadow-lg"]],
    [
      "fill, both halves of it",
      "bg-foreground text-background",
      ["bg-popover", "text-popover-foreground"],
      ["bg-foreground", "text-background"],
    ],
  ])("yields the %s to a consumer that overrides it", (_rung, override, yielded, kept) => {
    const merged = tokens(cn(overlayPopupSurfaceClass, override));
    for (const token of yielded) {
      expect(merged).not.toContain(token);
    }
    for (const token of kept) {
      expect(merged).toContain(token);
    }
  });

  it("does NOT let a consumer subtract the ring — the reason Tooltip composes the parts", () => {
    const merged = tokens(cn(overlayPopupSurfaceClass, "ring-0"));
    expect(merged).not.toContain("ring-1");
    expect(merged).toContain("ring-0");
    expect(merged).toContain("ring-foreground/10");
  });
});

describe("overlayPopupMotionClass", () => {
  it("leaves the timing rung out, so an untimed family composes the set alone", () => {
    expect(tokens(overlayPopupMotionClass)).not.toContain("duration-100");
  });
});

describe("overlayTimedPopupClass", () => {
  it("is the surface, motion, and duration parts", () => {
    expect(tokens(overlayTimedPopupClass)).toEqual(
      new Set([
        "bg-popover",
        "text-popover-foreground",
        "shadow-md",
        "ring-1",
        "ring-foreground/10",
        "rounded-md",
        "origin-(--transform-origin)",
        "data-[side=bottom]:slide-in-from-top-2",
        "data-[side=top]:slide-in-from-bottom-2",
        "data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2",
        "data-[side=inline-start]:slide-in-from-right-2",
        "data-[side=inline-end]:slide-in-from-left-2",
        "data-open:animate-in",
        "data-open:fade-in-0",
        "data-open:zoom-in-95",
        "data-closed:animate-out",
        "data-closed:fade-out-0",
        "data-closed:zoom-out-95",
        "duration-100",
      ])
    );
  });
});
