/** One row's height and the list's block padding, in px, read from the density metrics. */
export type RowMetrics = { readonly row: number; readonly pad: number };

/**
 * The dense metrics, for the first render before the list can read the document's. They are
 * written as literals so the client entry does not bundle the density metric table. A unit test
 * checks them against the table's dense `row-h` and `surface-gap-sm`.
 */
export const DENSE_ROW_METRICS: RowMetrics = { row: 32, pad: 8 };
