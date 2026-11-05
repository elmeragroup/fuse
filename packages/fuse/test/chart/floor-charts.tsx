/**
 * The stack floor browser suites' shared charts and readers: a chart placed a fraction of a device
 * pixel into the page, the issue's week of carts, the drawn zero rule and plot, a bar or column's
 * expected floor, the sub-pixel sweep, the transition harness with its loose probe bar, and the
 * readers of a series' columns and active overlay. The oracles stay in the suites; these only set
 * charts up and read what they draw.
 */
import type { ReactNode } from "react";

import { expect } from "vitest";
import { userEvent } from "vitest/browser";

import { Chart } from "../../src/components/chart/chart-namespace";
import type { ChartConfig, ChartSeriesConfig, ChartStyle } from "../../src/components/chart/chart-types";
import { LocaleProvider } from "../../src/intl/locale-context";
import { nextFrames } from "../animation-frames";
import { emulatePixelRatio } from "../page-metrics";
import { renderThemed } from "../themed-browser-render";
import { drawnRect } from "./bar-box";
import type { DrawnRect } from "./bar-box";
import { floorFault } from "./floor-walkers";
import { installFrameClock } from "./frame-clock";
import { barLayerBox, bars } from "./marks";
import { SERIAL } from "./world-model";
import { pathRects, stroke } from "./world-reader";
import type { Rect } from "./world-reader";

/** The issue's chart config: one series of completed carts. */
const CONFIG = { carts: { label: "Completed carts", color: "chart-1" } } as const satisfies ChartConfig;

const RATIOS = [1, 1.5, 2] as const;

/** One chart at a sub-pixel offset of its plot along the value axis. */
function placed(offset: number, orientation: "vertical" | "horizontal", chart: ReactNode) {
  const vertical = orientation === "vertical";
  return (
    <LocaleProvider locale="en-US">
      <div
        style={{
          width: 400,
          padding: 12,
          paddingTop: vertical ? 12 + offset : 12,
          paddingLeft: vertical ? 12 : 12 + offset,
        }}>
        {chart}
      </div>
    </LocaleProvider>
  );
}

/** The plot as drawn: the zero rule's near edge and the plot's drawn length along the value axis. */
export type Drawn = { readonly zero: number; readonly length: number };

/** Read the zero rule and the plot's drawn length, in CSS pixels from the plot's drawn origin. */
export function drawnPlot(host: HTMLElement, vertical: boolean, dpr: number): Drawn {
  // DOM audit: grid lines are aria-hidden plot output, and the zero line carries data-zero.
  const rule = host.querySelector('[data-slot="chart-grid-line"][data-zero]');
  if (rule === null) throw new Error("no zero rule");
  // A rule starts at its coordinate and its stroke centres half its width past it.
  const zero = Number(rule.getAttribute(vertical ? "y1" : "x1")) - stroke(rule) / 2;
  // The browser draws the plot's edges on the device pixels nearest their page positions.
  const box = barLayerBox(host);
  const [start, end] = vertical ? [box.top, box.bottom] : [box.left, box.right];
  const length = (Math.ceil(end * dpr - 0.5) - Math.ceil(start * dpr - 0.5)) / dpr;
  return { zero, length };
}

/** A body's span along the value axis. */
function across(rect: DrawnRect, vertical: boolean): readonly [number, number] {
  return vertical ? [rect.y, rect.y + rect.height] : [rect.x, rect.x + rect.width];
}

/**
 * Expect a body of a non-zero reading one device pixel long or more, its base on the zero rule,
 * its far edge away from zero by the reading's sign, inside the plot.
 */
export function expectFloored(
  rect: DrawnRect,
  plot: Drawn,
  options: { readonly vertical: boolean; readonly sign: 1 | -1; readonly dpr: number; readonly what: string }
): void {
  const { vertical, what } = options;
  expect(floorFault(across(rect, vertical), plot, options), what).toBeNull();
}

/**
 * Render a chart at every tenth, or twentieth, of a CSS pixel along the value axis, at every ratio,
 * through the suite's own mount, the themed harness.
 */
export async function sweep(
  mount: typeof renderThemed,
  steps: number,
  orientation: "vertical" | "horizontal",
  chart: ReactNode,
  check: (host: HTMLElement, plot: Drawn, dpr: number, offset: number) => void
): Promise<void> {
  for (const dpr of RATIOS) {
    await emulatePixelRatio(dpr);
    for (let step = 0; step < steps; step += 1) {
      const offset = step / steps;
      const { host, unmount } = mount(placed(offset, orientation, chart));
      try {
        await nextFrames(2);
        check(host, drawnPlot(host, orientation === "vertical", dpr), dpr, offset);
      } finally {
        unmount();
      }
    }
  }
}

