/**
 * The chart error tiers of CONTRACT section 8.1. Composition errors depend only on props, config
 * and the tree, so they throw in every build. Data errors throw in development and, in production,
 * warn once per Root and rule and render the fallback the rule names. Both classes stay private, as
 * `CommandCompositionError` does, and each carries its rule.
 */

/** The composition rules this layer reaches. */
export type ChartCompositionRule =
  | "part-outside-root"
  | "unknown-key"
  | "x-type-mismatch"
  | "time-axis-without-zone"
  | "baseline-required"
  | "bar-needs-band"
  | "step-curve-needs-cells"
  | "nested-bar-group"
  | "bar-not-in-group"
  | "mixed-sentiment-categorical"
  | "interval-not-nested"
  | "nested-panel"
  | "horizontal-panels"
  | "series-in-two-panels"
  | "series-not-in-panel"
  | "key-outside-panels"
  | "part-outside-panel";

/** The data rules, each with a production fallback. */
export type ChartDataRule =
  | "non-finite-value"
  | "value-out-of-range"
  | "invalid-x"
  | "off-grid-x"
  | "duplicate-x"
  | "row-outside-period"
  | "quality-without-value"
  | "invalid-quality"
  | "mixed-sign-expand"
  | "table-column-format";

/** The development hints, which warn in development only. */
export type ChartHintRule =
  | "reference-outside-domain"
  | "absent-column"
  | "bars-overlap"
  | "bar-variant-needs-html";

/**
 * A part throws it when the consumer composes chart parts in a way that cannot work. Its message
 * starts with the part and names the fix.
 */
export class ChartCompositionError extends Error {
  override readonly name = "ChartCompositionError";
  readonly _tag = "ChartCompositionError" as const;

  /**
   * @param part - The part that threw, such as `Chart.Bar`.
   * @param rule - The composition rule the tree breaks.
   * @param message - What is wrong and how to fix it.
   */
  constructor(
    readonly part: string,
    readonly rule: ChartCompositionRule,
    message: string
  ) {
    super(`${part} ${message}`);
  }
}

/** Root throws it in development when a data cell breaks a rule that production coerces. */
export class ChartDataError extends Error {
  override readonly name = "ChartDataError";
  readonly _tag = "ChartDataError" as const;

  /**
   * @param part - The part that read the data, such as `Chart.Root`.
   * @param rule - The data rule the cell breaks.
   * @param message - What is wrong, where, and how production renders it.
   */
  constructor(
    readonly part: string,
    readonly rule: ChartDataRule,
    message: string
  ) {
    super(`${part} ${message}`);
  }
}

/** What each data rule says after the part, ending with the production fallback. */
export const DATA_MESSAGES = {
  "non-finite-value":
    "received a value cell that is not a finite number. Pass numbers, null or undefined. Production counts the reading as missing.",
  "value-out-of-range": "received a value above 1e15 in magnitude. Production counts the reading as missing.",
  "invalid-x":
    "received a time-axis x that is not a valid Date or epoch milliseconds. Production drops the row.",
  "off-grid-x":
    "received a time-axis x that is not a slot start in the chart's zone. A day stored as UTC midnight is the common cause, so store each slot's start instant in the market's zone. Production moves the row to the slot that holds the instant.",
  "duplicate-x": "received two rows for one slot or category. Production keeps the first row in data order.",
  "row-outside-period": "received a row outside `period`. Production drops the row.",
  "quality-without-value":
    "received an estimated or corrected quality on a reading with no value. Production counts the reading as missing.",
  "invalid-quality":
    'received a quality that is not "measured", "estimated", "corrected" or "missing". Production draws the reading as estimated.',
  "mixed-sign-expand":
    'received a stacked slot with both signs under stackOffset="expand". Production divides the slot by the sum of its magnitudes and keeps the signs apart.',
  "table-column-format":
    "received a format that does not fit its cells, a time preset on numbers or a value format on Date cells. Production prints each cell through its type's default format.",
} as const satisfies { readonly [R in ChartDataRule]: string };

/**
 * Whether the build is a development build, where data errors throw and hints warn. It shares the
 * theme validator's one `NODE_ENV` read, which bundlers replace at build time.
 */
export { isThemeDevelopment as isChartDevelopment } from "../../../theme/validate-theme";
