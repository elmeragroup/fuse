/**
 * The chart error tiers of CONTRACT section 8.1. Composition errors depend only on props, config
 * and the tree, so they throw in every build. Data errors throw in development and, in production,
 * warn once per Root for each rule and subject, such as a column, and render the fallback the rule
 * names. Both classes stay private, as `CommandCompositionError` does, and each carries its rule.
 *
 * `slot-limit` is the one composition rule the data can trigger: without a `period`, the rows'
 * range sets the time axis's span. It still throws in every build, because no fallback can draw
 * an axis of more slots than the limit, and building them freezes the tab.
 */
import type { ChartConfig } from "../chart-types";
import type { ModelIssue } from "./cartesian-model";

/** The composition rules this layer reaches. */
export type ChartCompositionRule =
  | "part-outside-root"
  | "unknown-key"
  | "x-type-mismatch"
  | "time-axis-without-zone"
  | "invalid-window"
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
  | "stack-across-panels"
  | "scale-colour-on-stack"
  | "series-not-in-panel"
  | "key-outside-panels"
  | "part-outside-panel"
  | "series-drawn-twice"
  | "invalid-gauge-domain"
  | "invalid-sweep"
  | "slot-limit";

/** The data rules, each with a production fallback. */
export type ChartDataRule =
  | "non-finite-value"
  | "non-finite-threshold"
  | "value-out-of-range"
  | "invalid-x"
  | "off-grid-x"
  | "duplicate-x"
  | "row-outside-period"
  | "quality-without-value"
  | "invalid-quality"
  | "mixed-sign-expand"
  | "table-column-format"
  | "non-finite-x"
  | "non-finite-y"
  | "unknown-series"
  | "negative-polar-value"
  | "radar-series-cap"
  | "unknown-category"
  | "non-finite-live-value";

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
  "non-finite-threshold":
    "received a threshold colour whose threshold is not a finite number. Pass a number, such as the period's average. Production paints every value in the threshold's below role.",
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
  "non-finite-x":
    "received an x cell that is not a finite number within ±1e15. Pass numbers, null or undefined. Production skips the row.",
  "non-finite-y":
    "received a y cell that is not a finite number within ±1e15. Pass numbers, null or undefined. Production skips the row.",
  "unknown-series":
    "received a series cell that names no config key. Add the value to config, or pass one of its keys. Production skips the row.",
  "negative-polar-value":
    "received a value below 0. A slice is a share of a whole and a ring fills a share of its maximum, so neither has a negative reading. Show a credit as a text row beside the chart, or draw it in a Chart.Bar stack. Production draws the value as 0, and the Table and the texts keep its sign.",
  "radar-series-cap":
    "received more than 4 series. A radar chart compares at most 4 polygons, so pick the 4 that matter, or split the chart. Production draws the first 4 config keys.",
  "unknown-category":
    "received a row whose category has no config entry. Add the category to config. Production folds the row into the Other slice.",
  "non-finite-live-value":
    "received a value that is not a finite number within ±1e15. Pass a number, or leave it out to show the latest reading's. Production shows the latest reading's value.",
} as const satisfies { readonly [R in ChartDataRule]: string };

/**
 * Check that a part names a config key.
 *
 * @param part - The calling part's display name.
 * @param config - The Root's config.
 * @param key - The key the part names.
 * @throws {ChartCompositionError} `unknown-key`, listing the valid keys.
 */
export function assertKnownKey(part: string, config: ChartConfig, key: string): void {
  if (Object.hasOwn(config, key)) return;
  const keys = Object.keys(config)
    .map((name) => JSON.stringify(name))
    .join(", ");
  throw new ChartCompositionError(
    part,
    "unknown-key",
    `received dataKey ${JSON.stringify(key)}, which names no config key. Use one of ${keys}.`
  );
}

/** A data issue that names its own row and subject, as the scatter model reports a skipped row. */
export type RowSubjectIssue = {
  readonly rule: ChartDataRule;
  readonly row: number;
  /** The column the rule is about. */
  readonly subject: string;
};

/** A data issue about a prop rather than a row, such as a live chart's `value`. */
export type PropIssue = {
  readonly kind: "prop";
  readonly rule: ChartDataRule;
  /** The prop the rule is about. */
  readonly subject: string;
};

/** Every data issue a Root reports: a cartesian model's, one that names its row, or a prop's. */
export type DataIssue = ModelIssue | RowSubjectIssue | PropIssue;

/**
 * What a data issue is about, so production warns once per rule and subject however many rows break
 * it: the column for a cell, the x axis for a row, the stack for a mixed-sign slot, and an issue's
 * own subject where it names one.
 *
 * @param issue - The issue.
 * @returns The subject.
 */
function dataSubject(issue: DataIssue): string {
  if ("subject" in issue) return issue.subject;
  if ("key" in issue) return issue.key;
  return issue.rule === "mixed-sign-expand" ? issue.stack : "x";
}

/**
 * One key for a rule and its subject, which no two pairs share, since a rule name holds no line
 * break.
 *
 * @param rule - The rule.
 * @param subject - What the issue is about, such as a column.
 * @returns The key.
 */
export function issueKey(rule: ChartDataRule | ChartHintRule, subject: string): string {
  return `${rule}\n${subject}`;
}

/** The data issues of one rule and subject: the first of them and how many there are. */
export type IssueGroup<TIssue extends DataIssue = ModelIssue> = {
  readonly rule: ChartDataRule;
  readonly subject: string;
  readonly first: TIssue;
  readonly count: number;
};

/**
 * Group data issues by rule and subject, in the order the groups first appear, so production warns
 * once for each group with its count.
 *
 * @param issues - The model's issues, in data order.
 * @returns Each group's first issue and count.
 */
export function issueGroups<TIssue extends DataIssue>(issues: readonly TIssue[]): IssueGroup<TIssue>[] {
  const groups = new Map<string, { -readonly [K in keyof IssueGroup<TIssue>]: IssueGroup<TIssue>[K] }>();
  for (const issue of issues) {
    const subject = dataSubject(issue);
    const key = issueKey(issue.rule, subject);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, { rule: issue.rule, subject, first: issue, count: 1 });
    else group.count += 1;
  }
  return [...groups.values()];
}

/**
 * What a data issue says after the part: the rule's message, then where it first broke, and how
 * many times when more than once.
 *
 * @param issue - The first issue of its rule and subject.
 * @param rowAt - The row each slot reads, which names a cell issue's row.
 * @param count - How many issues share the rule and subject.
 * @returns The text.
 */
export function dataMessage(issue: DataIssue, rowAt: readonly (number | undefined)[], count = 1): string {
  const more = count > 1 ? `, the first of ${String(count)}` : "";
  if ("kind" in issue) return `${DATA_MESSAGES[issue.rule]} Prop ${JSON.stringify(issue.subject)}${more}.`;
  const row = "row" in issue ? issue.row : "key" in issue ? rowAt[issue.slot] : undefined;
  const where =
    row !== undefined ? `Row ${String(row)}` : "slot" in issue ? `Slot ${String(issue.slot)}` : "";
  const named = "subject" in issue ? issue.subject : "key" in issue ? issue.key : undefined;
  const key = named === undefined ? "" : ` of ${JSON.stringify(named)}`;
  return `${DATA_MESSAGES[issue.rule]} ${where}${key}${more}.`;
}

/**
 * Whether the build is a development build, where data errors throw and hints warn. It shares the
 * theme validator's one `NODE_ENV` read, which bundlers replace at build time.
 */
export { isThemeDevelopment as isChartDevelopment } from "../../../theme/validate-theme";
