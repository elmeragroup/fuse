/**
 * The pie's layout: which rows draw as their own slice and which fold into Other, each slice's
 * angles in a sweep, and the rim floor that keeps every slice visible. CONTRACT section 8.4 gives
 * the fold and section 8.2 the degenerate rows. Slices follow data order through d3's pie with
 * `sort(null)`, so a month switch keeps each part in place.
 */
import { pie as d3Pie } from "d3-shape";

import { angleInSweep, toDegrees, toRadians } from "./polar-angle";
import type { Sweep } from "./polar-angle";

/**
 * The key of the Other item the fold makes. It is reserved: config cannot hold it and selection
 * cannot name it, because a config key is a consumer's category and U+0000 starts none.
 */
export const OTHER_KEY = "\u0000other";

/**
 * Which rows fold into Other. "own" folds only when it falls past the cap. "other" folds whenever
 * the fold runs, as a category whose config colour is `chart-other` does. "unknown" always folds,
 * as a row whose category has no config entry does.
 */
export type PieRole = "own" | "other" | "unknown";

/** One row as the fold reads it. */
export type PieRow = {
  /** The row's category, its config key. */
  readonly key: string;
  /** The row's reading, or null for a missing one. */
  readonly value: number | null;
  readonly role: PieRole;
};

/** One item the pie draws: a kept category or Other, with the rows it stands for in data order. */
export type PieItem = {
  /** The category, or `OTHER_KEY`. */
  readonly key: string;
  /** The reading, the sum of the folded readings on Other, or null when every row it holds is missing. */
  readonly value: number | null;
  /**
   * What it draws: the sum of its rows' readings above 0, so a credit folded into Other draws as 0
   * and never cancels a charge beside it, as a negative reading draws as 0 on its own.
   */
  readonly weight: number;
  /** The rows it stands for, by index into the rows. */
  readonly rows: readonly number[];
};

/** A row's weight in the fold: its drawn value, so a negative or missing reading weighs nothing. */
function weightOf(value: number | null): number {
  return value !== null && Number.isFinite(value) && value > 0 ? value : 0;
}

/** The sum of the readings of some rows, or null when every one of them is missing. */
function sumOf(rows: readonly PieRow[], indexes: readonly number[]): number | null {
  let sum: number | null = null;
  for (const index of indexes) {
    const value = rows[index]?.value;
    if (value === undefined || value === null || !Number.isFinite(value)) continue;
    sum = (sum ?? 0) + value;
  }
  return sum;
}

/**
 * Fold the rows that pass the slice cap into one Other item. The fold runs only when the rows
 * outnumber `maxSlices`. Then every "other" row folds, the `maxSlices − 1` largest of the rest stay,
 * a tie at the cut going to the earlier row, and the rest fold. An "unknown" row folds whether or
 * not the fold runs. Kept items keep data order, and Other comes last.
 *
 * @param rows - The rows in data order.
 * @param maxSlices - The most items the pie draws, a whole number of at least 2.
 * @returns The items in sweep order.
 */
export function foldPie(rows: readonly PieRow[], maxSlices: number): readonly PieItem[] {
  const folds = rows.length > maxSlices;
  const folded = new Set<number>();
  rows.forEach(({ role }, index) => {
    if (role === "unknown" || (folds && role === "other")) folded.add(index);
  });
  if (folds) {
    const candidates = rows
      .map((row, index) => ({ index, weight: weightOf(row.value) }))
      .filter(({ index }) => !folded.has(index))
      // Array sort is stable, so equal weights keep data order and the tie goes to the earlier row.
      .sort((a, b) => b.weight - a.weight);
    for (const { index } of candidates.slice(maxSlices - 1)) folded.add(index);
  }
  const items: PieItem[] = [];
  rows.forEach(({ key, value }, index) => {
    if (!folded.has(index)) items.push({ key, value, weight: weightOf(value), rows: [index] });
  });
  if (folded.size > 0) {
    const members = [...folded].toSorted((a, b) => a - b);
    const weight = members.reduce((sum, index) => sum + weightOf(rows[index]?.value ?? null), 0);
    items.push({ key: OTHER_KEY, value: sumOf(rows, members), weight, rows: members });
  }
  return items;
}

