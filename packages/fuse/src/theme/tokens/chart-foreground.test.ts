import { describe, expect, it } from "vitest";

import { composeTheme } from "../compose-theme";
import { chartForegrounds } from "./chart-foreground";
import type { ChartForegroundName } from "./chart-foreground";
import { LAYER_DEFAULTS } from "./defaults";
import { PRIMITIVES, WHITE } from "./primitives";

const NEUTRAL_950 = PRIMITIVES["neutral-950"];

const NAMES = [
  "chart-1-foreground",
  "chart-2-foreground",
  "chart-3-foreground",
  "chart-4-foreground",
  "chart-5-foreground",
  "chart-6-foreground",
  "chart-7-foreground",
  "chart-8-foreground",
  "chart-other-foreground",
] as const satisfies readonly ChartForegroundName[];

/** The foreground the defaults compose for `chart-1` when it takes `fill`. */
function onFirstSlot(fill: string): string {
  return chartForegrounds({ ...LAYER_DEFAULTS, "chart-1": fill })["chart-1-foreground"];
}

// Unit under test: the on-color pick. Oracle: WCAG 2.2 ratios worked out by hand from each
// fill's relative luminance, quoted beside each case as white and then neutral 950 on the fill.
// For a grey at OKLCH lightness L the luminance is L cubed, and neutral 950's is 0.0041.
describe("chart foreground roles", () => {
  it("pick whichever of white and neutral 950 contrasts more with the fill", () => {
    // 1.00 and 19.41.
    expect(onFirstSlot("oklch(1 0 0)")).toBe(NEUTRAL_950);
    // 21.00 and 1.08.
    expect(onFirstSlot("oklch(0 0 0)")).toBe(WHITE);
    // A grey at 0.56, 4.65 and 4.17, and one at 0.58, 4.28 and 4.53, either side of the gap.
    expect(onFirstSlot("oklch(0.56 0 0)")).toBe(WHITE);
    expect(onFirstSlot("oklch(0.58 0 0)")).toBe(NEUTRAL_950);
  });

  it("accept a fill on which white reaches exactly 4.5:1", () => {
    // White on luminance Y measures 1.05 / (Y + 0.05), which is 4.5 at Y = 0.18333…, the cube of
    // 0.568085640286245. Neutral 950 measures 0.2333 / 0.0541, 4.31, so white is the pick.
    expect(onFirstSlot("oklch(0.568085640286245 0 0)")).toBe(WHITE);
  });

  it("refuse a fill on which neither reaches 4.5:1, a defect in the palette", () => {
    // A grey at 0.57 measures 4.46 under white and 4.35 under neutral 950.
    expect(() => onFirstSlot("oklch(0.57 0 0)")).toThrow(/4\.5:1 on the chart mark oklch\(0\.57 0 0\)/);
  });

  // The slot picks below come from each slot's two ratios, computed by an OKLCH to sRGB
  // conversion written apart from this package.
  it("compose each slot's pick in light, from the light slot literals", () => {
    const light = composeTheme({ variant: "internal", brand: "fkas", segment: "private" });
    expect(NAMES.map((name) => light[name])).toEqual([
      WHITE,
      NEUTRAL_950,
      NEUTRAL_950,
      WHITE,
      WHITE,
      WHITE,
      NEUTRAL_950,
      WHITE,
      NEUTRAL_950,
    ]);
  });

  it("compose each slot's pick again in dark, from the dark slot literals", () => {
    const dark = composeTheme({ variant: "external", brand: "guen", segment: "private" }, "dark");
    expect(NAMES.map((name) => dark[name])).toEqual([
      NEUTRAL_950,
      NEUTRAL_950,
      NEUTRAL_950,
      NEUTRAL_950,
      NEUTRAL_950,
      NEUTRAL_950,
      WHITE,
      WHITE,
      NEUTRAL_950,
    ]);
  });
});
