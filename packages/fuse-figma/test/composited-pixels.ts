/**
 * Pixels and shadows as the Chromium oracle suites compare them: a spec's colors composited over
 * 8-bit pixels as CSS composites them, and Chromium's computed `box-shadow`s read as the channels and
 * lengths a spec's resolve to. Colors parse, convert and composite through `@elmeragroup/color`, a
 * computed color through `mode-sweep.ts`'s `computedColor`.
 */
import * as Srgb from "@elmeragroup/color/srgb";

import type { Rgba } from "../src/variable-set.ts";
import { computedColor } from "./mode-sweep.ts";

/** An 8-bit color with no alpha. */
export type Pixel = { readonly r: number; readonly g: number; readonly b: number };

/** How far apart a channel of the spec's pixel and Chromium's may lie, for color conversion. */
export const CHANNEL_TOLERANCE = 2;

/**
 * An sRGB color from 0..1 channels and alpha.
 *
 * @param channels - The color.
 * @returns The color.
 * @throws When a channel lies outside 0..1, which a synced file never holds.
 */
function srgb({ r, g, b, a }: Rgba): Srgb.Srgb {
  const made = Srgb.make({ r, g, b, alpha: a });
  if (made._tag !== "ok") {
    throw new Error(`the file holds a color outside sRGB: ${JSON.stringify({ r, g, b, a })}`);
  }
  return made.value;
}

/**
 * A color over an 8-bit pixel, composited as CSS does.
 *
 * @param base - The opaque pixel below.
 * @param paint - The color painted over it.
 * @returns The pixel shown, in 8-bit channels.
 */
export function over(base: Pixel, paint: Rgba): Pixel {
  const shown = Srgb.compositeOver(
    srgb(paint),
    srgb({ r: base.r / 255, g: base.g / 255, b: base.b / 255, a: 1 })
  );
  return { r: shown.r * 255, g: shown.g * 255, b: shown.b * 255 };
}

/**
 * Whether two pixels lie within {@link CHANNEL_TOLERANCE} on every channel.
 *
 * @param spec - The pixel the spec paints.
 * @param browser - The pixel Chromium paints.
 * @returns True where every channel is near.
 */
export function near(spec: Pixel, browser: Pixel): boolean {
  return (["r", "g", "b"] as const).every(
    (channel) => Math.abs(spec[channel] - browser[channel]) <= CHANNEL_TOLERANCE
  );
}

/**
 * A pixel, rounded, for a mismatch line.
 *
 * @param pixel - The pixel.
 * @returns It as `rgb(r, g, b)`.
 */
export function shownPixel(pixel: Pixel): string {
  return `rgb(${[pixel.r, pixel.g, pixel.b].map((channel) => Math.round(channel)).join(", ")})`;
}

/** One drop shadow, its lengths in CSS pixels and its color as 0..1 channels. */
export type Shadow = {
  readonly color: Rgba;
  readonly x: number;
  readonly y: number;
  readonly blur: number;
  readonly spread: number;
};

/**
 * A computed `box-shadow` as the shadows it paints, first on top as CSS lists them: a layer with a
 * clear color or no geometry paints nothing.
 *
 * @param value - The `box-shadow` as Chromium computes it.
 * @returns The shadows.
 * @throws When a layer is not a color and four pixel lengths, as Chromium computes an outer shadow.
 */
export function computedShadows(value: string): readonly Shadow[] {
  if (value === "none") {
    return [];
  }
  return value.split(/,(?![^(]*\))/).flatMap((layer) => {
    const match =
      /^\s*([a-z]+\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s*$/.exec(layer);
    if (match === null) {
      throw new Error(`Chromium computed a shadow this suite does not read: ${layer}`);
    }
    const [, text = "", x = "", y = "", blur = "", spread = ""] = match;
    const shadow = {
      color: computedColor(text),
      x: Number(x),
      y: Number(y),
      blur: Number(blur),
      spread: Number(spread),
    };
    const paints =
      shadow.color.a > 0 && [shadow.x, shadow.y, shadow.blur, shadow.spread].some((length) => length !== 0);
    return paints ? [shadow] : [];
  });
}

/**
 * A length or channel rounded to three decimals.
 *
 * @param value - The number.
 * @returns It rounded.
 */
export function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * A shadow list with each number rounded to three decimals, for one comparison.
 *
 * @param shadows - The shadows.
 * @returns Them as JSON.
 */
export function roundedShadows(shadows: readonly Shadow[]): string {
  return JSON.stringify(
    shadows.map(({ color: { r, g, b, a }, x, y, blur, spread }) => ({
      color: { r: round(r), g: round(g), b: round(b), a: round(a) },
      x: round(x),
      y: round(y),
      blur: round(blur),
      spread: round(spread),
    }))
  );
}
