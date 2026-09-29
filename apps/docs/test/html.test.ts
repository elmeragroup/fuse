import { describe, expect, it } from "vitest";

import { canvasScheme } from "./html";

type CanvasCase = readonly [reason: string, colors: readonly string[], scheme: "light" | "dark" | undefined];

const CASES: readonly CanvasCase[] = [
  [
    "the near-white canvases Chromium computes, in each notation it serializes",
    ["lab(100 0 0)", "rgb(255, 255, 255)", "oklch(1 0 0)", " oklch(1 0 0) "],
    "light",
  ],
  ["the light line at CIE L* 99, the threshold by definition", ["lab(99 0 0)"], "light"],
  ["just under the light line", ["lab(98.9 0 0)"], undefined],
  [
    "the dark canvases the themes paint, in each notation Chromium serializes",
    [
      "oklch(0.145 0 0)",
      "oklch(0.2029294 0.0334602 267.7195)",
      "rgb(10, 10, 10)",
      "lab(0 0 0)",
      " lab(10 0 0) ",
    ],
    "dark",
  ],
  ["the dark line at CIE L* 20, the threshold by definition", ["lab(19.9 0 0)"], "dark"],
  ["just over the dark line", ["lab(20.1 0 0)"], undefined],
  ["a mid gray", ["rgb(128, 128, 128)"], undefined],
  [
    "a transparent or translucent canvas, which is what a missing stylesheet computes",
    ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.5)", "rgba(255, 255, 255, 0.5)"],
    undefined,
  ],
  [
    "text that is not a color the parser reads",
    ["", "black", "white", "transparent", "not a color", "color(srgb 0 0 0)", "oklch(0.1 0)"],
    undefined,
  ],
];

describe("canvasScheme", () => {
  it.each(CASES)("classifies %s as %s", (_reason, colors, scheme) => {
    for (const color of colors) {
      expect(canvasScheme(color), color).toBe(scheme);
    }
  });
});
