/**
 * The world model of the chart world browser test, written from the contract and importing no
 * production layout. From a world's inputs and the measured plot it computes every mark's
 * visibility, its `data-outside`, its label membership and its resting device pixels: the zero
 * rule and d3's nice rule for the value domain (sections 8.3 and 8.11), the window (8.12), bands
 * with a 25 % gap (8.15), the path form's columns past 100 categories, the pixel floor, the
 * browser's snap, hairlines, the missing tick, each line vertex and dot on its slot's crosshair
 * column, and above 2,000 categories a brute-force M4 scan (8.12).
 */

/** How far a computed number may stray from what it stands for: styles serialize six decimals. */
export const SERIAL = 1e-5;

/** A reading, or null for a missing one. */
export type Reading = number | null;

/** One category: its name, which keys its marks, and its reading. */
/** One category: its reading of v, and in a stacked world the reading of w stacked over it. */
export type Datum = { readonly name: string; readonly v: Reading; readonly w?: number };

export type Line =
  | { readonly axis: "value"; readonly at: number }
  | { readonly axis: "slot"; readonly name: string };
export type Area =
  | { readonly axis: "value"; readonly from: number; readonly to: number }
  | { readonly axis: "slot"; readonly first: string; readonly last: string };

/** Everything the chart renders from. */
export type World = {
  readonly orientation: "vertical" | "horizontal";
  readonly width: number;
  readonly height: number;
  readonly data: readonly Datum[];
  /** The first and last category of the x range, or null for every category. */
  readonly window: readonly [string, string] | null;
  readonly line: Line;
  readonly area: Area;
  readonly variant: "default" | "striped";
  /** The values `yInclude` keeps in the domain, written inline as a consumer writes it. */
  readonly include: readonly [number, number];
  /** Whether a Line of w stacks over v, in one stack with it, as the dense world's does. */
  readonly stacked?: boolean;
  /**
   * Whether every mark draws in a second Panel, under a Panel that holds only another series' value
   * axis, so each mark reads its Panel's own plot origin, domain, frame and label registry. The
   * Panel takes `yInclude`, and a world with Panels never turns, as Panels stay vertical.
   */
  readonly panelled?: boolean;
};

// The model.

/** d3-array's tickIncrement: a step of 1, 2 or 5 times a power of ten, negative for a fraction. */
export function tickIncrement(start: number, stop: number, count: number): number {
  const step = (stop - start) / Math.max(0, count);
  const power = Math.floor(Math.log10(step));
  const error = step / 10 ** power;
  const factor = error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1;
  return power >= 0 ? factor * 10 ** power : -(10 ** -power) / factor;
}

/** d3-array's nice: widen the bounds to whole steps until the step stops changing. */
export function nice(start: number, stop: number, count: number): [number, number] {
  let low = start;
  let high = stop;
  let previous: number | undefined;
  for (let round = 0; round < 10; round += 1) {
    const step = tickIncrement(low, high, count);
    if (step === previous || step === 0 || !Number.isFinite(step)) break;
    if (step > 0) {
      low = Math.floor(low / step) * step;
      high = Math.ceil(high / step) * step;
    } else {
      low = Math.ceil(low * step) / step;
      high = Math.floor(high * step) / step;
    }
    previous = step;
  }
  return [low, high];
}

/** The window's first and last index into the data. */
export function windowOf(world: World): readonly [number, number] {
  if (world.window === null) return [0, world.data.length - 1];
  const names = world.data.map(({ name }) => name);
  return [names.indexOf(world.window[0]), names.indexOf(world.window[1])];
}

/**
 * The value domain: the readings in the window, in a stacked world each slot's stack, with 0 and
 * `yInclude`, niced to 5 ticks. w is always positive, so it stacks on v's positive part.
 */
