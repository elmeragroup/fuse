import { describe, expect, it } from "vitest";

import { cssColorToSrgb, cssFirstFontFamily, cssLengthToPx, cssVarReference } from "./css-values";

describe("cssVarReference", () => {
  it("names the custom property of a single var() reference", () => {
    expect(cssVarReference("var(--primary)")).toBe("primary");
    expect(cssVarReference("var(--brand-fkas)")).toBe("brand-fkas");
  });

  it("rejects fallbacks, surrounding text and literals", () => {
    expect(cssVarReference("var(--primary, red)")).toBeUndefined();
    expect(cssVarReference(" var(--primary)")).toBeUndefined();
    expect(cssVarReference("oklch(1 0 0)")).toBeUndefined();
  });
});

describe("cssColorToSrgb", () => {
  it("reads a six-digit hex color as opaque sRGB in either case", () => {
    expect(cssColorToSrgb("#5c6773")).toEqual({ r: 92 / 255, g: 103 / 255, b: 115 / 255, alpha: 1 });
    expect(cssColorToSrgb("#FF0000")).toEqual({ r: 1, g: 0, b: 0, alpha: 1 });
  });

  it("reads an oklch() color with its alpha", () => {
    const white = cssColorToSrgb("oklch(1 0 0 / 40%)");
    expect(white?.r).toBeCloseTo(1, 5);
    expect(white?.g).toBeCloseTo(1, 5);
    expect(white?.b).toBeCloseTo(1, 5);
    expect(white?.alpha).toBe(0.4);
  });

  it("rejects malformed and unsupported colors instead of throwing", () => {
    expect(cssColorToSrgb("oklch(0.5 0.1)")).toBeUndefined();
    expect(cssColorToSrgb("#fff")).toBeUndefined();
    expect(cssColorToSrgb("red")).toBeUndefined();
  });
});

describe("cssLengthToPx", () => {
  it("reads px as is and rem at the 16px root", () => {
    expect(cssLengthToPx("6px")).toBe(6);
    expect(cssLengthToPx("-2px")).toBe(-2);
    expect(cssLengthToPx("0.375rem")).toBe(6);
    expect(cssLengthToPx("1.8125rem")).toBe(29);
  });

  it("rejects other units and bare numbers", () => {
    expect(cssLengthToPx("2em")).toBeUndefined();
    expect(cssLengthToPx("1.5")).toBeUndefined();
  });
});

describe("cssFirstFontFamily", () => {
  it("returns the first family of a stack without its quotes", () => {
    expect(cssFirstFontFamily('"Neo Sans", Roboto, sans-serif')).toBe("Neo Sans");
    expect(cssFirstFontFamily("'Inter'")).toBe("Inter");
    expect(cssFirstFontFamily("Roboto, sans-serif")).toBe("Roboto");
  });

  it("rejects a stack that does not start with a named family", () => {
    expect(cssFirstFontFamily("")).toBeUndefined();
    expect(cssFirstFontFamily("var(--font-sans), serif")).toBeUndefined();
  });
});
