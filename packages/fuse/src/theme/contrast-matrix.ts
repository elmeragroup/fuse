import type { ResolvedColorScheme } from "./color-scheme-types";
import { composeTheme } from "./compose-theme";
import { contrastRatio } from "./contrast";
import type { TokenName } from "./tokens/contract";
import { LEGAL_THEMES, themeSlug } from "./tokens/themes";
import type { ThemeSlug } from "./tokens/themes";

// The theme contrast matrix lives apart from the color math in `contrast.ts`, because it
// composes themes, and theme composition itself mixes colors with that math.

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
