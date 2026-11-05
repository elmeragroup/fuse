/**
 * Which segments of one stack keep the value-axis pixel floor in a frame, the one place the floor's
 * policy lives. The floor keeps a reading under a device pixel visible. A stack's segments draw in
 * marks of their own, so the stack floors hand this module every span the stack's marks draw in the
 * frame, and it decides from them alone, never from the data an update ends on.
 */
import { floorAcross } from "./plot-frame";
import type { PlotFrame, PlotRect } from "./plot-frame";

/** One stack segment as a frame draws it: its ends and the pixels its plain snap covers. */
export type StackSegment = {
  /** Its base along the value axis, unsnapped and before any seam. */
  readonly base: number;
  /** Its tip, likewise. */
  readonly tip: number;
  /** Where the device pixels its plain snap covers along the value axis start, with no floor. */
  readonly plainFrom: number;
  /** Where they end, the same as `plainFrom` where the plain snap covers none. */
  readonly plainTo: number;
};

/** One span a stack's mark draws: the device pixel columns it covers along the slot axis, and its segment. */
export type FloorSpan = {
  /** Its first device pixel column along the slot axis, from the plot's drawn origin. */
  readonly from: number;
  /** The device pixel column past its last. */
  readonly to: number;
  /** The series it draws, by config key, which names it in ties and keeps a series' own spans from competing. */
  readonly series: string;
  readonly segment: StackSegment;
};

/**
 * The side of zero a body's tip lies on from its base: above for up a vertical frame or right
 * across a horizontal one. A body of no length lies on neither side, so it takes no floor and reads
 * no place.
 *
 * @param frame - The layout's frame.
 * @param base - The body's base along the value axis, unsnapped.
 * @param tip - Its tip, likewise.
 * @returns The side, or null.
 */
export function zeroSide(frame: PlotFrame, base: number, tip: number): "above" | "below" | null {
  if (tip === base) return null;
  return (frame.orientation === "vertical" ? tip < base : tip > base) ? "above" : "below";
}

/**
 * The span a body draws, or reads the stack floors at: the device pixel columns its plain snap
 * covers along the slot axis and its segment.
 *
 * @param frame - The layout's frame.
 * @param plain - The body snapped with no floor, as `frameRect` draws it.
 * @param series - The series it draws, by config key.
 * @param across - Its unsnapped base and tip along the value axis, base first.
 * @returns The span.
 */
export function floorSpanOf(
  frame: PlotFrame,
  plain: PlotRect,
  series: string,
  [base, tip]: readonly [base: number, tip: number]
): FloorSpan {
  const { dpr } = frame.box;
  const vertical = frame.orientation === "vertical";
  const [alongFrom, alongTo] = vertical
    ? [plain.x, plain.x + plain.width]
    : [plain.y, plain.y + plain.height];
  const [plainFrom, plainTo] = vertical
    ? [plain.y, plain.y + plain.height]
    : [plain.x, plain.x + plain.width];
  return {
    from: Math.round(alongFrom * dpr),
    to: Math.round(alongTo * dpr),
    series,
    segment: { base, tip, plainFrom, plainTo },
  };
}

/** How far two snapped spans may share an edge's float error and still count as apart. */
const OVERLAP = 1e-6;

/**
 * Which spans keep their floor. The slot axis splits into runs, each a range of device pixel
 * columns where the same spans take part, and each run settles once:
 *
 * - On each side of zero the series whose span there reaches farthest out wins, a tie going to the
 *   series first in code-unit order of its key, so the order the marks register in never matters.
 * - Each of the winning series' spans on that side proposes its floor. A series' own spans never
 *   compete, as narrow buckets of one series share pixels in its own paint.
 * - A proposal stands where its floor's pixels cover no pixel another series' span covers on its
 *   own in the run, on either side, so a floor never lands on another series. The side above zero
 *   proposes first, and a proposal below zero also keeps clear of the floors above that stand, so
 *   two series' floors never share a pixel.
 *
 * A span keeps its floor only where its proposal stands in every run it covers, as a bar or a
 * column paints one floor for its whole span. A stack at rest with any length keeps a pixel: the
 * span reaching farthest out on a side, the first series' on a tie, wins every run it covers, and
 * its floor lies past every other segment's pixels.
 *
 * @param spans - The stack's spans in the frame.
 * @param frame - The layout's frame the stack draws in.
 * @returns For each span, 1 where it keeps its floor and 0 where it does not.
 */
