/**
 * The floor oracle's scenario model and its walkers, which chart-floor.browser.test.tsx drives:
 * each random dense chart's readings, and for every SVG mark FLOOR_MARKS lists, a walker that reads
 * the mark off the page and hands its spans to the walk's checks. The walks hold no expectations
 * of their own beyond the counts each mark kind must reach.
 */
import { expect } from "vitest";

import type { ChartBarVariant } from "../../src/components/chart/chart-types";
import { drawnRect } from "./bar-box";
import type { FloorMark } from "./floor-marks";
import { pathRects } from "./world-reader";

/** How far a computed style may stray from what it stands for: it serializes six decimals. */
export const SERIAL = 1e-5;

/** Above this many slots the path form draws one column per M4 bucket, per section 8.12. */
export const DECIMATE_ABOVE = 2000;

/** The buckets a decimated window splits into, slot b × n / 500 rounded up starting bucket b. */
const BUCKETS = 500;

/** One random dense chart and the guides drawn on it. */
export type Dense = {
  readonly count: number;
  readonly length: number;
  readonly group: number;
  readonly variant: ChartBarVariant;
  readonly orientation: "vertical" | "horizontal";
  readonly missing: readonly boolean[];
  readonly offset: number;
  readonly crosshair: "band" | "line";
  /** The step line's look: the default 2 px stroke or the quiet 1 px one. */
  readonly stroke: "default" | "quiet";
  /** The line's step: from cell edge to cell edge, or d3's, rising halfway between two vertices. */
  readonly curve: "step-after" | "step";
  /** The active slot: the first or the last. */
  readonly last: boolean;
  /**
   * Whether every fifth reading is far under a device pixel or 0: by slot, 0, +0.001 or -0.001.
   */
  readonly small: boolean;
  /**
   * Whether the first series reads 1e15 at slot 1 and every other reading a thousandth of its own,
   * so every other reading projects onto its base exactly, and so does every decimated column but
   * the peak's.
   */
  readonly peak: boolean;
  /** What the bars emphasise: each series' maximum, or each of its readings under 1. */
  readonly emphasis: "max" | "small";
  /**
   * Whether a chart of one series stacks it on a series of zeros, so its bars, columns, emphasis
   * boxes and active overlay take their floor through the stack floors as the stack's outer
   * segment, the only one with length, which floors as a loose bar does.
   */
  readonly stacked: boolean;
  /** The slot a slot reference line marks, and the first and last slot of a slot area. */
  readonly line: number;
  readonly from: number;
  readonly span: number;
  /**
   * Whether every mark draws in a second Panel, under a first Panel of other bars, so the walk
   * reads the lower Panel's own plot origin. Only a vertical chart takes Panels.
   */
  readonly panels: boolean;
};

/**
 * A reading of 1 to 4 for a series at a slot, the same in the chart and in the oracle. A small
 * chart reads 0, 0.001 or -0.001 at every fifth, under a quarter of a device pixel on any plot
 * here. A peaked one reads 1e15 at the first series' slot 1 and a thousandth of the rest.
 */
export function reading(slot: number, series: number, chart: Pick<Dense, "small" | "peak">): number {
  if (chart.peak && slot === 1 && series === 0) return 1e15;
  const scale = chart.peak ? 1e-3 : 1;
  if (chart.small && (slot + series) % 5 === 0) return ([0, 0.001, -0.001][slot % 3] ?? 0) * scale;
  return (1 + ((slot + series) % 4)) * scale;
}

/** Whether a slot's readings are missing: where the list says, but never a peaked chart's peak. */
export function missingAt(chart: Pick<Dense, "missing" | "peak">, slot: number): boolean {
  return chart.missing[slot] === true && !(chart.peak && slot === 1);
}

/** The horizontal ticks of a path, each as its start and end x. */
function pathTicks(d: string): [number, number][] {
  return [...d.matchAll(/M([-\d.e]+) [-\d.e]+H([-\d.e]+)/gu)].map(([, x, x2]) => [Number(x), Number(x2)]);
}