/** The label of one sweep's sample. */
export function at(dpr: number, offset: number): string {
  return `dpr ${String(dpr)} offset ${offset.toFixed(2)}`;
}

/** One data update of a stack of tiny segments at one slot, with a loose probe bar beside it. */
export type Transition = {
  readonly what: string;
  readonly form: "bars" | "path";
  readonly from: readonly number[];
  readonly to: readonly number[];
  readonly include: readonly number[];
  readonly height: number;
  /** Where zero lies down the plot, unsnapped, in CSS pixels, worked from the domain. */
  readonly zero: number;
  /** CSS pixels a unit of value takes along the value axis, worked from the domain. */
  readonly perUnit: number;
  readonly seam: "none" | "default";
  readonly dpr: number;
  /** How far into its device pixel the chart's top lies, which places the plot's top too. */
  readonly offset: number;
};

/** The loose probe's reading after the update, which its drawn tip turns into the progress. */
export const PROBE = 1000;

/** The categories of the path form: more than 100, the stack at the first and the probe at the second. */
export const PATH_SLOTS = 120;

/**
 * A stack of segments s0, s1, … at the first slot and a loose probe bar at the second, which reads
 * 0 before the update and `PROBE` after it, in either form.
 */
function transitionChart(transition: Transition, values: readonly number[], probe: number) {
  const config: ChartConfig = Object.fromEntries([
    ...values.map((_, index): [string, ChartSeriesConfig] => [
      `s${String(index)}`,
      { label: `S${String(index)}`, color: index % 2 === 0 ? "chart-1" : "chart-2", stack: "s" },
    ]),
    ["probe", { label: "Probe", color: "chart-3" }],
  ]);
  const slots = transition.form === "bars" ? 2 : PATH_SLOTS;
  const data = Array.from({ length: slots }, (_, slot) => ({
    day: `d${String(slot)}`,
    probe: slot === 1 ? probe : null,
    ...Object.fromEntries(
      values.map((value, index) => [`s${String(index)}`, slot === 0 ? value : null] as const)
    ),
  }));
  const style: ChartStyle = { "--chart-plot-height": `${String(transition.height)}px` };
  if (transition.seam === "none") style["--chart-bar-seam"] = "0px";
  return placed(
    transition.offset,
    "vertical",
    <Chart.Root
      data-intro="none"
      data={data}
      config={config}
      xKey="day"
      yInclude={[...transition.include]}
      style={style}
      aria-label="Stack">
      <Chart.Grid />
      {values.map((_, index) => (
        <Chart.Bar key={index} dataKey={`s${String(index)}`} />
      ))}
      <Chart.Bar dataKey="probe" />
    </Chart.Root>
  );
}

/**
 * A series' body in either form, or a flat one where none draws. Each series reads at one slot
 * alone, the stack's at the first and the probe at the second, so its body is its only one.
 */
function bodyOf(host: HTMLElement, form: "bars" | "path", series: number): DrawnRect {
  const flat = { x: 0, y: 0, width: 0, height: 0 };
  if (form === "bars") {
    const bar = bars(host, series)[0];
    return bar === undefined ? flat : drawnRect(bar);
  }
  return seriesColumns(host, series)[0] ?? flat;
}

/**
 * Each segment's base and tip at rest, by hand after d3's diverging offset: a positive reading
 * stacks up from the positive parts below it, a negative one down from the negative parts, and
 * a 0 lies flat at 0. A segment's base is its end nearer zero.
 */
export function stacked(values: readonly number[]): (readonly [base: number, tip: number])[] {
  let up = 0;
  let down = 0;
  return values.map((value) => {
    if (value > 0) return [up, (up += value)] as const;
    if (value < 0) return [down, (down += value)] as const;
    return [0, 0] as const;
  });
}

/**
 * Whether the page span between two positions holds a place where the browser's rounding to a
 * device pixel turns, half a device pixel past a pixel edge. A span that holds none snaps every
 * coordinate in it to one edge, so every segment inside it snaps to nothing.
 */
