/** One row's height and the list's block padding, in px, read from the density metrics. */
export type RowMetrics = { readonly row: number; readonly pad: number };

/**
 * The dense metrics, for the first render before the list can read the document's. Written as
 * literals so the client entry does not bundle the density metric table; a unit test holds them
 * to the table's dense `row-h` and `surface-pad-sm`.
 */
export const DENSE_ROW_METRICS: RowMetrics = { row: 32, pad: 4 };