export function domainOf(world: World): readonly [number, number] {
  const [first, last] = windowOf(world);
  const values = world.data
    .slice(first, last + 1)
    .flatMap(({ v, w }) => [
      ...(v === null ? [] : [v]),
      ...(w === undefined ? [] : [Math.max(v ?? 0, 0) + w]),
    ]);
  const low = Math.min(0, ...world.include, ...values);
  const high = Math.max(0, ...world.include, ...values);
  if (low === 0 && high === 0) return [0, 1];
  return nice(low, high, 5);
}

/** Whether the bars draw as paths: more than 100 categories on a vertical chart. */
export function pathForm(world: World): boolean {
  return world.orientation === "vertical" && world.data.length > 100;
}

/** The plot as measured: its page position and size along the slot axis and across it. */
export type Plot = {
  readonly dpr: number;
  readonly alongAt: number;
  readonly acrossAt: number;
  readonly along: number;
  readonly across: number;
};

export type Span = readonly [number, number];

/** What the model expects of every mark at rest. */
export type Expected = {
  readonly bars: ReadonlyMap<
    string,
    { readonly along: Span; readonly across: Span; readonly negative: boolean }
  >;
  readonly ticks: ReadonlyMap<string, { readonly along: Span; readonly base: number }>;
  readonly overlay: { readonly along: Span; readonly across: Span } | null;
  readonly line: number | null;
  readonly value: { readonly centre: number; readonly tip: number } | null;
  readonly baseline: number;
  /** The dots on the Line's vertices, one per drawn reading in window order. */
  readonly points: readonly (readonly [along: number, across: number])[];
  /** The Line's vertices, each its dot's point moved by the stroke's parity. */
  readonly vertices: readonly (readonly [along: number, across: number])[];
  /** A stacked world's w Line vertices, or null. */
  readonly upper: readonly (readonly [along: number, across: number])[] | null;
  readonly references: readonly {
    readonly what: string;
    readonly visible: boolean;
    readonly stacked: boolean;
    readonly span: Span;
  }[];
  /** Whether the window decimates, so its columns stand for buckets and match no reading. */
  readonly decimated: boolean;
  /** A decimated window's columns, sorted along the plot then across it, or null for none. */
  readonly columns: readonly { readonly along: Span; readonly across: Span }[] | null;
};

/** The buckets a decimated window splits into, as section 8.12 sets them. */
export const BUCKETS = 500;

/**
 * A decimated window's columns in slot units and values, per section 8.12: the window splits into
 * 500 buckets by slot index, bucket b from ceil(b × n / 500). A loose v draws each bucket from its
 * lowest extent below zero to its highest above. In a stack, each side draws the bucket's slot with
 * the largest stack total on that side, where v's part lies on that side. w draws no Bar.
 */
export function decimatedColumns(
  windowed: readonly Datum[],
  stacked: boolean
): { readonly from: number; readonly to: number; readonly low: number; readonly high: number }[] {
  const count = windowed.length;
  const columns: { from: number; to: number; low: number; high: number }[] = [];
  for (let bucket = 0; bucket < BUCKETS; bucket += 1) {
    const from = Math.ceil((bucket * count) / BUCKETS);
    const to = Math.ceil(((bucket + 1) * count) / BUCKETS);
    const slots = Array.from({ length: to - from }, (_, offset) => from + offset);
    const v = (k: number) => windowed[k]?.v ?? null;
    if (!stacked) {
      const values = slots.flatMap((k) => {
        const value = v(k);
        return value === null ? [] : [value];
      });
      if (values.length === 0) continue;
      const low = Math.min(0, ...values);
      const high = Math.max(0, ...values);
      if (low !== high) columns.push({ from, to, low, high });
      continue;
    }
    for (const negative of [false, true]) {
      // The positive total is v's positive part and w on it, the negative v's negative part.
      const total = (k: number) =>
        negative ? Math.abs(Math.min(0, v(k) ?? 0)) : Math.max(0, v(k) ?? 0) + (windowed[k]?.w ?? 0);
      const best = slots.reduce((pick, k) => (total(k) > (pick === -1 ? 0 : total(pick)) ? k : pick), -1);
      const value = best === -1 ? null : v(best);
      if (value === null || value === 0 || value < 0 !== negative) continue;
      columns.push({ from, to, low: Math.min(0, value), high: Math.max(0, value) });
    }
  }
  return columns;
}

