import type { ResolvedColorScheme } from "./color-scheme-types";
import { composeTheme } from "./compose-theme";
import { cssVarReference } from "./css-values";
import { LEGAL_THEMES, themeSlug } from "./theme-input";
import type { ThemeSlug } from "./theme-input";
import { literalContrast } from "./token-color";
import { TOKEN_KINDS } from "./tokens/contract";
import type { TokenContract, TokenName } from "./tokens/contract";

/**
 * The surfaces a chart, syntax or control role must separate itself from: the page, the cards,
 * the modal fill and the panel.
 */
export const CONTROL_SURFACES = [
  "background",
  "card",
  "card-soft",
  "dialog",
  "panel",
] as const satisfies readonly TokenName[];

/**
 * The text-grade pairs: text on the surfaces every theme renders. The contrast gate holds each
 * at 4.5:1 in every theme and scheme, and the contrast snapshot records their ratios.
 */
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
  ["panel-foreground", "panel"],
  ["muted-foreground", "panel"],
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

/**
 * The dark-only panel pairs: the popup, accent, sidebar and right-panel roles with their text.
 * The contrast gate holds each at 4.5:1 in dark, in both identities.
 */
export const DARK_PANEL_TEXT_PAIRS = [
  ["popover-foreground", "popover"],
  ["accent-foreground", "accent"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["right-panel-foreground", "right-panel"],
] as const satisfies readonly (readonly [TokenName, TokenName])[];

/**
 * The sidebar's brand pair: `text-sidebar-brand` on the sidebar, and text on a
 * `bg-sidebar-brand` fill. Either role may alias another, so the gate reads them resolved and
 * holds each at 4.5:1 in every theme and scheme.
 */
export const SIDEBAR_BRAND_PAIRS = [
  ["sidebar-brand", "sidebar"],
  ["sidebar-brand-foreground", "sidebar-brand"],
] as const satisfies readonly (readonly [TokenName, TokenName])[];

/**
 * The filled-feature pairs. The branded Figma dark sheets choose their own feature colors and
 * do not meet the text floor, so the gate holds these at 4.5:1 in neutral dark only.
 */
export const FEATURE_TEXT_PAIRS = [
  ["feature-foreground", "feature"],
  ["feature-foreground", "feature-bright"],
] as const satisfies readonly (readonly [TokenName, TokenName])[];

/**
 * Muted copy, such as a field description, in a default Accordion item, which fills with
 * `primary-soft`. The gate holds it at 4.5:1 in dark only; light is an accepted deviation.
 */
export const ACCORDION_MUTED_PAIRS = [
  ["muted-foreground", "primary-soft"],
] as const satisfies readonly (readonly [TokenName, TokenName])[];

/** A pressed Toggle's label on its fill, held at 4.5:1 in every theme and scheme. */
export const TOGGLE_PRESSED_PAIRS = [
  ["toggle-pressed-foreground", "toggle-pressed"],
] as const satisfies readonly (readonly [TokenName, TokenName])[];

/** A direct label on a chart mark: each on-color role on the slot it was picked for, held at 4.5:1. */
export const CHART_ON_COLOR_PAIRS = [
  ["chart-1-foreground", "chart-1"],
  ["chart-2-foreground", "chart-2"],
  ["chart-3-foreground", "chart-3"],
  ["chart-4-foreground", "chart-4"],
  ["chart-5-foreground", "chart-5"],
  ["chart-6-foreground", "chart-6"],
  ["chart-7-foreground", "chart-7"],
  ["chart-8-foreground", "chart-8"],
  ["chart-other-foreground", "chart-other"],
] as const satisfies readonly (readonly [TokenName, TokenName])[];

/**
 * Every role text pair outside {@link TEXT_GRADE_PAIRS} that the contrast gate holds at 4.5:1
 * in at least one scheme or identity. Each group above says where its floor applies, so a pair
 * here can still fall below AA elsewhere.
 */
export const ROLE_TEXT_PAIRS = [
  ...DARK_PANEL_TEXT_PAIRS,
  ...FEATURE_TEXT_PAIRS,
  ...SIDEBAR_BRAND_PAIRS,
  ...ACCORDION_MUTED_PAIRS,
  ...TOGGLE_PRESSED_PAIRS,
  ...CHART_ON_COLOR_PAIRS,
] as const satisfies readonly (readonly [TokenName, TokenName])[];

type TextGradePairId = `${(typeof TEXT_GRADE_PAIRS)[number][0]}/${(typeof TEXT_GRADE_PAIRS)[number][1]}`;

type ContrastMatrix = {
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

function pairId(
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