/** The points of a path written with M and L commands, as x and y, in order, by subpath. */
function pathPoints(d: string): (readonly [number, number])[][] {
  return d
    .split("M")
    .filter((part) => part !== "")
    .map((part) =>
      [...part.matchAll(/(-?[\d.e]+),(-?[\d.e]+)/gu)].map(([, x, y]) => [Number(x), Number(y)] as const)
    );
}

/** A span along one axis, in CSS or device pixels as its reader says. */
export type Span = readonly [number, number];

/** A mark's box in CSS pixels from its plot's top left. */
type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** What every walker reads: the plot's drawn origin and size, the slots, and the checks. */
export type Walk = {
  readonly host: HTMLElement;
  readonly chart: Dense;
  readonly vertical: boolean;
  readonly layers: readonly Element[];
  readonly present: readonly number[];
  readonly absent: readonly number[];
  readonly active: number;
  /** The along and across spans of a box. */
  readonly along: (rect: Box) => Span;
  readonly across: (rect: Box) => Span;
  /** Check a mark of slots inside the device pixels the slots cover, a device pixel wide at least. */
  readonly inSlots: (what: string, first: number, last: number, span: Span) => void;
  /**
   * Check a stroked step run of one slot, its two riser places in CSS pixels from the plot: each
   * riser's stroke, `width` CSS pixels wide around its place, covers whole device pixels, and the
   * run, less the half device pixel an odd stroke moves past its cell edges, covers its slot's
   * device pixels, so an odd riser at a cell edge lies inside the band of the run it starts.
   */
  readonly stroked: (what: string, slot: number, run: Span, width: number) => void;
  /**
   * Check a plain step's riser between two neighbouring slots, its place in CSS pixels from the
   * plot: its stroke covers whole device pixels, and its place, less the half device pixel an odd
   * stroke moves, lies among the two slots' device pixels.
   */
  readonly riser: (left: number, right: number, at: number, width: number) => void;
  /** Check a mark of the value axis inside the plot along it. */
  readonly inPlot: (what: string, span: Span) => void;
  /**
   * Check a body of a reading along the value axis: one device pixel or more, inside the plot, its
   * base on the zero rule and its far edge on the reading's side of it, or flat on the zero rule
   * for a reading of 0.
   */
  readonly valued: (what: string, value: number, span: Span) => void;
  /** The reading of a series at a slot, as the chart reads it. */
  readonly read: (slot: number, series: number) => number;
  /** The zero rule's near edge along the value axis, in CSS pixels from the plot, or null. */
  readonly zero: number | null;
  /**
   * Check a rule's thickness, its edges across it in CSS pixels from the plot on the x or y axis:
   * both edges on device pixels, and 1 px rounded down to whole device pixels wide, at least one.
   * A rule of slots may be narrower, down to one device pixel, where its band is.
   */
  readonly crisp: (what: string, axis: "x" | "y", span: Span, width: "hairline" | "slot") => void;
  /** Check that a label centres on a rule's centre, both in page pixels along one axis. */
  readonly centred: (what: string, label: number, rule: number) => void;
};

function box(element: Element): Box {
  if (element.tagName === "polygon") return drawnRect(element);
  return {
    x: Number(element.getAttribute("x")),
    y: Number(element.getAttribute("y")),
    width: Number(element.getAttribute("width")),
    height: Number(element.getAttribute("height")),
  };
}

/** A line's endpoints as a box, which its stroke widens by half the stroke's width each side. */
export function ruleBox(line: Element): Box {
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = ["x1", "y1", "x2", "y2"].map((name) =>
    Number(line.getAttribute(name))
  );
  const stroke = Number.parseFloat(getComputedStyle(line).strokeWidth);
  return x1 === x2
    ? { x: x1 - stroke / 2, y: Math.min(y1, y2), width: stroke, height: Math.abs(y2 - y1) }
    : { x: Math.min(x1, x2), y: y1 - stroke / 2, width: Math.abs(x2 - x1), height: stroke };
}

