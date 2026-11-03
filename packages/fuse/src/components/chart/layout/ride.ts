/**
 * A point mark that rides its series' drawn line. The line's path data, as its writer wrote it,
 * flattens into runs of points along the slot axis, one run per subpath, so a gap in the line, or a
 * lone reading's dot, splits the runs. A glide along a run springs along the slot axis, as the
 * crosshair does, and takes its offset across from the run at each place, so it follows every curve,
 * dip and step riser the line draws. Its keyframes start from every vertex of the run the glide
 * crosses, then drop each vertex the straight move past it stays within `TOLERANCE` of.
 */
/** One run of a line: the points along it, `along` never falling, and the offset across at each. */
export type Run = { readonly along: Float64Array; readonly across: Float64Array };

/** A drawn line's runs, in the order its path draws them. */
export type Track = readonly Run[];

/** A place on a glide's course, as offsets from where the mark rests. */
export type RideKeyframe = { readonly offset: number; readonly along: number; readonly across: number };

/**
 * How far a keyframe's straight move may stray from the course, in CSS pixels, which leaves the
 * mark within a pixel of the line and of the crosshair.
 */
const TOLERANCE = 0.5;

/** How far apart the points of a flattened curve lie along it, at most, in CSS pixels. */
const CURVE_STEP = 2;

/** A command letter or a number of path data. */
const TOKEN = /[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gu;

const COMMAND = /^[A-Za-z]$/u;

/**
 * The runs of a line's path data, as `line-path.ts` and d3-shape write it: absolute M, L, C and Z.
 * A Line's path holds one subpath per run of readings. An Area's holds its top edge first, then its
 * base back, so only the stretch before the path turns back counts. A subpath with any other
 * command, such as the arcs of a lone reading's dot, holds no run.
 *
 * @param data - The path's `d`.
 * @param orientation - Root's orientation, which names the slot axis.
 * @returns The runs, in plot pixels.
 */
export function parseTrack(data: string, orientation: "vertical" | "horizontal"): Track {
  const tokens = data.match(TOKEN) ?? [];
  const runs: Run[] = [];
  let points: [number, number][] = [];
  let usable = true;
  let at: [number, number] = [0, 0];
  let command = "";
  let index = 0;
  const read = (): number => Number(tokens[index++]);
  const close = (): void => {
    if (usable) {
      const run = runOf(points, orientation);
      if (run !== null) runs.push(run);
    }
    points = [];
    usable = true;
  };
  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (COMMAND.test(token)) {
      command = token;
      index += 1;
      if (command === "M") close();
      if (command === "Z") {
        close();
        continue;
      }
      if (!"MLC".includes(command)) {
        usable = false;
        // Skip the command's numbers.
        while (index < tokens.length && !COMMAND.test(tokens[index] ?? "")) index += 1;
        continue;
      }
    }
    if (command === "M" || command === "L") {
      at = [read(), read()];
      points.push(at);
      // Pairs after M are lines to, as SVG reads them.
      if (command === "M") command = "L";
    } else if (command === "C") {
      const from = at;
      const one: [number, number] = [read(), read()];
      const two: [number, number] = [read(), read()];
      const to: [number, number] = [read(), read()];
      const reach =
        Math.hypot(one[0] - from[0], one[1] - from[1]) +
        Math.hypot(two[0] - one[0], two[1] - one[1]) +
        Math.hypot(to[0] - two[0], to[1] - two[1]);
      const steps = Math.max(2, Math.ceil(reach / CURVE_STEP));
      for (let step = 1; step <= steps; step += 1) points.push(cubic(from, one, two, to, step / steps));
      at = to;
    } else {
      index += 1;
    }
  }
  close();
  return runs;
}

/**
 * The runs through lists of points, such as the far ends of a series' bars, each list one run
 * between gaps, in the order the points draw.
 *
 * @param runs - Each run's points as x and y in plot pixels.
 * @param orientation - Root's orientation, which names the slot axis.
 * @returns The runs, without those of a single point.
 */
export function trackOf(
  runs: readonly (readonly (readonly [number, number])[])[],
  orientation: "vertical" | "horizontal"
): Track {
  return runs.flatMap((points) => runOf(points, orientation) ?? []);
}