/**
 * How far a 2 px line's centre lies past the device pixel edge its point snaps to: half a device
 * pixel where the stroke covers an odd number of them, so both its edges land on device pixels.
 */
export function lineOffset(dpr: number): number {
  return Math.round(2 * dpr) % 2 === 1 ? 0.5 / dpr : 0;
}

/** Above this many categories in the window, the line and the columns decimate. */
export const DECIMATE_ABOVE = 2000;

/**
 * The two ends each series' vertex draws at a window position: v's value over 0, and in a stacked
 * world w's top over its base, v's positive part. Null where the series has no reading.
 */
export function endsAt(
  datum: Datum | undefined,
  series: "v" | "w"
): readonly [top: number, base: number] | null {
  if (datum === undefined) return null;
  if (series === "v") return datum.v === null ? null : [datum.v, 0];
  if (datum.w === undefined) return null;
  const base = Math.max(datum.v ?? 0, 0);
  return [base + datum.w, base];
}

/**
 * The window positions a decimated line keeps, shared by every series of a stack: in each of
 * `buckets` runs of positions, split as floor(k × buckets / count), the first, last, lowest and
 * highest of each series' top and of its base, a tie keeping the first, both positions of every
 * change between a reading and a missing one or between v's sides of zero in a stack, and the
 * window's two ends.
 */
export function decimatedPositions(
  windowed: readonly Datum[],
  buckets: number,
  stacked: boolean
): Set<number> {
  const count = windowed.length;
  const kept = new Set([0, count - 1]);
  for (const series of stacked ? (["v", "w"] as const) : (["v"] as const)) {
    for (const end of [0, 1] as const) {
      const runs = new Map<number, number[]>();
      windowed.forEach((datum, k) => {
        if (endsAt(datum, series) === null) return;
        const bucket = Math.floor((k * buckets) / count);
        runs.set(bucket, [...(runs.get(bucket) ?? []), k]);
      });
      const read = (k: number) => endsAt(windowed[k], series)?.[end] ?? 0;
      for (const positions of runs.values()) {
        const [head = 0] = positions;
        const low = positions.reduce((best, k) => (read(k) < read(best) ? k : best), head);
        const high = positions.reduce((best, k) => (read(k) > read(best) ? k : best), head);
        for (const k of [head, positions.at(-1) ?? head, low, high]) kept.add(k);
      }
    }
  }
  const kind = (k: number) => {
    const v = windowed[k]?.v ?? null;
    if (v === null) return "missing";
    return stacked && v < 0 ? "negative" : "reading";
  };
  for (let k = 1; k < count; k += 1) {
    if (kind(k) !== kind(k - 1)) {
      kept.add(k - 1);
      kept.add(k);
    }
  }
  return kept;
}

/**
 * The model. The browser draws a coordinate on the device pixel nearest its page position, a tie
 * toward the top left, and a mark's origin on the pixel nearest the plot's.
 */