/** A line's thickness: the axis it lies across and its edges on it, from `ruleBox`. */
function thickness(line: Element, rule: Box): ["x" | "y", Span] {
  return line.getAttribute("x1") === line.getAttribute("x2")
    ? ["x", [rule.x, rule.x + rule.width]]
    : ["y", [rule.y, rule.y + rule.height]];
}

/** A label's centre on the page along an axis, and a rule's centre in its own SVG's page box. */
function labelCentre(label: Element, axis: "x" | "y"): number {
  const rect = label.getBoundingClientRect();
  return axis === "x" ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
}

function ruleCentre(line: Element, axis: "x" | "y"): number {
  const svg = line.closest("svg")?.getBoundingClientRect() ?? new DOMRect();
  return axis === "x"
    ? svg.left + Number(line.getAttribute("x1"))
    : svg.top + Number(line.getAttribute("y1"));
}

/** Walk each mark kind, and return how many marks of it the walk checked. */
type Walker = (walk: Walk) => number;

/** The slots a series emphasises: its maxima, or each present slot of a reading under 1. */
function emphasised(walk: Walk, series: number): number[] {
  if (walk.chart.emphasis === "max") return maxima(walk, series);
  return walk.present.filter((slot) => Math.abs(walk.read(slot, series)) < 1);
}

/** Every present slot of a series' largest reading, as `emphasis="max"` and a Marker pick it. */
function maxima(walk: Walk, series: number): number[] {
  const top = Math.max(...walk.present.map((slot) => walk.read(slot, series)));
  return walk.present.filter((slot) => walk.read(slot, series) === top);
}

/** The bars of a layer in slot order, in the element form. */
function barsOf(layer: Element): Element[] {
  // DOM audit: the marks group's children are the bars, aria-hidden plot output.
  const marks = layer.querySelector('[data-slot="chart-bar-marks"]');
  return [...(marks?.children ?? [])].filter(
    (child) =>
      child.getAttribute("data-slot") === "chart-bar" ||
      (child.tagName === "g" &&
        [...child.children].some((part) => part.getAttribute("data-slot") === "chart-bar"))
  );
}

/**
 * Walk a decimated window's columns, per section 8.12. A loose series draws one column per bucket
 * whose present readings reach either side of zero, from the lowest extent to the highest, which
 * stands for its larger extreme, so it grows from the zero rule that extreme's way. A stacked one
 * draws one column per side of zero, from zero to the reading of the bucket's first slot that
 * reaches farthest that way, the positive column above the negative one.
 */
function decimatedColumns(walk: Walk, series: number, columns: readonly Box[]): number {
  const { count, stacked } = walk.chart;
  const present = new Set(walk.present);
  const expected = Array.from({ length: BUCKETS }, (_, bucket) => {
    const from = Math.ceil((bucket * count) / BUCKETS);
    const to = Math.ceil(((bucket + 1) * count) / BUCKETS);
    const values = Array.from({ length: to - from }, (_, offset) => from + offset)
      .filter((slot) => present.has(slot))
      .map((slot) => walk.read(slot, series));
    if (!stacked) {
      const [low, high] = [Math.min(0, ...values), Math.max(0, ...values)];
      return low === high ? [] : [{ from, to, value: -low > high ? low : high }];
    }
    const farthest = (sign: 1 | -1) =>
      values.reduce((best, value) => (value * sign > best * sign ? value : best), 0);
    return [farthest(1), farthest(-1)].filter((value) => value !== 0).map((value) => ({ from, to, value }));
  }).flat();
  // A stacked bucket's two columns share their span, and buckets narrower than a device pixel
  // share pixel columns, so the walk pairs each side's columns with that side's buckets in order.
  const zeroAt = walk.zero ?? 0;
  const sideOf = (rect: Box) => (rect.y + rect.height <= zeroAt + SERIAL ? 1 : -1);
  const drawn = columns.toSorted((a, b) => a.x - b.x);
  for (const sign of stacked ? ([1, -1] as const) : ([0] as const)) {
    const own = sign === 0 ? drawn : drawn.filter((rect) => sideOf(rect) === sign);
    const wanted = sign === 0 ? expected : expected.filter(({ value }) => Math.sign(value) === sign);
    expect(own).toHaveLength(wanted.length);
    own.forEach((rect, index) => {
      const column = wanted[index];
      if (column === undefined) return;
      const { from, to, value } = column;
      walk.inSlots("bucket column", from, to - 1, [rect.x, rect.x + rect.width]);
      walk.valued(`bucket ${String(from)}`, value, [rect.y, rect.y + rect.height]);
    });
  }
  return drawn.length;
}

