import { describe, expect, it } from "vitest";

import { cssFirstFontFamily, cssLengthToPx, cssVarReference, remToPx } from "./css-values";

describe("cssVarReference", () => {
  it.each([
    ["var(--primary)", "primary"],
    ["var(--brand-fkas)", "brand-fkas"],
    // Fallbacks, surrounding text and literals are not a single reference.
    ["var(--primary, red)", undefined],
    [" var(--primary)", undefined],
    ["oklch(1 0 0)", undefined],
  ])("reads %j as %j", (value, expected) => {
    expect(cssVarReference(value)).toBe(expected);
  });
});

describe("cssLengthToPx", () => {
  it.each([
    ["6px", 6],
    ["-2px", -2],
    // rem at the 16px root.
    ["0.375rem", 6],
    ["1.8125rem", 29],
    // Other units and bare numbers are rejected.
    ["2em", undefined],
    ["1.5", undefined],
  ])("reads %j as %j", (value, expected) => {
    expect(cssLengthToPx(value)).toBe(expected);
  });
});

describe("remToPx", () => {
  it("reads rem at the 16px root", () => {
    expect(remToPx("2.25rem")).toBe(36);
    expect(remToPx("0.625rem")).toBe(10);
    expect(remToPx("3rem")).toBe(48);
  });
});

describe("cssFirstFontFamily", () => {
  it.each([
    ['"Neo Sans", Roboto, sans-serif', "Neo Sans"],
    ["'Inter'", "Inter"],
    ["Roboto, sans-serif", "Roboto"],
    // A stack that does not start with a named family is rejected.
    ["", undefined],
    ["var(--font-sans), serif", undefined],
  ])("reads %j as %j", (value, expected) => {
    expect(cssFirstFontFamily(value)).toBe(expected);
  });
});
