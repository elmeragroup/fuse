import { describe, expect, it } from "vitest";

import { cn } from "../../styles/cn";
import {
  overlayPopupMotionClass,
  overlayPopupSurfaceClass,
  overlayPositionerClass,
  overlayResizingPopupClass,
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
        "[--surface:--theme(--color-popover)]",
        "[--surface-muted-foreground:--theme(--color-muted-foreground)]",
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
        "[--surface:--theme(--color-popover)]",
        "[--surface-muted-foreground:--theme(--color-muted-foreground)]",
        "text-popover-foreground",
        "shadow-md",
        "ring-1",
        "ring-foreground/10",
        "rounded-md",
        "transition-opacity",
        "ease-[ease]",
        "data-starting-style:opacity-0",
        "data-ending-style:opacity-0",
        "motion-safe:data-starting-style:scale-95",
        "motion-safe:data-ending-style:scale-95",
        "origin-(--transform-origin)",
        "motion-safe:transition-[opacity,scale,translate]",
        "motion-safe:data-starting-style:data-[side=bottom]:-translate-y-2",
        "motion-safe:data-starting-style:data-[side=top]:translate-y-2",
        "motion-safe:data-starting-style:data-[side=left]:translate-x-2",
        "motion-safe:data-starting-style:data-[side=right]:-translate-x-2",
        "motion-safe:data-starting-style:data-[side=inline-start]:translate-x-2",
        "motion-safe:data-starting-style:data-[side=inline-end]:-translate-x-2",
        "duration-100",
      ])
    );
  });
});

describe("overlayResizingPopupClass", () => {
  /** The properties each `motion-safe:transition-[…]` token in a class list names. */
  function motionSafeLists(value: string): string[][] {
    return [...tokens(value)]
      .map((token) => /^motion-safe:transition-\[(.+)\]$/u.exec(token)?.[1])
      .filter((list) => list !== undefined)
      .map((list) => list.split(","));
  }

  // Unit under test: the resizing composite's transition list. Oracle: the anchored popups' list in
  // overlayPopupMotionClass, which the composite restates literally and must extend by the size.
  it("carries the anchored popups' transition list with height and width added, as its one list", () => {
    const [anchored] = motionSafeLists(overlayPopupMotionClass);
    expect(motionSafeLists(overlayResizingPopupClass)).toEqual([[...(anchored ?? []), "height", "width"]]);
  });
});