/** One walker for every mark, so a mark added to the list without a walker fails to compile. */
type Walkers = { readonly [Mark in FloorMark]: Walker };

/**
 * Walk a step path's runs, one per present reading of the first series in slot order: a Line's
 * runs, each stroked over whole device pixels from its cell's start to its end, or the top edge of
 * an Area's subpaths, each from cell edge to cell edge of its slot.
 */
function stepRuns(walk: Walk, what: string, d: string, edge: "line" | "area", width = 0): number {
  const along = ([x, y]: readonly [number, number]) => (walk.vertical ? x : y);
  const runs = pathPoints(d).flatMap((points) => {
    // An area's subpath runs along its top, then back along its base.
    const top = edge === "area" ? points.slice(0, points.length / 2) : points;
    return Array.from({ length: top.length / 2 }, (_, index) => {
      const start = top[index * 2];
      const end = top[index * 2 + 1];
      return start === undefined || end === undefined ? null : ([along(start), along(end)] as const);
    });
  });
  expect(runs).toHaveLength(walk.present.length);
  runs.forEach((run, index) => {
    const slot = walk.present[index] ?? -1;
    if (run === null) return;
    const span: Span = [Math.min(...run), Math.max(...run)];
    if (edge === "line") walk.stroked(what, slot, span, width);
    else walk.inSlots(what, slot, slot, span);
  });
  return runs.length;
}

/**
 * Walk a plain step line's risers, one between each two neighbouring readings of a run. A run of
 * n readings draws 2n points, its risers at the odd ones, and a lone reading draws a dot.
 */
function stepRisers(walk: Walk, d: string, width: number): number {
  let next = 0;
  let risers = 0;
  for (const part of d.split("M").filter((piece) => piece !== "")) {
    if (part.includes("a")) {
      next += 1;
      continue;
    }
    const points = [...part.matchAll(/(-?[\d.e]+),(-?[\d.e]+)/gu)].map(
      ([, x, y]) => [Number(x), Number(y)] as const
    );
    const count = points.length / 2;
    for (let index = 1; index < count; index += 1) {
      const point = points[2 * index - 1];
      if (point === undefined) continue;
      walk.riser(
        walk.present[next + index - 1] ?? -1,
        walk.present[next + index] ?? -1,
        walk.vertical ? point[0] : point[1],
        width
      );
      risers += 1;
    }
    next += count;
  }
  expect(next).toBe(walk.present.length);
  return risers;
}

