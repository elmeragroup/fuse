/**
 * M4 decimation, after Jugel and others, "M4: A Visualization-Oriented Time Series Data
 * Aggregation", VLDB 2014, as CONTRACT section 8.12 applies it. Decimation changes the drawn
 * geometry only, so every value the reader hears or the domain reads still comes from the raw rows.
 */

/** Above this many slots in a drawn window, the window decimates. */
export const DECIMATE_ABOVE = 2000;

/** The number of buckets a decimated window splits into. */
export const BUCKETS = 500;

/**
 * The bucket of each slot. Buckets split by slot index, `floor(i × 500 / n)`, because the server
 * does not know the plot width and index buckets give server and client the same result.
 *
 * @param count - The window's slot count.
 * @returns The first slot of each bucket, followed by `count`, so bucket `b` holds
 * `[edges[b], edges[b + 1])`. Above 500 slots every bucket holds at least one slot.
 */
export function bucketEdges(count: number): number[] {
  // The first slot of bucket b is the least i with floor(i × 500 / n) = b, which is ceil(b × n / 500).
  return Array.from({ length: BUCKETS + 1 }, (_, bucket) => Math.ceil((bucket * count) / BUCKETS));
}

/**
 * The slots one series keeps under M4. Each bucket keeps its first and last reading and its lowest
 * and highest reading, in x order, so a spike or a negative low stays visible. Ties keep the first
 * occurrence. A window of 2,000 slots or fewer keeps every slot with a reading.
 *
 * @param values - The series' readings in the window, null where it has none.
 * @returns The kept slot indexes, ascending.
 */
export function m4Indexes(values: readonly (number | null)[]): number[] {
  const kept: number[] = [];
  if (values.length <= DECIMATE_ABOVE) {
    values.forEach((value, index) => {
      if (value !== null) kept.push(index);
    });
    return kept;
  }
  const edges = bucketEdges(values.length);
  edges.slice(1).forEach((end, bucket) => {
    const readings: { readonly index: number; readonly value: number }[] = [];
    for (let index = edges[bucket] ?? end; index < end; index += 1) {
      const value = values[index] ?? null;
      if (value !== null) readings.push({ index, value });
    }
    const [first] = readings;
    if (first === undefined) return;
    let low = first;
    let high = first;
    for (const reading of readings) {
      if (reading.value < low.value) low = reading;
      if (reading.value > high.value) high = reading;
    }
    const last = readings.at(-1) ?? first;
    const indexes = new Set([first.index, low.index, high.index, last.index]);
    kept.push(...[...indexes].sort((a, b) => a - b));
  });
  return kept;
}