export function turnsIn(dpr: number, from: number, to: number): boolean {
  const low = Math.min(from, to) - 1e-6;
  const high = Math.max(from, to) + 1e-6;
  return Math.floor(high * dpr - 0.5) >= Math.ceil(low * dpr - 0.5);
}

/** One sampled frame of a transition, while it moves. */
export type Moving = {
  readonly host: HTMLElement;
  /** The segments as drawn, by series. */
  readonly drawn: readonly DrawnRect[];
  /** The zero rule's near edge, in CSS pixels from the plot. */
  readonly rule: number;
  /** The tween's progress, which the probe's drawn tip gives to within half a device pixel. */
  readonly progress: number;
  readonly log: string;
};

/**
 * Run a transition and hand each sampled frame where the probe has left both rests to `check`,
 * which returns whether it judged the frame. A transition must judge `least` frames or more.
 */
export async function run(
  transition: Transition,
  least: number,
  check: (frame: Moving) => boolean
): Promise<void> {
  const { form, dpr } = transition;
  await emulatePixelRatio(dpr);
  const clock = installFrameClock();
  const { host, rerender, unmount } = renderThemed(transitionChart(transition, transition.from, 0));
  let judged = 0;
  try {
    const start = clock.now();
    rerender(transitionChart(transition, transition.to, PROBE));
    for (let time = 10; time < 480; time += 10) {
      clock.frameAt(start + time);
      const probe = bodyOf(host, form, transition.from.length);
      const progress = (transition.zero - probe.y) / (PROBE * transition.perUnit);
      // Strictly between the rests, the probe's own snapping kept clear of either.
      if (progress <= 0.01 || progress >= 0.99) continue;
      const drawn = transition.from.map((_, series) => bodyOf(host, form, series));
      const { zero: rule } = drawnPlot(host, true, dpr);
      const log = `${transition.what}, ${form}, ${String(time)} ms, progress ${progress.toFixed(3)}: ${JSON.stringify(
        drawn.map(({ y, height }) => [y, height])
      )}, zero ${String(rule)}`;
      if (check({ host, drawn, rule, progress, log })) judged += 1;
    }
  } finally {
    unmount();
    clock.restore();
  }
  expect(judged, `${transition.what}, ${form}: frames judged while moving`).toBeGreaterThanOrEqual(least);
}

/**
 * Render a chart through the suite's own mount, the themed harness, update it, and hand `each` the
 * frames of the update's tween at the given times after it starts, on the frame clock at a pixel
 * ratio.
 *
 * @param mount - The suite's mount.
 * @param before - The chart before the update.
 * @param after - The chart after it.
 * @param options - The pixel ratio, the frame times in milliseconds, and what to do once the
 *   chart before the update draws, such as activating a slot.
 * @param each - Read one frame.
 */
export async function tweenFrames(
  mount: typeof renderThemed,
  before: ReactNode,
  after: ReactNode,
  options: {
    readonly dpr?: number;
    readonly times: readonly number[];
    readonly ready?: (host: HTMLElement) => Promise<void> | void;
  },
  each: (host: HTMLElement, time: number) => void
): Promise<void> {
  await emulatePixelRatio(options.dpr ?? 1);
  const clock = installFrameClock();
  const { host, rerender, unmount } = mount(before);
  try {
    await options.ready?.(host);
    const start = clock.now();
    rerender(after);
    for (const time of options.times) {
      clock.frameAt(start + time);
      each(host, time);
    }
  } finally {
    unmount();
    clock.restore();
  }
}

/**
 * Frame times from `from` to `to` milliseconds, `step` apart.
 *
 * @param from - The first time.
 * @param to - The last time, included where a step lands on it.
 * @param step - The time between two frames.
 * @returns The times.
 */
export function times(from: number, to: number, step: number): number[] {
  return Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, index) => from + index * step);
}

/**
 * A stacked chart with no seam and no intro: its plot `height` px tall over `include`, in a box
 * `width` px wide, a `left` fraction of a pixel in from the page's edge, with each config key's
 * Bar in order unless `children` draws the plot.
 */