/** A point on a cubic Bézier curve. */
function cubic(
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
  d: readonly [number, number],
  t: number
): [number, number] {
  const u = 1 - t;
  const [wa, wb, wc, wd] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [wa * a[0] + wb * b[0] + wc * c[0] + wd * d[0], wa * a[1] + wb * b[1] + wc * c[1] + wd * d[1]];
}

/**
 * A subpath's points as a run, `along` never falling. A curve that bends back along the slot axis,
 * as a natural spline can between readings that share a column, leaves its backward stretch out:
 * the run climbs straight from where it turned to where the curve crosses that place again, and
 * goes on from there. A mark that rides it, whose place along the crosshair fixes, stays on the
 * drawn curve at every place it reaches. A run that runs against the slot axis, as in a
 * right-to-left plot, is read backwards.
 */
function runOf(
  points: readonly (readonly [number, number])[],
  orientation: "vertical" | "horizontal"
): Run | null {
  const pairs = points.map(([x, y]) => (orientation === "vertical" ? ([x, y] as const) : ([y, x] as const)));
  const first = pairs[0];
  const last = pairs.at(-1);
  if (first === undefined || last === undefined || first[0] === last[0]) return null;
  const ordered = last[0] > first[0] ? pairs : pairs.toReversed();
  const along: number[] = [];
  const across: number[] = [];
  let reach = Number.NEGATIVE_INFINITY;
  let before: readonly [number, number] | null = null;
  for (const pair of ordered) {
    if (pair[0] >= reach) {
      // Back where the curve turned: climb to where it crosses that place again.
      if (before !== null && before[0] < reach) {
        const share = (reach - before[0]) / (pair[0] - before[0]);
        along.push(reach);
        across.push(before[1] + (pair[1] - before[1]) * share);
      }
      along.push(pair[0]);
      across.push(pair[1]);
      reach = pair[0];
    }
    before = pair;
  }
  return { along: Float64Array.from(along), across: Float64Array.from(across) };
}

/**
 * The run a mark rides from one place to another: the run each place lies on, nearest across where
 * several runs reach it, so two runs that only touch at one place across a gap stay apart. It is
 * null when the two places lie on different runs, or either lies past every run.
 *
 * @param track - The line's runs.
 * @param from - Where the mark starts.
 * @param to - Where it rests.
 * @returns The run, or null.
 */
export function runBetween(track: Track, from: RidePlace, to: RidePlace): Run | null {
  const start = runAt(track, from);
  return start !== null && start === runAt(track, to) ? start : null;
}

/** The run that reaches a place along the slot axis and lies nearest it across, or null. */
function runAt(track: Track, place: RidePlace): Run | null {
  let nearest: Run | null = null;
  let least = Number.POSITIVE_INFINITY;
  for (const run of track) {
    if ((run.along[0] ?? 0) > place.along + 0.5 || (run.along.at(-1) ?? 0) < place.along - 0.5) continue;
    const away = Math.abs(offRun(run, place));
    if (away < least) {
      least = away;
      nearest = run;
    }
  }
  return nearest;
}

/**
 * The offset across a run at a place along it. On a riser, where the run climbs at one place, it is
 * the riser's end nearer the run's start, and any place past the riser is on its far side.
 *
 * @param run - The run.
 * @param along - The place along the slot axis, held to the run's ends.
 * @returns The offset across, in plot pixels.
 */
export function acrossAt(run: Run, along: number): number {
  const { along: places, across } = run;
  const last = places.length - 1;
  if (along <= (places[0] ?? 0)) return across[0] ?? 0;
  if (along >= (places[last] ?? 0)) return across[last] ?? 0;
  let low = 0;
  let high = last;
  // The first point at or past the place.
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((places[middle] ?? 0) < along) low = middle + 1;
    else high = middle;
  }
  const after = places[low] ?? 0;
  const before = places[low - 1] ?? after;
  const share = after === before ? 1 : (along - before) / (after - before);
  return (across[low - 1] ?? 0) + ((across[low] ?? 0) - (across[low - 1] ?? 0)) * share;
}

/** A place on a ride, as offsets from where the mark rests along and across the slot axis. */
export type RidePlace = { readonly along: number; readonly across: number };

/**
 * What a ride follows: its offset across at each offset along, and the run's vertices as offsets,
 * in the run's order, a riser's two ends both listed.
 */
