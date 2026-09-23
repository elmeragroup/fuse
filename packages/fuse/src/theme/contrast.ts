export type LinearRgb = {
  r: number;
  g: number;
  b: number;
};

export type OklchColor = {
  l: number;
  c: number;
  h: number;
  alpha: number;
};

const OKLCH_RE =
  /^oklch\(\s*([0-9]*\.?[0-9]+)\s+([0-9]*\.?[0-9]+)\s+([0-9]*\.?[0-9]+)(?:\s*\/\s*([0-9]*\.?[0-9]+)(%)?)?\s*\)$/i;

export function parseOklch(value: string): OklchColor {
  const match = OKLCH_RE.exec(value);
  if (!match) {
    throw new Error(`Expected an oklch() color, received: ${value}`);
  }
  const parsed: OklchColor = {
    l: Number(match[1]),
    c: Number(match[2]),
    h: Number(match[3]),
    alpha: match[4] === undefined ? 1 : Number(match[4]) / (match[5] === "%" ? 100 : 1),
  };
  return parsed;
}

export function oklchToLinearSrgb(value: string): LinearRgb {
  const { l, c, h } = parseOklch(value);
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

function clipChannel(channel: number): number {
  if (channel < 0) {
    return 0;
  }
  if (channel > 1) {
    return 1;
  }
  return channel;
}

function linearToSrgb(channel: number): number {
  const clipped = clipChannel(channel);
  return clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055;
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function compositeOver(foreground: LinearRgb, alpha: number, background: LinearRgb): LinearRgb {
  const rest = 1 - alpha;
  // CSS surface compositing happens in sRGB. Convert back to linear light only
  // after blending, before calculating WCAG relative luminance.
  const blend = (front: number, back: number): number =>
    srgbToLinear(linearToSrgb(front) * alpha + linearToSrgb(back) * rest);
  return {
    r: blend(foreground.r, background.r),
    g: blend(foreground.g, background.g),
    b: blend(foreground.b, background.b),
  };
}

export function relativeLuminance(color: LinearRgb): number {
  return 0.2126 * clipChannel(color.r) + 0.7152 * clipChannel(color.g) + 0.0722 * clipChannel(color.b);
}

/**
 * The WCAG contrast ratio between two OKLCH values. A translucent foreground composites
 * over the background; the background itself is assumed opaque, which every surface the
 * theme contract measures satisfies — a translucent surface would need an explicit
 * backdrop to composite against.
 */
export function contrastRatio(foregroundValue: string, backgroundValue: string): number {
  const foreground = parseOklch(foregroundValue);
  const backgroundRgb = oklchToLinearSrgb(backgroundValue);
  const foregroundRgb = oklchToLinearSrgb(foregroundValue);
  const composited =
    foreground.alpha === 1 ? foregroundRgb : compositeOver(foregroundRgb, foreground.alpha, backgroundRgb);
  const lighter = Math.max(relativeLuminance(composited), relativeLuminance(backgroundRgb));
  const darker = Math.min(relativeLuminance(composited), relativeLuminance(backgroundRgb));
  return (lighter + 0.05) / (darker + 0.05);
}