/** One slice's angles in degrees: its start and end in the sweep's direction, and its pad. */
export type SliceAngles = {
  readonly start: number;
  readonly end: number;
  /** The pad d3's arc takes out of the slice's two seams, in degrees. */
  readonly pad: number;
};

/**
 * Each item's slice in a sweep, through d3's pie with `sort(null)`. Only a finite reading above 0
 * draws, so a zero, missing or negative item takes no arc and no pad, as section 8.2 says. A pie
 * whose drawn readings sum to 0 draws nothing, and a single slice sweeps the whole sweep with no
 * pad. A negative pad overlaps neighbours: each slice but the last runs that far under the next,
 * and the last stops at the sweep's end.
 *
 * @param values - Each item's reading, in sweep order.
 * @param sweep - The sweep.
 * @param padAngle - Degrees between slices, negative to overlap.
 * @returns Each item's slice, or null for an item that draws no arc.
 */
export function pieAngles(
  values: readonly (number | null)[],
  sweep: Sweep,
  padAngle: number
): readonly (SliceAngles | null)[] {
  const drawn = values.flatMap((value, index) => (weightOf(value) > 0 ? [index] : []));
  if (drawn.length === 0) return values.map(() => null);
  const pad = drawn.length === 1 ? 0 : padAngle;
  // d3 scales the sweep by its width over the sum, which overflows to Infinity for a subnormal sum
  // such as 5e-324, so each reading goes in as its share of the largest, which keeps the sum at 1
  // or more and the slices' proportions as they are.
  const largest = Math.max(...drawn.map((index) => weightOf(values[index] ?? null)));
  const arcs = d3Pie<number>()
    .value((value) => value)
    .sort(null)
    .startAngle(toRadians(sweep.start))
    .endAngle(toRadians(sweep.end))
    .padAngle(toRadians(Math.max(0, pad)))(drawn.map((index) => weightOf(values[index] ?? null) / largest));
  const overlap = Math.max(0, -pad) * sweep.direction;
  const slices: (SliceAngles | null)[] = values.map(() => null);
  arcs.forEach((arc, place) => {
    const index = drawn[place];
    if (index === undefined) return;
    const last = place === arcs.length - 1;
    slices[index] = {
      start: toDegrees(arc.startAngle),
      end: toDegrees(arc.endAngle) + (last ? 0 : overlap),
      pad: toDegrees(arc.padAngle),
    };
  });
  return slices;
}

/** What the rim floor measures in: the rim's radius and the seam drawn over each slice edge. */
export type RimFloor = {
  /** The outer radius in CSS pixels. */
  readonly radius: number;
  /** Device pixels per CSS pixel. */
  readonly dpr: number;
  /** The seam stroked along each slice's two edges together, in CSS pixels. */
  readonly seam: number;
};

/**
 * Keep one device pixel of rim between every drawn slice's seams. A slice narrower than that
 * widens to it, and the angle it takes comes from the widest slice, a tie going to the earlier
 * slice, then from the next widest when the widest reaches its own floor. The slices then lie end to
 * end from the first drawn slice's start, so they fill what they filled. Slices all at or above
 * their floor come back unchanged, so a tween's frames paint where the tween put them. A sweep too
 * narrow for every slice's floor gives every drawn slice an equal share. The pick reads these
 * angles, so a pointer finds a slice where it shows.
 *
 * @param slices - Each item's slice, or null for one that draws no arc, in sweep order.
 * @param sweep - The sweep the slices fill.
 * @param floor - The rim's radius, the device pixel ratio and the seam.
 * @returns The floored slices, null where the input is null.
 */
