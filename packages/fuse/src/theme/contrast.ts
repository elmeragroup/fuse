import type { ResolvedColorScheme } from "./color-scheme-types";
import { composeTheme } from "./compose-theme";
import { linearSrgbFromOklch, oklchToLinearSrgb, parseOklch } from "./oklch";
import type { LinearRgb, OklchColor } from "./oklch";
import type { TokenName } from "./tokens/contract";
import { LEGAL_THEMES, themeSlug } from "./tokens/themes";
import type { ThemeSlug } from "./tokens/themes";

export const TEXT_GRADE_PAIRS = [
  ["foreground", "background"],
  ["foreground", "muted"],
  ["card-foreground", "card"],
  ["card-soft-foreground", "card-soft"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "background"],
  ["primary-foreground", "primary"],
  ["primary-soft-foreground", "primary-soft"],
  ["secondary-foreground", "secondary"],
  ["secondary-foreground", "secondary-hover"],
  ["secondary-soft-foreground", "secondary-soft"],
  ["error-foreground", "error"],
  ["error-soft-foreground", "error-soft"],
  ["info-foreground", "info"],
  ["info-soft-foreground", "info-soft"],
  ["success-foreground", "success"],
  ["success-soft-foreground", "success-soft"],
  ["warning-foreground", "warning"],
  ["warning-soft-foreground", "warning-soft"],
] as const satisfies readonly (readonly [TokenName, TokenName])[];

export type TextGradePairId =
  `${(typeof TEXT_GRADE_PAIRS)[number][0]}/${(typeof TEXT_GRADE_PAIRS)[number][1]}`;

export type ContrastMatrix = {
  [Slug in ThemeSlug]: {
    [Pair in TextGradePairId]: number;
  };
};

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

export function pairId(
  foreground: (typeof TEXT_GRADE_PAIRS)[number][0],
  background: (typeof TEXT_GRADE_PAIRS)[number][1]
): TextGradePairId {
  // SAFETY: both sides are members of TEXT_GRADE_PAIRS, which defines TextGradePairId.
  return `${foreground}/${background}` as TextGradePairId;
}

export function buildContrastMatrix(colorScheme: ResolvedColorScheme = "light"): ContrastMatrix {
  // SAFETY: every ThemeSlug and text-grade pair is written before return.
  const matrix = {} as ContrastMatrix;
  for (const theme of LEGAL_THEMES) {
    const tokens = composeTheme(theme, colorScheme);
    // SAFETY: the loop below fills every TextGradePairId for this theme.
    const row = {} as ContrastMatrix[ThemeSlug];
    for (const [foreground, background] of TEXT_GRADE_PAIRS) {
      row[pairId(foreground, background)] = Number(
        contrastRatio(tokens[foreground], tokens[background]).toFixed(2)
      );
    }
    matrix[themeSlug(theme)] = row;
  }
  return matrix;
}
