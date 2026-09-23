import { describe, expect, it } from "vitest";

import { isLightCanvas } from "./html";

describe("isLightCanvas", () => {
  it("accepts the near-white canvases Chromium computes, in each notation it serializes", () => {
    for (const color of ["lab(100 0 0)", "rgb(255, 255, 255)", "oklch(1 0 0)", " oklch(1 0 0) "]) {
      expect(isLightCanvas(color), color).toBe(true);
    }
  });

  it("draws the line at CIE L* 99, the threshold by definition", () => {
    expect(isLightCanvas("lab(99 0 0)")).toBe(true);
    expect(isLightCanvas("lab(98.9 0 0)")).toBe(false);
  });

  it("refuses a dark canvas and a mid gray", () => {
    expect(isLightCanvas("oklch(0.145 0 0)")).toBe(false);
    expect(isLightCanvas("rgb(128, 128, 128)")).toBe(false);
  });

  it("refuses a translucent white, which shows whatever lies beneath it", () => {
    expect(isLightCanvas("rgba(255, 255, 255, 0.5)")).toBe(false);
  });

  it("refuses text that is not a color the parser reads", () => {
    for (const color of ["", "white", "transparent", "not a color", "oklch(1 0)"]) {
      expect(isLightCanvas(color), color).toBe(false);
    }
  });
});