export type RideCourse = {
  readonly at: (along: number) => number;
  readonly vertices: readonly RidePlace[];
};

/**
 * The course of a mark that rides a run from where it shows to where it rests. It follows the run,
 * and a mark that sits off the run at either end, as on a curve that passes beside its readings,
 * eases from its offset at the start to its offset at rest in step with the way along.
 *
 * @param run - The run the mark rides.
 * @param start - Where the mark shows, in plot pixels along and across the slot axis.
 * @param rest - Where it rests.
 * @returns The course, in offsets from rest.
 */
export function rideCourse(run: Run, start: RidePlace, rest: RidePlace): RideCourse {
  const reach = start.along - rest.along;
  const offStart = offRun(run, start);
  const offRest = offRun(run, rest);
  const off = (along: number) => offRest + (reach === 0 ? 0 : ((offStart - offRest) * along) / reach);
  return {
    at: (along) => (along === 0 ? 0 : acrossAt(run, rest.along + along) + off(along) - rest.across),
    vertices: Array.from(run.along, (place, index) => {
      const along = place - rest.along;
      return { along, across: (run.across[index] ?? 0) + off(along) - rest.across };
    }),
  };
}

/** How far apart along the slot axis two vertices may lie and still stand in one stack, in pixels. */
const STACKED = 1e-3;

/**
 * How far a place lies across from a run where it sits along it: 0 anywhere on a stack, the
 * vertical stretch a run draws where several of its vertices share one place along the slot axis,
 * as a decimated column's do.
 */
function offRun(run: Run, place: RidePlace): number {
  let low = acrossAt(run, place.along);
  let high = low;
  run.along.forEach((along, index) => {
    if (Math.abs(along - place.along) > STACKED) return;
    const across = run.across[index] ?? low;
    low = Math.min(low, across);
    high = Math.max(high, across);
  });
  if (place.across < low) return place.across - low;
  return place.across > high ? place.across - high : 0;
}

/**
 * The keyframes of a glide from `from` CSS pixels along the slot axis back to rest, along a course.
 * The glide plays them on its spring's easing scaled down by `peak`, the most the spring passes its
 * target by, so a keyframe's offset times `peak` is the share of the way along the slot axis. The
 * mark then moves along x exactly as a two-keyframe glide on the spring's own easing does, and its
 * overshoot past rest follows the course too. The keyframes are the start, every vertex of the
 * course the glide crosses, rest and the overshoot's far end, less each one the straight move past
 * it keeps within `TOLERANCE`. A riser stays two keyframes at one offset, so the mark climbs it at
 * once. Where the start or rest sits on a stack, several vertices at one place along the slot axis
 * as a decimated column draws them, the mark climbs the stack straight to rest, or leaves it from
 * its last vertex, and holds its height through an overshoot past a stack at rest.
 *
 * @param from - The offset along the slot axis the glide starts at.
 * @param course - The course it rides.
 * @param peak - The spring's peak share of the way, 1 or more.
 * @returns Keyframes from the start through rest to the overshoot's far end, at offsets from 0 to 1.
 */