/** One walker for every mark FLOOR_MARKS lists, each returning how many marks it checked. */
export const WALKERS: Walkers = {
  "chart-line": (walk) => {
    // DOM audit: the line is aria-hidden plot output, and its dashed twin draws nothing here.
    const line = walk.host.querySelector('[data-slot="chart-line"][data-part="solid"]');
    if (line === null) return 0;
    const width = Number.parseFloat(getComputedStyle(line).strokeWidth);
    const d = line.getAttribute("d") ?? "";
    return walk.chart.curve === "step"
      ? stepRisers(walk, d, width)
      : stepRuns(walk, "line run", d, "line", width);
  },
  "chart-area": (walk) => {
    // DOM audit: the area is aria-hidden plot output.
    const area = walk.host.querySelector('[data-slot="chart-area"][data-part="solid"]');
    return area === null ? 0 : stepRuns(walk, "area run", area.getAttribute("d") ?? "", "area");
  },
  "chart-dot": (walk) => {
    // Every dot centres on the column of its slot the line crosshair draws in, a device pixel wide
    // at least, so the device pixel around its centre lies among its slot's.
    const column = (dot: Element): Span => {
      const centre = Number(dot.getAttribute(walk.vertical ? "cx" : "cy"));
      const half = 0.5 / devicePixelRatio;
      return [centre - half, centre + half];
    };
    // A decimated window draws no dots here.
    if (walk.chart.count > DECIMATE_ABOVE) return 0;
    // DOM audit: dots, the marker's dots and the active dot are aria-hidden plot output.
    const dots = [...walk.host.querySelectorAll('[data-slot="chart-dots"] [data-slot="chart-dot"]')];
    expect(dots).toHaveLength(walk.present.length);
    dots.forEach((dot, index) => {
      const slot = walk.present[index] ?? -1;
      walk.inSlots("dot", slot, slot, column(dot));
    });
    const marked = [...walk.host.querySelectorAll('[data-slot="chart-marker"] [data-slot="chart-dot"]')];
    const tops = maxima(walk, 0);
    expect(marked).toHaveLength(tops.length);
    marked.forEach((dot, index) => {
      const slot = tops[index] ?? -1;
      walk.inSlots("marker", slot, slot, column(dot));
    });
    const active = walk.host.querySelector(
      '[data-slot="chart-active-dot"][data-value] [data-slot="chart-dot"]'
    );
    if (active !== null) walk.inSlots("active dot", walk.active, walk.active, column(active));
    return dots.length + marked.length + (active === null ? 0 : 1);
  },
  "chart-bar": (walk) => {
    let checked = 0;
    walk.layers.forEach((layer, series) => {
      const bars = barsOf(layer);
      if (bars.length === 0) return;
      expect(bars).toHaveLength(walk.present.length);
      bars.forEach((bar, index) => {
        // DOM audit: a bar's body carries the bar's slot.
        const body = bar.tagName === "g" ? bar.querySelector('[data-slot="chart-bar"]') : bar;
        if (body === null) return;
        const slot = walk.present[index] ?? -1;
        walk.inSlots("bar", slot, slot, walk.along(box(body)));
        const value = walk.read(slot, series);
        // The blocks look draws one whole square from the base even for a reading of 0.
        if (value !== 0 || walk.chart.variant !== "blocks")
          walk.valued(`bar ${String(slot)}`, value, walk.across(box(body)));
        checked += 1;
      });
    });
    return checked;
  },
  "chart-bar-detail": (walk) => {
    let checked = 0;
    for (const layer of walk.layers) {
      barsOf(layer).forEach((bar, index) => {
        const slot = walk.present[index] ?? -1;
        // DOM audit: a bar's look parts are aria-hidden plot output.
        for (const part of bar.querySelectorAll('[data-slot="chart-bar-detail"]')) {
          const name = part.getAttribute("data-part") ?? "part";
          if (name === "cap") walk.inSlots(name, slot, slot, walk.along(box(part)));
          else if (part.tagName === "path") {
            for (const rect of pathRects(part.getAttribute("d") ?? ""))
              walk.inSlots(name, slot, slot, walk.along(rect));
          } else {
            // An isometric face reaches past its band by design, its depth a whole device pixel.
            const xs = (part.getAttribute("points") ?? "")
              .split(" ")
              .map((point) => Number(point.split(",")[0]));
            expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0);
          }
          checked += 1;
        }
      });
    }
    return checked;
  },
  "chart-bar-path": (walk) => {
    let checked = 0;
    walk.layers.forEach((layer, series) => {
      // DOM audit: the path form's paths are aria-hidden plot output.
      const paths = [...layer.querySelectorAll('[data-slot="chart-bar-path"]')];
      if (paths.length === 0) return;
      const columns = paths
        .filter((path) => path.getAttribute("data-quality") !== "missing")
        .flatMap((path) => pathRects(path.getAttribute("d") ?? ""))
        .toSorted((a, b) => a.x - b.x);
      if (walk.chart.count > DECIMATE_ABOVE) {
        checked += decimatedColumns(walk, series, columns);
        return;
      }
      // A reading of 0 has no length, so it draws no column.
      const drawn = walk.present.filter((slot) => walk.read(slot, series) !== 0);
      expect(columns).toHaveLength(drawn.length);
      columns.forEach((rect, index) => {
        const slot = drawn[index] ?? -1;
        walk.inSlots("column", slot, slot, [rect.x, rect.x + rect.width]);
        walk.valued(`column ${String(slot)}`, walk.read(slot, series), [rect.y, rect.y + rect.height]);
      });
      const ticks = paths
        .filter((path) => path.getAttribute("data-quality") === "missing")
        .flatMap((path) => pathTicks(path.getAttribute("d") ?? ""));
      expect(ticks).toHaveLength(walk.absent.length);
      ticks.forEach(([start, end], index) => {
        const slot = walk.absent[index] ?? -1;
        walk.inSlots("path tick", slot, slot, [start, end]);
      });
      checked += columns.length + ticks.length;
    });
    return checked;
  },
  "chart-bar-emphasis": (walk) => {
    let checked = 0;
    walk.layers.forEach((layer, series) => {
      // DOM audit: the path form's emphasis overlays are aria-hidden plot output.
      const overlays = [...layer.querySelectorAll('[data-slot="chart-bar-emphasis"]')]
        .map((overlay) => box(overlay))
        .toSorted((a, b) => a.x - b.x);
      if (overlays.length === 0) return;
      const slots = emphasised(walk, series);
      expect(overlays).toHaveLength(slots.length);
      overlays.forEach((rect, index) => {
        const slot = slots[index] ?? -1;
        walk.inSlots("emphasis", slot, slot, [rect.x, rect.x + rect.width]);
        walk.valued(`emphasis ${String(slot)}`, walk.read(slot, series), [rect.y, rect.y + rect.height]);
      });
      checked += overlays.length;
    });
    return checked;
  },
  "chart-bar-missing": (walk) => {
    let checked = 0;
    for (const layer of walk.layers) {
      // DOM audit: missing ticks are aria-hidden plot output.
      const ticks = [...layer.querySelectorAll('[data-slot="chart-bar-missing"]')];
      // The path form draws its ticks in a path of its own.
      if (layer.querySelector('[data-slot="chart-bar-path"]') !== null) continue;
      expect(ticks).toHaveLength(walk.absent.length);
      ticks.forEach((tick, index) => {
        const slot = walk.absent[index] ?? -1;
        const ends = walk.vertical ? ["x1", "x2"] : ["y1", "y2"];
        const [start = 0, end = 0] = ends.map((name) => Number(tick.getAttribute(name)));
        walk.inSlots("tick", slot, slot, [Math.min(start, end), Math.max(start, end)]);
      });
      checked += ticks.length;
    }
    return checked;
  },
  "chart-bar-active": (walk) => {
    let checked = 0;
    walk.layers.forEach((layer, series) => {
      // DOM audit: the active overlay is aria-hidden plot output.
      const overlay = layer.querySelector('[data-slot="chart-bar-active"]');
      if (overlay?.getAttribute("visibility") !== "visible") return;
      walk.inSlots("overlay", walk.active, walk.active, walk.along(box(overlay)));
      walk.valued("overlay", walk.read(walk.active, series), walk.across(box(overlay)));
      checked += 1;
    });
    return checked;
  },
  "chart-grid-line": (walk) => {
    // DOM audit: grid lines are aria-hidden plot output.
    const lines = [...walk.host.querySelectorAll('[data-slot="chart-grid-line"]')];
    for (const line of lines) {
      const rule = ruleBox(line);
      // A slot line runs across the value axis between two slots, and a value line along it.
      const what = line.getAttribute("data-axis") === "slot" ? "slot grid line" : "value grid line";
      walk.inPlot(what, walk.across(rule));
      walk.crisp(what, ...thickness(line, rule), "hairline");
    }
    return lines.length;
  },
  "chart-crosshair-mark": (walk) => {
    // DOM audit: the crosshair is aria-hidden plot output.
    const mark = walk.host.querySelector('[data-slot="chart-crosshair-mark"]');
    // The crosshair draws while a slot is active, which an empty chart never has.
    if (
      mark === null ||
      (
        walk.host.closest('[data-slot="chart"]') ?? walk.host.querySelector('[data-slot="chart"]')
      )?.hasAttribute("data-active") !== true
    ) {
      return 0;
    }
    const drawn = box(mark);
    walk.inSlots(`crosshair ${walk.chart.crosshair}`, walk.active, walk.active, walk.along(drawn));
    // The line crosshair is a rule of its slot.
    if (walk.chart.crosshair === "line") {
      walk.crisp("line crosshair", walk.vertical ? "x" : "y", walk.along(drawn), "slot");
    }
    return 1;
  },
  "chart-reference-rule": (walk) => {
    // DOM audit: reference rules are aria-hidden plot output, inside their reference's wrapper.
    const rules = [...walk.host.querySelectorAll('[data-slot="chart-reference-rule"]')];
    for (const rule of rules) {
      const reference = rule.closest('[data-slot="chart-reference-line"]');
      const slotAxis = reference?.getAttribute("data-axis") === "slot";
      // An empty chart has no value domain, so a value reference draws outside it and hides.
      if (!slotAxis && walk.present.length === 0) continue;
      expect(reference?.hasAttribute("data-outside")).toBe(false);
      const drawn = ruleBox(rule);
      if (slotAxis) {
        const slot = walk.chart.line % walk.chart.count;
        walk.inSlots("slot reference rule", slot, slot, walk.along(drawn));
        walk.crisp("slot reference rule", ...thickness(rule, drawn), "slot");
        // On a vertical chart its label sits above the plot and centres on it, unless the label
        // meets the plot's edge and stops there.
        const label = reference.querySelector('[data-slot="chart-reference-label"]');
        const plot = walk.layers[0]?.getBoundingClientRect() ?? new DOMRect();
        const edges = label?.getBoundingClientRect() ?? new DOMRect();
        if (label !== null && walk.vertical && edges.left > plot.left + 1 && edges.right < plot.right - 1) {
          walk.centred("slot reference label", labelCentre(label, "x"), ruleCentre(rule, "x"));
        }
      } else {
        walk.inPlot("value reference rule", walk.across(drawn));
        walk.crisp("value reference rule", ...thickness(rule, drawn), "hairline");
      }
    }
    return rules.length;
  },
  "chart-reference-band": (walk) => {
    // DOM audit: reference bands are aria-hidden plot output, inside their reference's wrapper.
    const bands = [...walk.host.querySelectorAll('[data-slot="chart-reference-band"]')];
    for (const band of bands) {
      const reference = band.closest('[data-slot="chart-reference-area"]');
      const slotAxis = reference?.getAttribute("data-axis") === "slot";
      if (!slotAxis && walk.present.length === 0) continue;
      expect(reference?.hasAttribute("data-outside")).toBe(false);
      if (slotAxis) {
        const from = walk.chart.from % walk.chart.count;
        const to = Math.min(walk.chart.count - 1, from + walk.chart.span);
        walk.inSlots("slot reference band", from, to, walk.along(box(band)));
      } else walk.inPlot("value reference band", walk.across(box(band)));
    }
    return bands.length;
  },
  "chart-active-value-rule": (walk) => {
    // DOM audit: the active value line is aria-hidden plot output.
    const wrapper = walk.host.querySelector('[data-slot="chart-active-value-line"]');
    const rule = wrapper?.querySelector('[data-slot="chart-active-value-rule"]');
    if (rule === null || rule === undefined || wrapper?.hasAttribute("data-value") !== true) return 0;
    const drawn = ruleBox(rule);
    // It runs along the slot axis, across the whole plot, at the active value.
    walk.inPlot("active value rule", walk.across(drawn));
    const [axis, span] = thickness(rule, drawn);
    walk.crisp("active value rule", axis, span, "hairline");
    // The pill beside it centres on it.
    // DOM audit: the pill is aria-hidden text inside the active value line.
    const pill = wrapper.querySelector('[data-slot="chart-value-label"]');
    if (pill !== null) walk.centred("active value pill", labelCentre(pill, axis), ruleCentre(rule, axis));
    return 1;
  },
};
