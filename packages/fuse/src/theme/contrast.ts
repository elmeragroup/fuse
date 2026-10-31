import type { ResolvedColorScheme } from "./color-scheme-types";
import { composeTheme } from "./compose-theme";
import { cssVarReference } from "./css-values";
import { literalContrast } from "./token-color";
import { TOKEN_KINDS } from "./tokens/contract";
import type { TokenContract, TokenName } from "./tokens/contract";
import { LEGAL_THEMES, themeSlug } from "./tokens/themes";
import type { ThemeSlug } from "./tokens/themes";

/**
 * The surfaces a chart, syntax or control role must separate itself from: the page, the cards
 * and the modal fill.
 */
export const CONTROL_SURFACES = [
  "background",
  "card",
  "card-soft",
  "dialog",
] as const satisfies readonly TokenName[];

export const TEXT_GRADE_PAIRS = [
  ["foreground", "background"],
  ["foreground", "muted"],
  ["card-foreground", "card"],
  ["card-soft-foreground", "card-soft"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "card-soft"],
  ["dialog-foreground", "dialog"],
  ["muted-foreground", "dialog"],
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

function isTokenName(name: string): name is TokenName {
  return Object.hasOwn(TOKEN_KINDS, name);
}

/**
 * The literal at the end of a role's `var()` chain within one composed theme. Contrast reads
 * literals, and a role such as `dialog` aliases another, such as `var(--background)`.
 *
 * @param tokens - One theme's composed tokens in one scheme.
 * @param name - The role to read.
 * @returns The role's value, or the value of the role its alias chain ends on.
 * @throws When the chain names a property that is not a role, or loops.
 */
export function tokenLiteral(tokens: TokenContract, name: TokenName): string {
  const seen = new Set<TokenName>();
  let current = name;
  let value = tokens[current];
  for (let target = cssVarReference(value); target !== undefined; target = cssVarReference(value)) {
    if (!isTokenName(target) || seen.has(current)) {
      throw new Error(`--${name} does not resolve to a role literal: ${value}`);
    }
    seen.add(current);
    current = target;
    value = tokens[current];
  }
  return value;
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
        literalContrast(tokenLiteral(tokens, foreground), tokenLiteral(tokens, background)).toFixed(2)
      );
    }
    matrix[themeSlug(theme)] = row;
  }
  return matrix;
}
