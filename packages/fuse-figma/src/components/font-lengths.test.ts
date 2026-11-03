import { describe, expect, it } from "vitest";

import { evaluateLengthInFont } from "./font-lengths";

describe("evaluateLengthInFont", () => {
  it("takes an em as the font size, inside max() and beside px", () => {
    expect(evaluateLengthInFont("0.2em", 16)).toBeCloseTo(3.2);
    expect(evaluateLengthInFont("max(1px, 0.0625em)", 10)).toBe(1);
    expect(evaluateLengthInFont("max(1px,0.0625em)", 32)).toBe(2);
    expect(evaluateLengthInFont("calc(0.5em + 2px)", 20)).toBe(12);
  });

  it("leaves rem at the 16px root and px as they are", () => {
    expect(evaluateLengthInFont("0.5rem", 40)).toBe(8);
    expect(evaluateLengthInFont("3px", 40)).toBe(3);
  });

  it("evaluates no percentage or keyword", () => {
    expect(evaluateLengthInFont("10%", 16)).toBeUndefined();
    expect(evaluateLengthInFont("auto", 16)).toBeUndefined();
  });
});
