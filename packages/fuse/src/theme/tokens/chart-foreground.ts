import { literalContrast } from "../token-color";
import { DERIVED_ROLES } from "./contract";
import type { DerivedTokenName, LayerTokens, TokenContract } from "./contract";
import { PRIMITIVES, WHITE } from "./primitives";

// A direct label on a mark is small text, so it takes the text floor.
const TEXT_FLOOR = 4.5;

const NEUTRAL_950 = PRIMITIVES["neutral-950"];

/**
 * The text color for a direct label on a chart mark: white or neutral 950, whichever contrasts
 * more with the fill, white on a tie.
 *
 * @throws When neither reaches 4.5:1 on the fill, a defect in the chart palette.
 */
function markForeground(fill: string): string {
  const white = literalContrast(WHITE, fill);
  const dark = literalContrast(NEUTRAL_950, fill);
  const [text, ratio] = dark > white ? [NEUTRAL_950, dark] : [WHITE, white];
  if (ratio < TEXT_FLOOR) {
    throw new Error(`Neither white nor neutral 950 reaches ${TEXT_FLOOR}:1 on the chart mark ${fill}`);
  }
  return text;
}

/** The on-color roles of the categorical slots and Other. */
export type ChartForegroundName = Extract<DerivedTokenName, `chart-${string}`>;

/**
 * The on-color roles of one composed theme, each read from the slot its `DERIVED_ROLES` entry
 * names: white or neutral 950, whichever contrasts more with the slot, at 4.5:1 or more. The
 * ramp, diverging and sentiment marks get none, so their labels sit outside the mark.
 *
 * @param tokens - Every layer-assigned role of one composed theme in one scheme.
 * @returns Each `chart-*-foreground` value, the `oklch()` literal of white or of neutral 950.
 * @throws When a slot has no readable foreground, a defect in the chart palette.
 */
export function chartForegrounds(tokens: LayerTokens): Pick<TokenContract, ChartForegroundName> {
  const on = (name: ChartForegroundName): string => markForeground(tokens[DERIVED_ROLES[name].sources[0]]);
  return {
    "chart-1-foreground": on("chart-1-foreground"),
    "chart-2-foreground": on("chart-2-foreground"),
    "chart-3-foreground": on("chart-3-foreground"),
    "chart-4-foreground": on("chart-4-foreground"),
    "chart-5-foreground": on("chart-5-foreground"),
    "chart-6-foreground": on("chart-6-foreground"),
    "chart-7-foreground": on("chart-7-foreground"),
    "chart-8-foreground": on("chart-8-foreground"),
    "chart-other-foreground": on("chart-other-foreground"),
  };
}