export function settleFloors(spans: readonly FloorSpan[], frame: PlotFrame): Uint8Array {
  const count = spans.length;
  const keeps = new Uint8Array(count);
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const { from, to } of spans) {
    if (to <= from) continue;
    low = Math.min(low, from);
    high = Math.max(high, to);
  }
  if (!(high > low)) return keeps;
  // Each series' rank in code-unit order of its key, and each span's. A mark's spans come
  // together and share their series, so a span reads the rank its neighbour found.
  const seen = new Set<string>();
  for (const { series } of spans) seen.add(series);
  const names = [...seen].toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const rankOf = new Map(names.map((name, rank) => [name, rank]));
  const ranks = new Int32Array(count);
  // Each span's side, 1 above, -1 below, 0 with no length, and how far its tip reaches out.
  const sides = new Int8Array(count);
  const reaches = new Float64Array(count);
  const vertical = frame.orientation === "vertical";
  let lastSeries = "";
  let lastRank = 0;
  for (let id = 0; id < count; id += 1) {
    const span = spans[id];
    if (span === undefined) continue;
    if (id === 0 || span.series !== lastSeries) {
      lastSeries = span.series;
      lastRank = rankOf.get(lastSeries) ?? 0;
    }
    ranks[id] = lastRank;
    const { base, tip } = span.segment;
    const side = zeroSide(frame, base, tip);
    if (side === null) continue;
    // How far the tip lies in the positive direction: up a vertical frame, right across a horizontal one.
    const up = vertical ? -tip : tip;
    sides[id] = side === "above" ? 1 : -1;
    reaches[id] = side === "above" ? up : -up;
  }
  // Each device pixel column's starting and ending spans, as linked lists.
  const width = high - low + 1;
  const starts = new Int32Array(width).fill(-1);
  const ends = new Int32Array(width).fill(-1);
  const nextStart = new Int32Array(count);
  const nextEnd = new Int32Array(count);
  spans.forEach(({ from, to }, id) => {
    if (to <= from) return;
    nextStart[id] = starts[from - low] ?? -1;
    starts[from - low] = id;
    nextEnd[id] = ends[to - low] ?? -1;
    ends[to - low] = id;
  });
  const active = new Int32Array(count);
  const slot = new Int32Array(count).fill(-1);
  const won = new Uint8Array(count);
  const lost = new Uint8Array(count);
  // The floors that stand in the current run: their series' ranks and their pixels.
  const standing: { readonly rank: number; readonly from: number; readonly to: number }[] = [];
  let size = 0;
  /** Settle one side of the current run. */
  const settleSide = (side: 1 | -1): void => {
    let best = -1;
    let reach = Number.NEGATIVE_INFINITY;
    for (let place = 0; place < size; place += 1) {
      const id = active[place] ?? -1;
      if (sides[id] !== side) continue;
      const own = reaches[id] ?? 0;
      const rank = ranks[id] ?? 0;
      if (own > reach || (own === reach && rank < best)) {
        best = rank;
        reach = own;
      }
    }
    for (let place = 0; place < size; place += 1) {
      const id = active[place] ?? -1;
      if (sides[id] !== side) continue;
      if (ranks[id] !== best) {
        lost[id] = 1;
        continue;
      }
      const segment = spans[id]?.segment;
      if (segment === undefined) continue;
      const [from, to] = floorAcross(frame, segment.plainFrom, segment.plainTo, [segment.base, segment.tip]);
      let clear = true;
      for (let other = 0; other < size && clear; other += 1) {
        const them = active[other] ?? -1;
        if (ranks[them] === best) continue;
        const plain = spans[them]?.segment;
        if (plain !== undefined && Math.min(to, plain.plainTo) - Math.max(from, plain.plainFrom) > OVERLAP)
          clear = false;
      }
      for (const floor of standing) {
        if (floor.rank !== best && Math.min(to, floor.to) - Math.max(from, floor.from) > OVERLAP)
          clear = false;
      }
      if (!clear) {
        lost[id] = 1;
        continue;
      }
      won[id] = 1;
      // Only a floor that adds pixels can share one with another series' floor.
      if (to - from > segment.plainTo - segment.plainFrom + OVERLAP) standing.push({ rank: best, from, to });
    }
  };
  for (let at = 0; at < width; at += 1) {
    let changed = false;
    for (let id = ends[at] ?? -1; id !== -1; id = nextEnd[id] ?? -1) {
      const place = slot[id] ?? -1;
      const last = active[size - 1] ?? -1;
      active[place] = last;
      slot[last] = place;
      slot[id] = -1;
      size -= 1;
      changed = true;
    }
    for (let id = starts[at] ?? -1; id !== -1; id = nextStart[id] ?? -1) {
      active[size] = id;
      slot[id] = size;
      size += 1;
      changed = true;
    }
    // The run from here to the next start or end holds the same spans, so it settles once.
    if (!changed || size === 0) continue;
    standing.length = 0;
    settleSide(1);
    settleSide(-1);
  }
  for (let id = 0; id < count; id += 1) keeps[id] = won[id] === 1 && lost[id] !== 1 ? 1 : 0;
  return keeps;
}
