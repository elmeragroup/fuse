import { composeTheme } from "./compose-theme";
import type { TokenName } from "./tokens/contract";
import { LEGAL_THEMES, themeSlug } from "./tokens/themes";
import type { ThemeSlug } from "./tokens/themes";

export const TEXT_GRADE_PAIRS = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["card-soft-foreground", "card-soft"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "background"],
  ["primary-foreground", "primary"],
  ["primary-soft-foreground", "primary-soft"],
  ["secondary-foreground", "secondary"],
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
  /^oklch\(\s*([0-9]*\.?[0-9]+)\s+([0-9]*\.?[0-9]+)\s+([0-9]*\.?[0-9]+)(?:\s*\/\s*([0-9]*\.?[0-9]+))?\s*\)$/i;

export function parseOklch(value: string): OklchColor {
  const match = OKLCH_RE.exec(value);
  if (!match) {
    throw new Error(`Expected an oklch() color, received: ${value}`);
  }
  const parsed: OklchColor = {
    l: Number(match[1]),
    c: Number(match[2]),
    h: Number(match[3]),
    alpha: match[4] === undefined ? 1 : Number(match[4]),
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

function compositeOver(foreground: LinearRgb, alpha: number, background: LinearRgb): LinearRgb {
  const rest = 1 - alpha;
  return {
    r: foreground.r * alpha + background.r * rest,
    g: foreground.g * alpha + background.g * rest,
    b: foreground.b * alpha + background.b * rest,
  };
}

export function relativeLuminance(color: LinearRgb): number {
  return 0.2126 * clipChannel(color.r) + 0.7152 * clipChannel(color.g) + 0.0722 * clipChannel(color.b);
}

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

export function buildContrastMatrix(): ContrastMatrix {
  // SAFETY: every ThemeSlug and text-grade pair is written before return.
  const matrix = {} as ContrastMatrix;
  for (const theme of LEGAL_THEMES) {
    const tokens = composeTheme(theme);
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
