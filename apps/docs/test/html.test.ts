import { describe, expect, it } from "vitest";

import { canvasScheme } from "./html";

describe("canvasScheme", () => {
  it("classifies the near-white canvases Chromium computes as light, in each notation it serializes", () => {
    for (const color of ["lab(100 0 0)", "rgb(255, 255, 255)", "oklch(1 0 0)", " oklch(1 0 0) "]) {
      expect(canvasScheme(color), color).toBe("light");
    }
  });

  it("draws the light line at CIE L* 99, the threshold by definition", () => {
    expect(canvasScheme("lab(99 0 0)")).toBe("light");
    expect(canvasScheme("lab(98.9 0 0)")).toBeUndefined();
  });

  it("classifies the dark canvases the themes paint as dark, in each notation Chromium serializes", () => {
    for (const color of [
      "oklch(0.145 0 0)",
      "oklch(0.2029294 0.0334602 267.7195)",
      "rgb(10, 10, 10)",
      "lab(0 0 0)",
      " lab(10 0 0) ",
    ]) {
      expect(canvasScheme(color), color).toBe("dark");
    }
  });

  it("draws the dark line at CIE L* 20, the threshold by definition", () => {
    expect(canvasScheme("lab(19.9 0 0)")).toBe("dark");
    expect(canvasScheme("lab(20.1 0 0)")).toBeUndefined();
  });

  it("classifies a mid gray as neither", () => {
    expect(canvasScheme("rgb(128, 128, 128)")).toBeUndefined();
  });

  it("classifies a transparent or translucent canvas, which is what a missing stylesheet computes, as neither", () => {
    expect(canvasScheme("rgba(0, 0, 0, 0)")).toBeUndefined();
    expect(canvasScheme("rgba(0, 0, 0, 0.5)")).toBeUndefined();
    expect(canvasScheme("rgba(255, 255, 255, 0.5)")).toBeUndefined();
  });

  it("classifies text that is not a color the parser reads as neither", () => {
    for (const color of [
      "",
      "black",
      "white",
      "transparent",
      "not a color",
      "color(srgb 0 0 0)",
      "oklch(0.1 0)",
    ]) {
      expect(canvasScheme(color), color).toBeUndefined();
    }
  });
});
