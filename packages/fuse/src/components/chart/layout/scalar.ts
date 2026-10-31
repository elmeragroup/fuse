/**
 * Readers for the cells of a chart row. A `ChartScalar` is the consumer-owned union every data cell
 * may hold, so the chart narrows it here once instead of at each use.
 */
import type { ChartScalar } from "../chart-types";

/**
 * The number a cell holds.
 *
 * @param cell - A data cell.
 * @returns The number, NaN and infinities included, or undefined for any other cell.
 */
export function numberOf(cell: ChartScalar): number | undefined {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- ChartScalar is the consumer-owned cell union, and this is its one number reader
  return typeof cell === "number" ? cell : undefined;
}

/**
 * The string a cell holds.
 *
 * @param cell - A data cell.
 * @returns The string, or undefined for any other cell.
 */
export function stringOf(cell: ChartScalar): string | undefined {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- ChartScalar is the consumer-owned cell union, and this is its one string reader
  return typeof cell === "string" ? cell : undefined;
}
