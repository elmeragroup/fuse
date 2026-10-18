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
      { role: "dialog", foreground: "dialog-foreground", grade: "text" },
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

  it("pairs each categorical slot and Other with the text a direct label on it takes", () => {
    expect(ROLE_TILES.charts).toEqual([
      { role: "chart-1", foreground: "chart-1-foreground", grade: "text" },
      { role: "chart-2", foreground: "chart-2-foreground", grade: "text" },
      { role: "chart-3", foreground: "chart-3-foreground", grade: "text" },
      { role: "chart-4", foreground: "chart-4-foreground", grade: "text" },
      { role: "chart-5", foreground: "chart-5-foreground", grade: "text" },
      { role: "chart-6", foreground: "chart-6-foreground", grade: "text" },
      { role: "chart-7", foreground: "chart-7-foreground", grade: "text" },
      { role: "chart-8", foreground: "chart-8-foreground", grade: "text" },
      { role: "chart-other", foreground: "chart-other-foreground", grade: "text" },
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
  it.each([
    ["passes a text-grade pair at exactly 4.5:1", "text", 4.5, { state: "pass", label: "AA 4.50:1" }],
    ["fails a text-grade pair just under 4.5:1", "text", 4.49, { state: "fail", label: "Fail 4.49:1" }],
    [
      "never fails a decorative pair, however low its ratio",
      "decorative",
      1,
      { state: "decorative", label: "Decorative 1.00:1" },
    ],
    [
      "asks for a backdrop when the surface is translucent",
      "text",
      "translucent",
      { state: "translucent", label: "Needs an opaque backdrop" },
    ],
  ] as const)("%s", (_case, grade, contrast, mark) => {
    expect(pairMark(grade, contrast)).toEqual(mark);
  });
});

describe("niceCeiling", () => {
  // Up to 1, 2 or 5 times a power of ten; a value on the scale stays; zero gets a unit axis.
  it.each([
    [87, 100],
    [42, 50],
    [120, 200],
    [3.2, 5],
    [0.07, 0.1],
    [50, 50],
    [1, 1],
    [0, 1],
  ])("rounds %s up to %s", (value, ceiling) => {
    expect(niceCeiling(value)).toBe(ceiling);
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
  it.each([
    ["writes size over leading in whole px", "14px", "20px", "14 / 20 px"],
    ["keeps up to two decimals and drops trailing zeros", "15.5px", "22.125px", "15.5 / 22.13 px"],
    ["shows a dash for a value it cannot read", "16px", "normal", "16 / – px"],
    ["shows a dash for a length in another unit", "1rem", "24px", "– / 24 px"],
  ])("%s", (_case, fontSize, lineHeight, text) => {
    expect(formatTypePair(fontSize, lineHeight)).toBe(text);
  });
});