export function expected(world: World, plot: Plot, active: string | null): Expected {
  const { dpr } = plot;
  const device = 1 / dpr;
  const pixel = (at: number) => (Math.ceil(at * dpr - 0.5 - 1e-6) + 0) / dpr;
  const snapAlong = (at: number) => pixel(plot.alongAt + at) - pixel(plot.alongAt);
  const snapAcross = (at: number) => pixel(plot.acrossAt + at) - pixel(plot.acrossAt);
  // The pixel floor: a span wider than zero keeps a device pixel, the one its middle lies in, inside
  // the plot and inside any container.
  const floor = (axis: "along" | "across", start: number, end: number, within?: Span): Span => {
    const snap = axis === "along" ? snapAlong : snapAcross;
    const origin = axis === "along" ? plot.alongAt : plot.acrossAt;
    const from = snap(start);
    const to = snap(end);
    if (to > from || end <= start) return [from, to];
    const before = origin + (start + end) / 2 < pixel(origin) + from;
    const [low, high] = within ?? [0, snap(axis === "along" ? plot.along : plot.across)];
    const kept =
      (before && from - device >= low - SERIAL) || from + device > high + SERIAL ? from - device : from;
    const shifted = Math.min(Math.max(kept, low), Math.max(low, high - device));
    return [shifted, shifted + device];
  };
  const vertical = world.orientation === "vertical";
  const [lo, hi] = domainOf(world);
  const valueAt = (v: number) =>
    vertical ? (plot.across * (hi - v)) / (hi - lo) : (plot.across * (v - lo)) / (hi - lo);
  const [first, last] = windowOf(world);
  const count = last - first + 1;
  const step = plot.along / count;
  const band = (k: number) => floor("along", k * step, (k + 1) * step);
  const barAlong = (k: number) => floor("along", (k + 0.125) * step, (k + 0.875) * step, band(k));
  const baseline = snapAcross(valueAt(0));
  const hairline = Math.max(1, Math.floor(dpr)) / dpr;
  const path = pathForm(world);
  const windowed = world.data.slice(first, last + 1);
  const empty = windowed.every(({ v }) => v === null);
  const tipOf = (v: number) => snapAcross(valueAt(v));
  const bars = new Map<string, { along: Span; across: Span; negative: boolean }>();
  const ticks = new Map<string, { along: Span; base: number }>();
  windowed.forEach(({ name, v }, k) => {
    if (v === null) {
      if (empty) return;
      const along = path ? floor("along", (k + 0.25) * step, (k + 0.75) * step, band(k)) : barAlong(k);
      ticks.set(name, { along, base: baseline });
      return;
    }
    // A column of the path form draws only where it has length.
    if (path && v === 0) return;
    const tip = tipOf(v);
    bars.set(name, {
      along: barAlong(k),
      across: [Math.min(baseline, tip), Math.max(baseline, tip)],
      negative: v < 0,
    });
  });
  const activeIndex = active === null ? -1 : windowed.findIndex(({ name }) => name === active);
  const activeReading = windowed[activeIndex]?.v ?? null;
  const overlay =
    activeReading === null
      ? null
      : {
          along: barAlong(activeIndex),
          across: [
            Math.min(baseline, tipOf(activeReading)),
            Math.max(baseline, tipOf(activeReading)),
          ] as const,
        };
  // ActiveValue shows the active reading, or the window's last one while nothing is active.
  const lastIndex = windowed.findLastIndex(({ v }) => v !== null);
  const shownIndex = active === null ? lastIndex : activeIndex;
  const shown = windowed[shownIndex]?.v ?? null;
  // ActiveValue centres over its bar's middle: an element bar's drawn span, or a column's own span
  // in the path form, whose middle is the slot's unsnapped centre. A decimated column stands for a
  // bucket, so there the value takes its slot's snapped centre.
  const valueCentre = (k: number) => {
    if (!path) {
      const [start, end] = barAlong(k);
      return (start + end) / 2;
    }
    return count > DECIMATE_ABOVE ? snapAlong((k + 0.5) * step) : (k + 0.5) * step;
  };
  const value = shown === null ? null : { centre: valueCentre(shownIndex), tip: tipOf(shown) };
  const names = world.data.map(({ name }) => name);
  const references: { what: string; visible: boolean; stacked: boolean; span: Span }[] = [];
  const { line, area } = world;
  if (line.axis === "value") {
    const at = valueAt(line.at);
    const visible = at >= 0 && at <= plot.across;
    const edge = snapAcross(at);
    references.push({ what: "line", visible, stacked: visible && vertical, span: [edge, edge + hairline] });
  } else {
    const k = names.indexOf(line.name) - first;
    const centre = (k + 0.5) * step;
    const visible = centre >= 0 && centre <= plot.along;
    const [start, end] = visible ? band(k) : [0, 0];
    const width = Math.min(hairline, end - start);
    const at = Math.min(Math.max(snapAlong(centre), start), end - width);
    references.push({ what: "line", visible, stacked: false, span: [at, at + width] });
  }
  if (area.axis === "value") {
    const [a, b] = [valueAt(area.from), valueAt(area.to)];
    const low = Math.max(Math.min(a, b), 0);
    const high = Math.min(Math.max(a, b), plot.across);
    const visible = low < high;
    references.push({
      what: "area",
      visible,
      stacked: visible && vertical,
      span: visible ? floor("across", low, high) : [0, 0],
    });
  } else {
    const ka = names.indexOf(area.first) - first;
    const kb = names.indexOf(area.last) - first;
    const low = Math.max(Math.min(ka, kb) * step, 0);
    const high = Math.min((Math.max(ka, kb) + 1) * step, plot.along);
    const visible = low < high;
    references.push({
      what: "area",
      visible,
      stacked: false,
      span: visible ? floor("along", low, high) : [0, 0],
    });
  }
  const activeLine = activeReading === null ? null : tipOf(activeReading);
  const decimated = count > DECIMATE_ABOVE;
  const stacked = world.stacked === true;
  const drawn = decimated ? decimatedPositions(windowed, Math.round(plot.along), stacked) : null;
  // A point mark sits on the centre of its slot's line crosshair column, at its bar's tip.
  const points = windowed.flatMap(({ v }, k) => {
    if (v === null || (drawn !== null && !drawn.has(k))) return [];
    const [start, end] = band(k);
    const width = Math.min(hairline, end - start);
    const at = Math.min(Math.max(snapAlong((k + 0.5) * step), start), end - width);
    return [[at + width / 2, tipOf(v)] as const];
  });
  const offset = lineOffset(dpr);
  const vertices = points.map(([along, across]) => [along, across + offset] as const);
  // A stacked world's w line passes through each drawn slot at its stack's top.
  const upper = !stacked
    ? null
    : windowed.flatMap((datum, k) => {
        const ends = endsAt(datum, "w");
        if (ends === null || (drawn !== null && !drawn.has(k))) return [];
        const [start, end] = band(k);
        const width = Math.min(hairline, end - start);
        const at = Math.min(Math.max(snapAlong((k + 0.5) * step), start), end - width);
        return [[at + width / 2, tipOf(ends[0]) + offset] as const];
      });
  return {
    bars,
    ticks,
    overlay,
    line: activeLine,
    value,
    baseline,
    references,
    points,
    vertices,
    upper,
    decimated,
    // A column keeps a pixel among the pixels of the slot its middle lies in, as a bar does.
    columns: !decimated
      ? null
      : decimatedColumns(windowed, stacked)
          .map(({ from, to, low, high }) => {
            const middle = Math.min(Math.max(Math.floor((from + to) / 2), 0), count - 1);
            const across: Span = [snapAcross(valueAt(high)), snapAcross(valueAt(low))];
            return { along: floor("along", from * step, to * step, band(middle)), across };
          })
          .toSorted((a, b) => a.along[0] - b.along[0] || a.across[0] - b.across[0]),
  };
}

/**
 * Whether a data update certainly relays the plot, from the rule review round 12 states: it switches
 * the bars' form, or it mounts an element-form bar or missing tick while the value domain moves. A
 * mount while a tween still runs relays it too, which the run accepts from what it draws.
 */
export function relays(before: World, after: World): boolean {
  if (pathForm(before) !== pathForm(after)) return true;
  // Path-form columns route a reading that arrives, as the line's vertices do.
  if (pathForm(after)) return false;
  const [lowBefore, highBefore] = domainOf(before);
  const [low, high] = domainOf(after);
  if (lowBefore === low && highBefore === high) return false;
  const kinds = (world: World) => {
    const [first, last] = windowOf(world);
    return new Map(
      world.data.slice(first, last + 1).map(({ name, v }) => [name, v === null ? "missing" : "reading"])
    );
  };
  const was = kinds(before);
  return [...kinds(after)].some(([name, kind]) => was.get(name) !== kind);
}

/** A span as text, for a failure message. */
export const show = (span: Span) => `${String(span[0])}–${String(span[1])}`;
