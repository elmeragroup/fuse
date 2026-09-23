import { parseOklch } from "./contrast";
import type { OklchColor } from "./contrast";

// Seven decimals keep every literal the palettes hold, the longest being the dark
// sheets' seven-decimal coordinates, so mixing a color with itself returns its spelling.
const DECIMALS = 7;

/**
 * Mix two `oklch()` colors the way CSS `color-mix(in oklch, from, to amount)` does, so a
 * theme can ship the mixed value as a literal token. It follows CSS Color 4: lightness and
 * chroma interpolate premultiplied by alpha, and hue takes the shorter arc.
 *
 * @param from - The color the mix starts from, as `oklch(L C H)` or `oklch(L C H / A)`.
 * @param to - The color the mix moves toward, in the same form.
 * @param amount - The share of `to`, from 0 to 1. CSS `to 5%` is `0.05`.
 * @returns The mixed color as an `oklch()` literal.
 * @throws When `amount` is outside 0..1 or a color is not an `oklch()` literal. Both are
 *   defects in a token module, not runtime input.
 */
export function mixOklch(from: string, to: string, amount: number): string {
  if (!(amount >= 0 && amount <= 1)) {
    throw new Error(`mixOklch amount must be within 0..1, received: ${amount}`);
  }
  const start = parseOklch(from);
  const end = parseOklch(to);
  const keep = 1 - amount;
  const alpha = start.alpha * keep + end.alpha * amount;
  const premultiplied = (read: (color: OklchColor) => number): number =>
    alpha === 0 ? 0 : (read(start) * start.alpha * keep + read(end) * end.alpha * amount) / alpha;
  return formatOklch({
    l: premultiplied((color) => color.l),
    c: premultiplied((color) => color.c),
    h: shorterArcHue(start.h, end.h, amount),
    alpha,
  });
}

function shorterArcHue(fromHue: number, toHue: number, amount: number): number {
  let from = fromHue;
  let to = toHue;
  if (to - from > 180) {
    from += 360;
  } else if (to - from < -180) {
    to += 360;
  }
  const hue = (from * (1 - amount) + to * amount) % 360;
  return hue < 0 ? hue + 360 : hue;
}

/** A fixed-point number without trailing zeros, never in exponent form. */
function formatNumber(value: number): string {
  const fixed = value.toFixed(DECIMALS);
  const trimmed = fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
  return trimmed === "-0" ? "0" : trimmed;
}

function formatOklch({ l, c, h, alpha }: OklchColor): string {
  const coordinates = `${formatNumber(l)} ${formatNumber(c)} ${formatNumber(h)}`;
  // Compare the rounded alpha: `0.95 + 0.05` need not sum to exactly 1 in floating point.
  const opacity = formatNumber(alpha);
  return opacity === "1" ? `oklch(${coordinates})` : `oklch(${coordinates} / ${opacity})`;
}
