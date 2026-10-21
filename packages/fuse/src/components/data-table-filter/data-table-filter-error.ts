/**
 * What each composition rule tells the consumer after the name of the part that threw. Each
 * message states the rule, then the fix.
 */
const MESSAGES = {
  "outside-root":
    "must be used within DataTableFilter.Root. Wrap the filter's parts in DataTableFilter.Root.",
  "outside-chip":
    "must be used within DataTableFilter.Chip, under DataTableFilter.Chips. Render it in the chip template.",
  "outside-overlay":
    "must be used within DataTableFilter.Content or DataTableFilter.ValueContent. Render it in either overlay.",
  "outside-editor": "must be used within DataTableFilter.Editor. Render it in the editor of either overlay.",
  "no-content":
    "opens DataTableFilter.Content, but this DataTableFilter.Root renders none. Render <DataTableFilter.Content /> beside the Bar.",
  "no-value-content":
    "opens DataTableFilter.ValueContent, but this DataTableFilter.Root renders none. Render <DataTableFilter.ValueContent /> beside the Bar.",
} as const;

/** The ways the filter's parts can be composed wrong. */
export type DataTableFilterCompositionRule = keyof typeof MESSAGES;

/**
 * A part throws it when the consumer composes the filter's parts in a way that cannot work, such
 * as `DataTableFilter.Value` outside a chip. Its message starts with the part that threw and names
 * the fix. A Trigger or a Value whose overlay is missing throws it in development only.
 */
export class DataTableFilterCompositionError extends Error {
  override readonly name = "DataTableFilterCompositionError";
  readonly _tag = "DataTableFilterCompositionError" as const;

  /**
   * @param part - The part that threw, such as `DataTableFilter.Value`.
   * @param rule - The composition rule the tree breaks.
   */
  constructor(
    readonly part: string,
    readonly rule: DataTableFilterCompositionRule
  ) {
    super(`${part} ${MESSAGES[rule]}`);
  }
}
