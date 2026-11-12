/**
 * Unit under test: Sparkline's CSS-only hover and its entrance, in chart.css, over the markup the
 * hook-free component writes. Oracles: the image's own box, worked by hand. Three values own a
 * third of its width each, centred at a sixth, a half and five sixths; [2, 6, 4] spans [2, 6], so 6
 * sits at the top edge and 4 halfway down. The hover dim is the chart's 0.45.
 */
import { afterEach, describe, expect, it } from "vitest";
import { commands, page } from "vitest/browser";

import "../../../dist/styles.css";
import { hoverIn, imageNamed, placeIn, rows, shownIn } from "../../../test/chart/sparkline";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { renderThemed } from "../../../test/themed-browser-render";
import "./chart.css";
import { Sparkline } from "./sparkline";
import type { SparklineProps } from "./sparkline";

const NAME = "Spot price";

const image = () => imageNamed(`${NAME}. Lowest 2, highest 6.`);

/** One part of the image. The marks are presentational content of the img, so slots locate them. */
function part(selector: string): SVGGraphicsElement {
  const element = image().querySelector(selector);
  if (!(element instanceof SVGGraphicsElement)) throw new Error(`expected ${selector}`);
  return element;
}

const shown = (selector: string) => shownIn(image(), selector);
const placeOf = (element: Element) => placeIn(image(), element);
const hoverAt = (x: number) => hoverIn(image(), x);

function renderSparkline(variant: SparklineProps["variant"], intro?: "none"): void {
  renderThemed(
    <div style={{ width: 300 }}>
      <Sparkline
        aria-label={NAME}
        data={[2, 6, 4]}
        locale="en-US"
        curve="linear"
        variant={variant}
        data-intro={intro}
      />
    </div>
  );
}

const opacity = (selector: string) => Number(getComputedStyle(part(selector)).opacity);

afterEach(async () => {
  await commands.parkPointer();
  await emulateReducedMotion("no-preference");
});

describe("Sparkline", () => {
  it("shows the crosshair and dot at the hovered value and fades the rest of the line, with no script", async () => {
    renderSparkline("line");
    const crosshair = '[data-slot="sparkline-crosshair"]';
    const dot = '[data-slot="sparkline-dot"][data-part="hover"]';
    const line = '[data-slot="sparkline-path"]:not([data-part])';
    expect(() => shown(dot)).toThrow();

    await hoverAt(1 / 2);
    // The marks fade in, so each poll waits for one set to show at its place.
    await expect.poll(() => placeOf(shown(crosshair)).x).toBe(0.5);
    await expect.poll(() => placeOf(shown(dot))).toEqual({ x: 0.5, y: 0 });
    await expect.poll(() => opacity(line)).toBeCloseTo(0.45);
    await expect
      .poll(() =>
        Number(getComputedStyle(shown('[data-slot="sparkline-path"][data-part="highlight"]')).opacity)
      )
      .toBe(1);

    // The marks cross-fade to the next value.
    await hoverAt(0.9);
    await expect.poll(() => placeOf(shown(dot))).toEqual({ x: 0.83, y: 0.5 });

    await commands.parkPointer();
    await expect
      .poll(() => [...image().querySelectorAll(dot)].map((d) => getComputedStyle(d).display))
      .toEqual(["none", "none", "none"]);
    await expect.poll(() => opacity(line)).toBe(1);
  });

  it("lifts the hovered bar and fades the others", async () => {
    renderSparkline("bar");
    await hoverAt(1 / 6);
    const bars = [...image().querySelectorAll('[data-slot="sparkline-bar"]:not([data-part])')];
    // The fade runs over 150 ms, so the poll waits for the dim to land, rounded to two places.
    await expect
      .poll(() => bars.map((bar) => Math.round(Number(getComputedStyle(bar).opacity) * 100) / 100))
      .toEqual([0.45, 0.45, 0.45]);
    const lifted = '[data-slot="sparkline-bar"][data-part="highlight"]';
    await expect.poll(() => Number(getComputedStyle(shown(lifted)).opacity)).toBe(1);
    expect(placeOf(shown(lifted)).x).toBe(0.17);
  });

  it("fades an area to nothing at the zero line, whichever readings draw fill", async () => {
    // [-4, null, 2, 4] spans [-4, 4], so 0 sits halfway down the 32 px box, at row 16. Only 2 and
    // 4 draw fill, between the third and fourth cells' centres, 187.5 to 262.5 px across. At 255 px
    // the line runs within 2 px of the top, so rows 4 and 14 show the fill alone, and row 28, below
    // zero with no fill, shows the page. The mask clears linearly from the top of the box to the
    // zero line, under a 0.3 fill, so a row's centre y paints at 0.3 × (1 - y / 16): 0.216 at row
    // 4 and 0.028 at row 14, within the 8-bit rounding of the screenshot.
    await emulateReducedMotion("reduce");
    renderThemed(
      <div style={{ width: 300, background: "#fff", "--chart-1": "#00f" }}>
        <Sparkline
          aria-label={NAME}
          data={[-4, null, 2, 4]}
          locale="en-US"
          curve="linear"
          variant="area"
          description="Lowest 2, highest 6."
        />
      </div>
    );
    const pixels = await rows(image(), 255, [4, 14, 28]);
    const [near, beside, page] = pixels.map((rgb) => rgb[0] ?? 0);
    const strength = (red: number | undefined) => ((page ?? 0) - (red ?? 0)) / (page ?? 1);
    expect(Math.abs(strength(near) - 0.3 * (1 - 4.5 / 16))).toBeLessThan(0.02);
    expect(Math.abs(strength(beside) - 0.3 * (1 - 14.5 / 16))).toBeLessThan(0.02);
  });

  it("enters with motion allowed, and stays still with data-intro none or under reduced motion", async () => {
    renderSparkline("bar");
    expect(image().getAnimations().length).toBe(1);
    expect(part('[data-slot="sparkline-bar"]').getAnimations().length).toBe(1);

    /** The last Sparkline rendered, which must show its marks at rest at once. */
    const expectStill = () => {
      const still = page.getByRole("img").all().at(-1)?.element();
      expect(still?.getAnimations()).toEqual([]);
      expect(still?.querySelector('[data-slot="sparkline-bar"]')?.getAnimations()).toEqual([]);
    };
    renderSparkline("bar", "none");
    expectStill();

    await emulateReducedMotion("reduce");
    renderSparkline("bar");
    expectStill();
  });
});
