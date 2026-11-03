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
 * The bucket of each slot. Buckets split by slot index, `floor(i × buckets / n)`. A chart's plot
 * passes its measured width in pixel columns, so each bucket covers about one column, and a
 * Sparkline, which the server draws at no known width, keeps the default 500.
 *
 * @param count - The window's slot count.
 * @param buckets - How many buckets the window splits into, 500 by default.
 * @returns The first slot of each bucket, followed by `count`, so bucket `b` holds
 * `[edges[b], edges[b + 1])`. Above `buckets` slots every bucket holds at least one slot.
 */
export function bucketEdges(count: number, buckets: number = BUCKETS): number[] {
  // The first slot of bucket b is the least i with floor(i × buckets / n) = b, which is ceil(b × n / buckets).
  return Array.from({ length: buckets + 1 }, (_, bucket) => Math.ceil((bucket * count) / buckets));
}

/**
 * The slots one series keeps under M4. Each bucket keeps its first and last reading and its lowest
 * and highest reading, in x order, so a spike or a negative low stays visible. Ties keep the first
 * occurrence. A window of 2,000 slots or fewer keeps every slot with a reading.
 *
 * @param values - The series' readings in the window, null where it has none.
 * @param buckets - How many buckets a decimated window splits into, 500 by default.
 * @returns The kept slot indexes, ascending.
 */
export function m4Indexes(values: readonly (number | null)[], buckets: number = BUCKETS): number[] {
  const kept: number[] = [];
  if (values.length <= DECIMATE_ABOVE) {
    values.forEach((value, index) => {
      if (value !== null) kept.push(index);
    });
    return kept;
  }
  const edges = bucketEdges(values.length, Math.max(1, Math.round(buckets)));
  for (let bucket = 0; bucket + 1 < edges.length; bucket += 1) {
    const end = edges[bucket + 1] ?? 0;
    let first = -1;
    let last = -1;
    let low = -1;
    let high = -1;
    let lowValue = 0;
    let highValue = 0;
    for (let index = edges[bucket] ?? end; index < end; index += 1) {
      const value = values[index] ?? null;
      if (value === null) continue;
      if (first === -1) {
        first = index;
        low = index;
        high = index;
        lowValue = value;
        highValue = value;
      } else if (value < lowValue) {
        low = index;
        lowValue = value;
      } else if (value > highValue) {
        high = index;
        highValue = value;
      }
      last = index;
    }
    if (first === -1) continue;
    // The four slots in x order, each once: the first and last bound the low and the high.
    let previous = -1;
    for (const index of [first, Math.min(low, high), Math.max(low, high), last]) {
      if (index > previous) kept.push(index);
      previous = Math.max(previous, index);
    }
  }
  return kept;
}