export function floorSlices(
  slices: readonly (SliceAngles | null)[],
  sweep: Sweep,
  floor: RimFloor
): readonly (SliceAngles | null)[] {
  const drawn = slices.flatMap((slice, index) => (slice === null ? [] : [index]));
  // The floored slices run end to end from the first drawn slice's start.
  const first = slices[drawn[0] ?? -1];
  if (first === undefined || first === null || drawn.length < 2 || !(floor.radius > 0) || !(floor.dpr > 0)) {
    return slices;
  }
  // A slice's advance is the rim it shows before the next slice starts, and its overlap the part a
  // negative pad runs under the next, which the floor keeps as it is.
  const advances = slices.map(() => 0);
  const overlaps = slices.map(() => 0);
  drawn.forEach((index, place) => {
    const slice = slices[index];
    if (slice === null || slice === undefined) return;
    const next = slices[drawn[place + 1] ?? -1];
    const advance = Math.abs((next?.start ?? slice.end) - slice.start);
    advances[index] = advance;
    overlaps[index] = Math.abs(slice.end - slice.start) - advance;
  });
  const total = drawn.reduce((sum, index) => sum + (advances[index] ?? 0), 0);
  const least = (index: number): number =>
    Math.max(0, slices[index]?.pad ?? 0) + toDegrees((floor.seam + 1 / floor.dpr) / floor.radius);
  // Nothing under its floor paints where its tween put it, which on a leaving first slice or a
  // reorder is not yet end to end from the sweep's start.
  if (drawn.every((index) => (advances[index] ?? 0) >= least(index))) return slices;
  const needed = drawn.reduce((sum, index) => sum + least(index), 0);
  if (needed > total) {
    for (const index of drawn) advances[index] = total / drawn.length;
  } else {
    let debt = 0;
    for (const index of drawn) {
      const short = least(index) - (advances[index] ?? 0);
      if (short > 0) {
        advances[index] = least(index);
        debt += short;
      }
    }
    while (debt > 1e-12) {
      // The widest slice with angle to spare, the earlier one on a tie.
      let lender = -1;
      for (const index of drawn) {
        const spare = (advances[index] ?? 0) - least(index);
        if (spare <= 1e-12) continue;
        if (lender === -1 || (advances[index] ?? 0) > (advances[lender] ?? 0)) lender = index;
      }
      if (lender === -1) break;
      const give = Math.min(debt, (advances[lender] ?? 0) - least(lender));
      advances[lender] = (advances[lender] ?? 0) - give;
      debt -= give;
    }
  }
  let at = first.start;
  return slices.map((slice, index) => {
    if (slice === null) return null;
    const start = at;
    at += (advances[index] ?? 0) * sweep.direction;
    return { start, end: at + (overlaps[index] ?? 0) * sweep.direction, pad: slice.pad };
  });
}

/**
 * The slice under a pointer's angle, by arithmetic: any point of the cell whose angle lies inside
 * the sweep picks, the hole and the space past the rim included, as CONTRACT section 9.5 makes the
 * cell one target. A slice's range runs from its start to the next drawn slice's start, so a pad
 * picks the slice it belongs to and an overlap picks the slice painted over it.
 *
 * @param angle - The pointer's angle, as `pointerAngle` gives it.
 * @param slices - Each item's slice, or null for one that draws no arc, floored as drawn.
 * @param sweep - The sweep the slices fill.
 * @returns The item's index, or null where no slice lies.
 */
export function sliceAt(angle: number, slices: readonly (SliceAngles | null)[], sweep: Sweep): number | null {
  const offset = angleInSweep(angle, sweep);
  if (offset === null) return null;
  let found: number | null = null;
  let last: number | null = null;
  for (let index = 0; index < slices.length; index += 1) {
    const slice = slices[index];
    if (slice === null || slice === undefined) continue;
    last = index;
    // Slices lie in sweep order, so the last one starting at or before the offset holds it.
    if ((slice.start - sweep.start) * sweep.direction <= offset + 1e-9) found = index;
  }
  // Past the last slice's end, as on a gauge that fills part of its sweep, nothing picks.
  const end = last === null ? undefined : slices[last];
  if (found === last && end !== null && end !== undefined) {
    if ((end.end - sweep.start) * sweep.direction < offset - 1e-9) return null;
  }
  return found;
}

/** A gauge's filled sweep and whether its total passes its maximum. */
export type GaugeFill = { readonly sweep: Sweep; readonly over: boolean };

/**
 * The part of a sweep a gauge's slices fill: the total's share of `max`, never past the full sweep,
 * so a total above its maximum fills the sweep and is over, and nothing laps.
 *
 * @param sweep - The gauge's sweep.
 * @param total - The sum of the drawn readings.
 * @param max - The gauge's maximum, above 0.
 * @returns The filled sweep and whether the total passes the maximum.
 */
export function gaugeFill(sweep: Sweep, total: number, max: number): GaugeFill {
  const share = max > 0 && total > 0 ? Math.min(1, total / max) : 0;
  return {
    sweep: { ...sweep, end: sweep.start + sweep.width * share * sweep.direction, width: sweep.width * share },
    over: total > max,
  };
}
