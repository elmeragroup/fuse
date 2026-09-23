// The OKLCH color math the token pipeline shares. Theme composition mixes derived roles
// with it, the contrast gate converts roles to linear sRGB with it, and the CSS value
// readers convert colors to gamma-encoded sRGB with it, so it imports nothing from the
// theme pipeline.

/** A color's linear-light sRGB channels, unclipped, as the contrast math reads them. */
export type LinearRgb = {
  r: number;
  g: number;
  b: number;
};

/** A parsed `oklch()` color. `alpha` is 0 to 1 whatever spelling the literal used. */
export type OklchColor = {
  l: number;
  c: number;
  h: number;
  alpha: number;
};

const OKLCH_RE =
  /^oklch\(\s*([0-9]*\.?[0-9]+)\s+([0-9]*\.?[0-9]+)\s+([0-9]*\.?[0-9]+)(?:\s*\/\s*([0-9]*\.?[0-9]+)(%)?)?\s*\)$/i;

// Seven decimals keep every literal the palettes hold, the longest being the dark
// sheets' seven-decimal coordinates, so mixing a color with itself returns its spelling.
const DECIMALS = 7;

/**
 * Read an `oklch(L C H)` or `oklch(L C H / A)` literal, with the alpha as a number or a
 * percentage.
 *
 * @param value - A CSS color.
 * @returns The coordinates and alpha, or `undefined` when `value` is not a well-formed
 *   `oklch()` literal.
 */
export function readOklch(value: string): OklchColor | undefined {
  const match = OKLCH_RE.exec(value);
  if (!match) {
    return undefined;
  }
  return {
    l: Number(match[1]),
    c: Number(match[2]),
    h: Number(match[3]),
    alpha: match[4] === undefined ? 1 : Number(match[4]) / (match[5] === "%" ? 100 : 1),
  };
}

/**
 * Parse an `oklch(L C H)` or `oklch(L C H / A)` literal, with the alpha as a number or a
 * percentage.
 *
 * @param value - A token value spelled as an `oklch()` literal.
 * @returns The color's coordinates and alpha.
 * @throws When the value is not an `oklch()` literal, which is a defect in a token module.
 */
export function parseOklch(value: string): OklchColor {
  const parsed = readOklch(value);
  if (parsed === undefined) {
    throw new Error(`Expected an oklch() color, received: ${value}`);
  }
  return parsed;
}

/**
 * Convert an `oklch()` literal to linear-light sRGB through OKLab, ignoring its alpha.
 *
 * @param value - A token value spelled as an `oklch()` literal.
 * @returns The unclipped linear sRGB channels.
 */
export function oklchToLinearSrgb(value: string): LinearRgb {
  return linearSrgbFromOklch(parseOklch(value));
}

/**
 * Convert parsed OKLCH coordinates to linear-light sRGB through OKLab, ignoring alpha.
 *
 * @param color - Coordinates from {@link readOklch} or {@link parseOklch}.
 * @returns The unclipped linear sRGB channels.
 */
export function linearSrgbFromOklch({ l, c, h }: OklchColor): LinearRgb {
  const hue = (h * Math.PI) / 180;
  const a = c * Math.cos(hue);
  const b = c * Math.sin(hue);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const lmsL = l_ * l_ * l_;
  const lmsM = m_ * m_ * m_;
  const lmsS = s_ * s_ * s_;
  return {
    r: 4.0767416621 * lmsL - 3.3077115913 * lmsM + 0.2309699292 * lmsS,
    g: -1.2684380046 * lmsL + 2.6097574011 * lmsM - 0.3413193965 * lmsS,
    b: -0.0041960863 * lmsL - 0.7034186147 * lmsM + 1.707614701 * lmsS,
  };
}

/**
 * Clip a channel to `0..1`, the range sRGB can show.
 *
 * @param channel - A linear or gamma-encoded channel, possibly out of gamut.
 * @returns The channel clipped to `0..1`.
 */
export function clipChannel(channel: number): number {
  if (channel < 0) {
    return 0;
  }
  if (channel > 1) {
    return 1;
  }
  return channel;
}

/**
 * Gamma-encode one linear-light channel with the sRGB transfer function, after clipping it
 * to `0..1`.
 *
 * @param channel - A linear-light channel, possibly out of gamut.
 * @returns The gamma-encoded channel in `0..1`.
 */
export function linearToSrgb(channel: number): number {
  const clipped = clipChannel(channel);
  return clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055;
}

/** A gamma-encoded sRGB color with channels and alpha in `0..1`. */
export type SrgbColor = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
};

/**
 * Convert OKLCH coordinates to gamma-encoded sRGB, the form design tools store. It clips
 * out-of-gamut channels to `0..1`, as the contrast checks do.
 *
 * @param color - Coordinates from {@link readOklch} or {@link parseOklch}.
 * @returns The sRGB channels and the color's alpha.
 */
export function oklchToSrgb(color: OklchColor): SrgbColor {
  const linear = linearSrgbFromOklch(color);
  return {
    r: linearToSrgb(linear.r),
    g: linearToSrgb(linear.g),
    b: linearToSrgb(linear.b),
    alpha: color.alpha,
  };
}

/**
 * Mix two `oklch()` colors the way CSS `color-mix(in oklch, from, to amount)` does, so a
 * theme can ship the mixed value as a literal token. It follows CSS Color 4. Lightness and
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
  // The check reads the alpha after rounding, because `0.95 + 0.05` need not sum to
  // exactly 1 in floating point.
  const opacity = formatNumber(alpha);
  return opacity === "1" ? `oklch(${coordinates})` : `oklch(${coordinates} / ${opacity})`;
}