export function rideKeyframes(from: number, course: RideCourse, peak = 1): RideKeyframe[] {
  const end = from * (1 - peak);
  const forward = from < end;
  const [low, high] = forward ? [from, end] : [end, from];
  const stacked = (along: number, at: number) => Math.abs(along - at) <= STACKED;
  // A glide from below rest crosses the vertices in the run's order, and one from above in reverse.
  const ordered = forward ? course.vertices : course.vertices.toReversed();
  const crossed = ordered.filter(
    ({ along }) => along > low && along < high && !stacked(along, from) && !stacked(along, 0)
  );
  // A stack at the start or at rest is one vertical stretch of the line. The mark leaves the start's
  // stack from its last vertex, reaches rest's stack at its first, and climbs it straight to rest.
  // A lone vertex at either end is no stack, only a corner the course turns at.
  const startStack = ordered.filter(({ along }) => stacked(along, from));
  const restStack = ordered.filter(({ along }) => stacked(along, 0));
  const leaves = startStack.length > 1 ? startStack.at(-1) : undefined;
  const arrives = restStack.length > 1 ? restStack[0] : undefined;
  const places: RidePlace[] = [{ along: from, across: course.at(from) }];
  if (leaves !== undefined) places.push({ along: from, across: leaves.across });
  let rest = -1;
  const reachRest = (): void => {
    if (arrives !== undefined) places.push({ along: 0, across: arrives.across });
    rest = places.length;
    places.push({ along: 0, across: 0 });
  };
  for (const place of crossed) {
    if (rest === -1 && (forward ? place.along > 0 : place.along < 0)) reachRest();
    places.push(place);
  }
  if (rest === -1) reachRest();
  // Past a stack at rest the mark holds its height, as the run turns back down the stack there. At
  // the track's last point it holds there outright, as nothing lies past it to ride.
  const last = !course.vertices.some(({ along }) => (forward ? along > STACKED : along < -STACKED));
  if (end !== 0) {
    places.push(
      last ? { along: 0, across: 0 } : { along: end, across: arrives === undefined ? course.at(end) : 0 }
    );
  }
  const offset = (along: number) => (from === 0 ? 1 : (1 - along / from) / peak);
  const kept = simplified(places, rest);
  return kept.map(({ along, across }, index) => ({
    // The held end comes at the overshoot's far end, though it stays at rest.
    offset: index === kept.length - 1 && end !== 0 ? 1 : Math.min(1, Math.max(0, offset(along))),
    along,
    across,
  }));
}

/**
 * Where a glide's keyframes put the mark at a share of their way, as the animation plays them: a
 * straight move between the two keyframes around it.
 *
 * @param frames - The keyframes, at offsets from 0 to 1.
 * @param offset - The share of the way, held to 0 and 1.
 * @returns The offsets along and across.
 */
export function rideAt(frames: readonly RideKeyframe[], offset: number): RidePlace {
  const share = Math.min(1, Math.max(0, offset));
  const after = frames.findIndex((frame) => frame.offset > share);
  const end = frames[after === -1 ? frames.length - 1 : after];
  const start = frames[after === -1 ? frames.length - 1 : Math.max(0, after - 1)];
  if (start === undefined || end === undefined) return { along: 0, across: 0 };
  const part = end.offset === start.offset ? 1 : (share - start.offset) / (end.offset - start.offset);
  return {
    along: start.along + (end.along - start.along) * part,
    across: start.across + (end.across - start.across) * part,
  };
}

/**
 * The places a polyline keeps when each one it drops lies within `TOLERANCE` across of the straight
 * move between the two kept places around it, its ends and one pinned place always kept.
 */
function simplified(places: readonly RidePlace[], pinned: number): RidePlace[] {
  if (places.length <= 2) return [...places];
  const kept = new Uint8Array(places.length);
  kept[0] = 1;
  kept[places.length - 1] = 1;
  kept[pinned] = 1;
  const spans: [number, number][] =
    pinned > 0 && pinned < places.length - 1
      ? [
          [0, pinned],
          [pinned, places.length - 1],
        ]
      : [[0, places.length - 1]];
  for (let span = spans.pop(); span !== undefined; span = spans.pop()) {
    const [first, last] = span;
    let farthest = -1;
    let distance = TOLERANCE;
    for (let index = first + 1; index < last; index += 1) {
      const away = offSegment(places[index], places[first], places[last]);
      if (away > distance) {
        distance = away;
        farthest = index;
      }
    }
    if (farthest === -1) continue;
    kept[farthest] = 1;
    spans.push([first, farthest], [farthest, last]);
  }
  return places.filter((_, index) => kept[index] === 1);
}

/**
 * How far a place lies across from the straight move between two others, at its own place along:
 * the error a mark shows there, since the crosshair fixes its place along. A move that stays at one
 * place along spans the offsets across between its ends.
 */
function offSegment(
  place: RidePlace | undefined,
  a: RidePlace | undefined,
  b: RidePlace | undefined
): number {
  if (place === undefined || a === undefined || b === undefined) return 0;
  if (a.along === b.along) {
    const [low, high] = a.across < b.across ? [a.across, b.across] : [b.across, a.across];
    return place.across < low ? low - place.across : Math.max(0, place.across - high);
  }
  const share = (place.along - a.along) / (b.along - a.along);
  return Math.abs(place.across - (a.across + (b.across - a.across) * share));
}