export function stackChart(chart: {
  readonly config: ChartConfig;
  readonly data: readonly Readonly<Record<string, string | number | null>>[];
  readonly include: readonly number[];
  readonly height: number;
  readonly width: number;
  readonly left?: number;
  readonly children?: ReactNode;
}) {
  const { config, data, include, height, width, left, children } = chart;
  return (
    <LocaleProvider locale="en-US">
      <div style={{ width, paddingLeft: left }}>
        <Chart.Root
          data-intro="none"
          data={data}
          config={config}
          xKey="day"
          yInclude={[...include]}
          style={{ "--chart-plot-height": `${String(height)}px`, "--chart-bar-seam": "0px" }}
          aria-label="Stack">
          {children ?? Object.keys(config).map((key) => <Chart.Bar key={key} dataKey={key} />)}
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

/** The drawn segments on each side of the zero rule, with length. */
export function sides(drawn: readonly DrawnRect[], rule: number) {
  const shown = drawn.map((rect, series) => ({ rect, series })).filter(({ rect }) => rect.height > SERIAL);
  return {
    positive: shown.filter(({ rect }) => rect.y + rect.height <= rule + SERIAL),
    negative: shown.filter(({ rect }) => rect.y >= rule - SERIAL),
  };
}

// d5 is a true zero, d6 is 4: on a 0..1200 domain over a 256 px plot, 4 is 0.85 CSS px.
export const WEEK = [1000, 930, 750, 660, 0, 4, 720].map((carts, index) => ({
  day: `d${String(index + 1)}`,
  carts,
}));

export function week(
  data: readonly { day: string; carts: number }[],
  include: number[],
  orientation: "vertical" | "horizontal" = "vertical"
) {
  return (
    <Chart.Root
      data-intro="none"
      data={data}
      config={CONFIG}
      xKey="day"
      yInclude={include}
      orientation={orientation}
      style={{ "--chart-plot-height": "16rem" }}
      aria-label="Completed carts">
      <Chart.Grid />
      <Chart.YAxis />
      <Chart.Bar dataKey="carts" />
      <Chart.XAxis />
    </Chart.Root>
  );
}

/**
 * A series' path-form columns, in x order: its solid fill's, or with `"every"` every quality path's.
 *
 * @param host - The rendered chart's host.
 * @param series - The series ordinal.
 * @param paths - Which of the series' paths to read.
 * @returns The columns.
 */
export function seriesColumns(host: ParentNode, series: number, paths: "fill" | "every" = "fill"): Rect[] {
  // DOM audit: the path form's paths are aria-hidden plot output, one layer per series.
  const layer = host.querySelector(`[data-slot="chart-bar-series"][data-series="${String(series)}"]`);
  const selector =
    paths === "fill" ? '[data-slot="chart-bar-path"][data-part="fill"]' : '[data-slot="chart-bar-path"]';
  return [...(layer?.querySelectorAll(selector) ?? [])]
    .flatMap((path) => pathRects(path.getAttribute("d") ?? ""))
    .toSorted((a, b) => a.x - b.x);
}

/**
 * A series' path-form columns that draw a pixel, in x order.
 *
 * @param host - The rendered chart's host.
 * @param series - The series ordinal.
 * @returns The columns with width and height.
 */
export function shownColumns(host: ParentNode, series: number): Rect[] {
  return seriesColumns(host, series).filter(({ width, height }) => width > SERIAL && height > SERIAL);
}

/**
 * A series' active overlay as drawn, or a flat box where none draws.
 *
 * @param host - The rendered chart's host.
 * @param series - The series ordinal.
 * @returns The overlay's box.
 */
export function activeOverlay(host: ParentNode, series: number): DrawnRect {
  // DOM audit: each series' layer holds its active overlay, aria-hidden plot output.
  const layer = host.querySelector(`[data-slot="chart-bar-series"][data-series="${String(series)}"]`);
  return drawnRect(layer?.querySelector('[data-slot="chart-bar-active"]'));
}

/**
 * Expect no box of one list to share a pixel with a box of another.
 *
 * @param one - One list's boxes.
 * @param other - The other's.
 * @param what - What the failure names.
 */
export function expectApart(one: readonly DrawnRect[], other: readonly DrawnRect[], what: string): void {
  for (const a of one) {
    for (const b of other) {
      const across = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const down = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      expect(across > SERIAL && down > SERIAL, `${what}: ${JSON.stringify(a)} and ${JSON.stringify(b)}`).toBe(
        false
      );
    }
  }
}

/**
 * Make the chart's first slot active, as the keyboard does.
 *
 * @param host - The rendered chart's host.
 */
export async function activateFirst(host: HTMLElement): Promise<void> {
  // DOM audit: the plot's single tab stop is the listbox's option.
  host.querySelector<HTMLElement>('[role="option"]')?.focus();
  await userEvent.keyboard("{Home}");
}
