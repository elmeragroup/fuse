import { describe, expect, it } from "vitest";

import { chartTicks, niceCeiling, shareOf } from "../../src/studio/lib/chart-layout";
import { ROLE_TILES, pairMark } from "../../src/studio/lib/color-roles";
import { formatTypePair } from "../../src/studio/lib/type-metrics";

// Every expected value below is written out by hand from CONTEXT.md ("Role token", "Soft form",
// "Text-grade role") and the contract's token list, never computed with the module under test.

describe("ROLE_TILES", () => {
  it("pairs each surface role with its foreground and soft form, feature as decorative", () => {
    expect(ROLE_TILES.surfaces).toEqual([
      { role: "background", foreground: "foreground", grade: "text" },
      {
        role: "card",
        foreground: "card-foreground",
        grade: "text",
        soft: { role: "card-soft", foreground: "card-soft-foreground", grade: "text" },
      },
      { role: "popover", foreground: "popover-foreground", grade: "text" },
      { role: "muted", foreground: "muted-foreground", grade: "text" },
      { role: "accent", foreground: "accent-foreground", grade: "text" },
      { role: "feature", foreground: "feature-foreground", grade: "decorative" },
      { role: "right-panel", foreground: "right-panel-foreground", grade: "text" },
    ]);
  });

  it("pairs each action role, soft forms beside primary and secondary", () => {
    expect(ROLE_TILES.actions).toEqual([
      {
        role: "primary",
        foreground: "primary-foreground",
        grade: "text",
        soft: { role: "primary-soft", foreground: "primary-soft-foreground", grade: "text" },
      },
      {
        role: "secondary",
        foreground: "secondary-foreground",
        grade: "text",
        soft: { role: "secondary-soft", foreground: "secondary-soft-foreground", grade: "text" },
      },
      { role: "brand", foreground: "brand-foreground", grade: "text" },
      { role: "destructive", foreground: "destructive-foreground", grade: "text" },
    ]);
  });

  it("pairs the four status roles with their soft forms", () => {
    expect(ROLE_TILES.status.map(({ role, soft }) => [role, soft?.role])).toEqual([
      ["error", "error-soft"],
      ["info", "info-soft"],
      ["success", "success-soft"],
      ["warning", "warning-soft"],
    ]);
  });
});

describe("pairMark", () => {
  it("passes a text-grade pair at exactly 4.5:1", () => {
    expect(pairMark("text", 4.5)).toEqual({ state: "pass", label: "AA 4.50:1" });
  });

  it("fails a text-grade pair just under 4.5:1", () => {
    expect(pairMark("text", 4.49)).toEqual({ state: "fail", label: "Fail 4.49:1" });
  });

  it("never fails a decorative pair, however low its ratio", () => {
    expect(pairMark("decorative", 1)).toEqual({ state: "decorative", label: "Decorative 1.00:1" });
  });

  it("asks for a backdrop when the surface is translucent", () => {
    expect(pairMark("text", "translucent")).toEqual({
      state: "translucent",
      label: "Needs an opaque backdrop",
    });
  });
});

describe("niceCeiling", () => {
  it("rounds up to 1, 2 or 5 times a power of ten", () => {
    expect(niceCeiling(87)).toBe(100);
    expect(niceCeiling(42)).toBe(50);
    expect(niceCeiling(120)).toBe(200);
    expect(niceCeiling(3.2)).toBe(5);
    expect(niceCeiling(0.07)).toBe(0.1);
  });

  it("keeps a value already on the scale", () => {
    expect(niceCeiling(50)).toBe(50);
    expect(niceCeiling(1)).toBe(1);
  });

  it("gives an empty or zero series a unit axis", () => {
    expect(niceCeiling(0)).toBe(1);
  });
});

describe("chartTicks", () => {
  it("spaces the ticks evenly from 0 to the ceiling", () => {
    expect(chartTicks(100, 4)).toEqual([0, 25, 50, 75, 100]);
    expect(chartTicks(5, 5)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("shareOf", () => {
  it("is the value's percentage of the ceiling", () => {
    expect(shareOf(30, 50)).toBe(60);
    expect(shareOf(0, 50)).toBe(0);
    expect(shareOf(50, 50)).toBe(100);
  });
});

describe("formatTypePair", () => {
  it("writes size over leading in whole px", () => {
    expect(formatTypePair("14px", "20px")).toBe("14 / 20 px");
  });

  it("keeps up to two decimals and drops trailing zeros", () => {
    expect(formatTypePair("15.5px", "22.125px")).toBe("15.5 / 22.13 px");
  });

  it("shows a dash for a value it cannot read", () => {
    expect(formatTypePair("16px", "normal")).toBe("16 / – px");
  });

  it("shows a dash for a length in another unit", () => {
    expect(formatTypePair("1rem", "24px")).toBe("– / 24 px");
  });
});
