// One world of a bar chart's marks, in Chromium, after review rounds 11 and 12. Unit under test:
// every placed mark of phase 1 through random data updates, sign flips, categories added, removed
// and reordered, value domains that move, x range windows, resizes to fractional sizes,
// orientation turns, form switches across the path limit, activation, and references that change
// value or axis, at 1x, 1.25x, 1.5x and 2x.
//
// Oracle at rest and after every commit that snaps: `expected`, a model written in this file from
// the contract, which imports no production layout. From the world's inputs and the measured plot
// it computes each mark's visibility, `data-outside`, label membership and resting device pixels:
// the zero rule and d3's nice rule for the value domain (sections 8.3 and 8.11), the window
// (8.12), bands with a 25 % gap (8.15), the path form's columns past 100 categories, the pixel
// floor, the browser's snap, hairlines and the missing tick. Every mark must match it exactly.
//
// Oracles in every sampled frame: marks on one data coordinate emit one device pixel, a bar draws
// on the side its tip lies, a hidden reference holds no label place, and a commit that does not
// snap leaves every mark within a device pixel of its last frame, a resize's mapped into the new
// box.
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { cdp, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

type MetricsCdp = {
  send: ((
    method: "Emulation.setDeviceMetricsOverride",
    params: { width: number; height: number; deviceScaleFactor: number; mobile: boolean }
  ) => Promise<void>) &
    ((method: "Emulation.clearDeviceMetricsOverride") => Promise<void>);
};

// SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
const session = (): MetricsCdp => cdp() as MetricsCdp;

afterEach(async () => {
  await session().send("Emulation.clearDeviceMetricsOverride");
});

async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

async function setRatio(dpr: number): Promise<void> {
  await session().send("Emulation.setDeviceMetricsOverride", {
    width: 1024,
    height: 768,
    deviceScaleFactor: dpr,
    mobile: false,
  });
  await frame();
}

/** How far a computed number may stray from what it stands for: styles serialize six decimals. */
const SERIAL = 1e-5;

/** A reading, or null for a missing one. */
type Reading = number | null;

/** One category: its name, which keys its marks, and its reading. */
type Datum = { readonly name: string; readonly v: Reading };

type Line =
  | { readonly axis: "value"; readonly at: number }
  | { readonly axis: "slot"; readonly name: string };
type Area =
  | { readonly axis: "value"; readonly from: number; readonly to: number }
  | { readonly axis: "slot"; readonly first: string; readonly last: string };

/** Everything the chart renders from. */
type World = {
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
};

/** A role list paints a gradient from each bar's tip, and missing readings take the quality column. */
const CONFIG = {
  v: { label: "V", color: ["chart-1", "chart-3"], qualityKey: "q" },
} as const satisfies ChartConfig;

type Row = { readonly name: string; readonly v: Reading; readonly q: "missing" | "measured" };

/** One row array per data array, so a render that changes something else keeps the data. */
const rows = new WeakMap<readonly Datum[], readonly Row[]>();

function rowsOf(data: readonly Datum[]): readonly Row[] {
  const known =
    rows.get(data) ?? data.map(({ name, v }): Row => ({ name, v, q: v === null ? "missing" : "measured" }));
  rows.set(data, known);
  return known;
}

function view(world: World) {
  const { line, area } = world;
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: world.width }}>
        <Chart.Root
          data-intro="none"
          data={rowsOf(world.data)}
          config={CONFIG}
          xKey="name"
          orientation={world.orientation}
          yInclude={[world.include[0], world.include[1]]}
          xRange={world.window === null ? undefined : [world.window[0], world.window[1]]}
          style={{ "--chart-plot-height": `${String(world.height)}px` }}
          aria-label="Verden">
          <Chart.Bar dataKey="v" variant={world.variant} />
          <Chart.ReferenceLine y={0} />
          {line.axis === "value" ? (
            <Chart.ReferenceLine y={line.at} label="Linje" />
          ) : (
            <Chart.ReferenceLine x={line.name} label="Linje" />
          )}
          {area.axis === "value" ? (
            <Chart.ReferenceArea y1={area.from} y2={area.to} label="Bånd" />
          ) : (
            <Chart.ReferenceArea x1={area.first} x2={area.last} label="Bånd" />
          )}
          <Chart.ActiveValue dataKey="v" />
          <Chart.ActiveValueLine dataKey="v" />
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

// The model.

/** d3-array's tickIncrement: a step of 1, 2 or 5 times a power of ten, negative for a fraction. */
function tickIncrement(start: number, stop: number, count: number): number {
  const step = (stop - start) / Math.max(0, count);
  const power = Math.floor(Math.log10(step));
  const error = step / 10 ** power;
  const factor = error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1;
  return power >= 0 ? factor * 10 ** power : -(10 ** -power) / factor;
}

/** d3-array's nice: widen the bounds to whole steps until the step stops changing. */
function nice(start: number, stop: number, count: number): [number, number] {
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
function windowOf(world: World): readonly [number, number] {
  if (world.window === null) return [0, world.data.length - 1];
  const names = world.data.map(({ name }) => name);
  return [names.indexOf(world.window[0]), names.indexOf(world.window[1])];
}

/** The value domain: the readings in the window with 0 and `yInclude`, niced to 5 ticks. */
function domainOf(world: World): readonly [number, number] {
  const [first, last] = windowOf(world);
  const values = world.data.slice(first, last + 1).flatMap(({ v }) => (v === null ? [] : [v]));
  const low = Math.min(0, ...world.include, ...values);
  const high = Math.max(0, ...world.include, ...values);
  if (low === 0 && high === 0) return [0, 1];
  return nice(low, high, 5);
}

/** Whether the bars draw as paths: more than 100 categories on a vertical chart. */
function pathForm(world: World): boolean {
  return world.orientation === "vertical" && world.data.length > 100;
}

/** The plot as measured: its page position and size along the slot axis and across it. */
type Plot = {
  readonly dpr: number;
  readonly alongAt: number;
  readonly acrossAt: number;
  readonly along: number;
  readonly across: number;
};

function plotOf(host: HTMLElement, world: World): Plot {
  // DOM audit: the bar series box is the plot box every mark draws in.
  const rect = host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect() ?? new DOMRect();
  const vertical = world.orientation === "vertical";
  // The plot's place in the document, which a key step that scrolls the page into view leaves alone,
  // as Root measured it before any scroll.
  const left = rect.left + scrollX;
  const top = rect.top + scrollY;
  return {
    dpr: devicePixelRatio,
    alongAt: vertical ? left : top,
    acrossAt: vertical ? top : left,
    along: vertical ? rect.width : rect.height,
    across: vertical ? rect.height : rect.width,
  };
}

type Span = readonly [number, number];

/** What the model expects of every mark at rest. */
type Expected = {
  readonly bars: ReadonlyMap<
    string,
    { readonly along: Span; readonly across: Span; readonly negative: boolean }
  >;
  readonly ticks: ReadonlyMap<string, { readonly along: Span; readonly base: number }>;
  readonly overlay: { readonly along: Span; readonly across: Span } | null;
  readonly line: number | null;
  readonly value: { readonly centre: number; readonly tip: number } | null;
  readonly baseline: number;
  readonly references: readonly {
    readonly what: string;
    readonly visible: boolean;
    readonly stacked: boolean;
    readonly span: Span;
  }[];
};

/**
 * The model. The browser draws a coordinate on the device pixel nearest its page position, a tie
 * toward the top left, and a mark's origin on the pixel nearest the plot's.
 */
function expected(world: World, plot: Plot, active: string | null): Expected {
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
  const value = shown === null ? null : { centre: snapAlong((shownIndex + 0.5) * step), tip: tipOf(shown) };
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
  return { bars, ticks, overlay, line: activeLine, value, baseline, references };
}

/**
 * Whether a data update certainly relays the plot, from the rule review round 12 states: it switches
 * the bars' form, or it mounts a bar or a missing tick while the value domain moves. A mount while a
 * tween still runs relays it too, which the run accepts from what it draws.
 */
function relays(before: World, after: World): boolean {
  if (pathForm(before) !== pathForm(after)) return true;
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

// The drawing.

type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

function rectOf(element: Element): Rect {
  const [x = 0, y = 0, width = 0, height = 0] = ["x", "y", "width", "height"].map((name) =>
    Number(element.getAttribute(name))
  );
  return { x, y, width, height };
}

function pathRects(d: string): Rect[] {
  return [...d.matchAll(/M([-\d.e]+) ([-\d.e]+)H([-\d.e]+)V([-\d.e]+)H[-\d.e]+Z/gu)].map(
    ([, x, y, x2, y2]) => ({
      x: Number(x),
      y: Number(y),
      width: Number(x2) - Number(x),
      height: Number(y2) - Number(y),
    })
  );
}

function stroke(element: Element): number {
  return Number.parseFloat(getComputedStyle(element).strokeWidth);
}

/** A mark's numbers and which plot axis each runs on, for a resize's map. */
type Mark = {
  readonly values: readonly number[];
  readonly axes: readonly ("along" | "across")[];
  /** How far containment may hold the mark from its mapped position, past the snapping slack. */
  readonly hold?: number;
};

/** What the chart draws in one frame, in CSS pixels from the plot's top left, by category name. */
type Shot = {
  readonly plot: Plot;
  readonly baseline: number | null;
  readonly bars: ReadonlyMap<
    string,
    { readonly along: Span; readonly across: Span; readonly negative: boolean | null }
  >;
  readonly ticks: ReadonlyMap<
    string,
    { readonly along: Span; readonly base: number; readonly soft: boolean }
  >;
  readonly active: string | null;
  readonly overlay: { readonly along: Span; readonly across: Span; readonly negative: boolean } | null;
  readonly line: number | null;
  readonly value: { readonly centre: number; readonly tip: number } | null;
  readonly references: readonly {
    readonly what: string;
    readonly outside: boolean;
    readonly shown: boolean;
    readonly stacked: boolean;
    readonly span: Span;
  }[];
  readonly marks: ReadonlyMap<string, Mark>;
};

function shoot(host: HTMLElement, world: World): Shot {
  const vertical = world.orientation === "vertical";
  const plot = plotOf(host, world);
  const { dpr } = plot;
  // DOM audit: the plot's marks are aria-hidden plot output, so their slots are the only locators.
  const layer = host.querySelector('[data-slot="chart-bar-series"]');
  const across = (rect: Rect): Span =>
    vertical ? [rect.y, rect.y + rect.height] : [rect.x, rect.x + rect.width];
  const along = (rect: Rect): Span =>
    vertical ? [rect.x, rect.x + rect.width] : [rect.y, rect.y + rect.height];
  const centreOf = (line: Element, onY: boolean) => Number(line.getAttribute(onY ? "y1" : "x1"));
  const marks = new Map<string, Mark>();
  const [first, last] = windowOf(world);
  const windowed = world.data.slice(first, last + 1);
  const present = windowed.flatMap(({ name, v }) => (v === null ? [] : [name]));
  const missing = windowed.flatMap(({ name, v }) => (v === null ? [name] : []));
  const bars = new Map<string, { along: Span; across: Span; negative: boolean | null }>();
  // DOM audit: element-form bars, one per present reading in window order.
  [...(layer?.querySelectorAll('[data-slot="chart-bar"]') ?? [])].forEach((body, index) => {
    const name = present[index] ?? "?";
    const rect = rectOf(body);
    bars.set(name, {
      along: along(rect),
      across: across(rect),
      negative: body.hasAttribute("data-negative"),
    });
    marks.set(`bar ${name}`, {
      values: [...along(rect), ...across(rect)],
      axes: ["along", "along", "across", "across"],
    });
  });
  // A column draws only for a reading other than 0, in slot order, so the columns sorted along the
  // plot pair with those readings in window order, however densely they share pixels.
  // DOM audit: the path form's columns are aria-hidden plot output.
  const columns = [...(layer?.querySelectorAll('[data-slot="chart-bar-path"]:not([data-quality])') ?? [])]
    .flatMap((path) => pathRects(path.getAttribute("d") ?? ""))
    .toSorted((a, b) => along(a)[0] - along(b)[0]);
  const drawnReadings = windowed.flatMap(({ name, v }) => (v === null || v === 0 ? [] : [name]));
  columns.forEach((rect, index) => {
    const name = drawnReadings[index] ?? "?";
    bars.set(name, { along: along(rect), across: across(rect), negative: null });
    marks.set(`column ${name}`, { values: across(rect), axes: ["across", "across"] });
  });
  // A tick's baseline edge lies half its device pixels, rounded down, past its near edge, and the
  // browser draws the plot's origin on the device pixel nearest its page position.
  const origin = Math.ceil(plot.acrossAt * dpr - 0.5) / dpr;
  const whole = (at: number) => Math.abs(at * dpr - Math.round(at * dpr)) <= SERIAL * dpr;
  const ticks = new Map<string, { along: Span; base: number; soft: boolean }>();
  const tick = (name: string, span: Span, centre: number, width: number) => {
    const base = centre - width / 2 + Math.floor(Math.round(width * dpr) / 2) / dpr;
    ticks.set(name, { along: span, base, soft: !whole(origin + centre - width / 2) || !whole(width) });
    return base;
  };
  // DOM audit: missing ticks are aria-hidden plot output, in window order.
  [...(layer?.querySelectorAll('[data-slot="chart-bar-missing"]') ?? [])].forEach((line, index) => {
    const name = missing[index] ?? "?";
    const [a = 0, b = 0] = (vertical ? ["x1", "x2"] : ["y1", "y2"]).map((end) =>
      Number(line.getAttribute(end))
    );
    const base = tick(name, [Math.min(a, b), Math.max(a, b)], centreOf(line, vertical), stroke(line));
    marks.set(`tick ${name}`, { values: [base], axes: ["across"] });
  });
  // DOM audit: the path form's missing ticks are aria-hidden plot output.
  const missingPath = layer?.querySelector('[data-slot="chart-bar-path"][data-quality="missing"]');
  if (missingPath) {
    [...(missingPath.getAttribute("d") ?? "").matchAll(/M([-\d.e]+) ([-\d.e]+)H([-\d.e]+)/gu)].forEach(
      ([, a, y, b], index) => {
        tick(missing[index] ?? "?", [Number(a), Number(b)], Number(y), stroke(missingPath));
      }
    );
  }
  // DOM audit: references are aria-hidden plot output, in the order they render.
  const references = [
    ...host.querySelectorAll('[data-slot="chart-reference-line"], [data-slot="chart-reference-area"]'),
  ];
  const [zero, ...guides] = references;
  const zeroRule = zero?.querySelector("line");
  const baseline = zeroRule ? centreOf(zeroRule, vertical) - stroke(zeroRule) / 2 : null;
  if (baseline !== null) marks.set("reference at 0", { values: [baseline], axes: ["across"] });
  // DOM audit: Root's own element carries the active state, and the option its position.
  const chart = host.querySelector('[data-slot="chart"]');
  const option = host.querySelector('[role="option"]');
  const position = Number(option?.getAttribute("aria-posinset") ?? 0) - 1;
  const active = chart?.hasAttribute("data-active") === true ? (windowed[position]?.name ?? null) : null;
  // DOM audit: the active overlay is aria-hidden plot output.
  const overlayNode = layer?.querySelector('[data-slot="chart-bar-active"][visibility="visible"]');
  const overlay = overlayNode
    ? {
        along: along(rectOf(overlayNode)),
        across: across(rectOf(overlayNode)),
        negative: overlayNode.hasAttribute("data-negative"),
      }
    : null;
  if (overlay) {
    marks.set(`overlay ${active ?? "?"}`, {
      values: [...overlay.along, ...overlay.across],
      axes: ["along", "along", "across", "across"],
    });
  }
  // DOM audit: the active value line is aria-hidden plot output.
  const valueLine = host.querySelector('[data-slot="chart-active-value-line"][data-value] line');
  const line = valueLine ? centreOf(valueLine, vertical) - stroke(valueLine) / 2 : null;
  if (line !== null) marks.set(`value line ${active ?? "?"}`, { values: [line], axes: ["across"] });
  // DOM audit: ActiveValue is aria-hidden plot output, placed by its two shares.
  const pill = host.querySelector<HTMLElement>('[data-slot="chart-active-value"]');
  const at = Number.parseFloat(pill?.style.getPropertyValue("--chart-value-at") ?? "");
  const top = Number.parseFloat(pill?.style.getPropertyValue("--chart-value-top") ?? "");
  const shownName = active ?? windowed.findLast(({ v }) => v !== null)?.name ?? null;
  const shownReading = windowed.find(({ name }) => name === shownName)?.v ?? null;
  const value =
    Number.isFinite(at) && Number.isFinite(top) && shownReading !== null
      ? {
          centre: at * plot.along,
          tip: vertical ? (top / 100) * plot.across : plot.across * (1 - top / 100),
        }
      : null;
  // ActiveValue moves with the datum it shows, and a datum it starts to show is a mark of its own.
  if (value !== null) {
    marks.set(`active value ${shownName ?? "?"}`, {
      values: [value.centre, value.tip],
      axes: ["along", "across"],
    });
  }
  const shots = guides.map((reference, index) => {
    const what = index === 0 ? "line" : "area";
    const rule = reference.querySelector("line");
    const band = reference.querySelector("rect");
    const slotAxis = reference.getAttribute("data-axis") === "slot";
    // A slot reference runs along the slot axis, and a value reference across.
    const onY = slotAxis !== vertical;
    const span: Span = rule
      ? [centreOf(rule, onY) - stroke(rule) / 2, centreOf(rule, onY) + stroke(rule) / 2]
      : band
        ? slotAxis
          ? along(rectOf(band))
          : across(rectOf(band))
        : [0, 0];
    const outside = reference.hasAttribute("data-outside");
    const own = slotAxis ? "along" : "across";
    // Mid-tween a slot line's centre can snap onto its band's far edge, and containment holds the
    // rule back by up to its own width, so its continuity allows that width more.
    const hold = rule && slotAxis ? span[1] - span[0] : 0;
    if (!outside) marks.set(`reference ${what}`, { values: span, axes: [own, own], hold });
    // DOM audit: a reference's drawing and its label are aria-hidden output inside it.
    const svg = reference.querySelector("svg");
    const label = reference.querySelector('[data-slot="chart-reference-label"]');
    return {
      what,
      outside,
      shown: svg !== null && getComputedStyle(svg).display !== "none",
      stacked: label?.hasAttribute("data-stack") === true,
      span,
    };
  });
  return { plot, baseline, bars, ticks, active, overlay, line, value, references: shots, marks };
}

// The checks.

/** The edge of a span away from the baseline: a bar's tip, or the baseline itself for a flat bar. */
function tipEdge(span: Span, baseline: number): number {
  const [a, b] = span;
  return Math.abs(a - baseline) > Math.abs(b - baseline) ? a : b;
}

const near = (a: number, b: number) => Math.abs(a - b) <= SERIAL;
const sameSpan = (a: Span, b: Span) => near(a[0], b[0]) && near(a[1], b[1]);
const show = (span: Span) => `${String(span[0])}–${String(span[1])}`;

/** The checks of every frame: one pixel per coordinate, the side, and the references' own rules. */
function faults(shot: Shot, world: World): string[] {
  const failures: string[] = [];
  const device = 1 / shot.plot.dpr;
  const { baseline } = shot;
  if (baseline === null) return ["no reference at 0"];
  const vertical = world.orientation === "vertical";
  for (const [name, bar] of shot.bars) {
    if (!bar.across.some((edge) => near(edge, baseline))) {
      failures.push(`bar ${name} ${show(bar.across)} off baseline ${String(baseline)}`);
    }
    if (bar.negative === null) continue;
    const tip = tipEdge(bar.across, baseline);
    const side =
      Math.abs(tip - baseline) < device - SERIAL ? null : vertical ? tip > baseline : tip < baseline;
    if (side !== null && bar.negative !== side)
      failures.push(`bar ${name} side ${String(bar.negative)} at ${show(bar.across)}`);
  }
  for (const [name, tick] of shot.ticks) {
    if (!near(tick.base, baseline))
      failures.push(`tick ${name} at ${String(tick.base)} off baseline ${String(baseline)}`);
    if (tick.soft) failures.push(`tick ${name} between device pixels`);
  }
  const activeBar = shot.active === null ? undefined : shot.bars.get(shot.active);
  if (activeBar !== undefined && shot.line !== null) {
    const tip = tipEdge(activeBar.across, baseline);
    const tips = {
      line: shot.line,
      overlay: shot.overlay === null ? tip : tipEdge(shot.overlay.across, baseline),
      value: shot.value?.tip ?? tip,
    };
    for (const [what, at] of Object.entries(tips)) {
      if (!near(at, tip)) failures.push(`${what} at ${String(at)} off the tip ${String(tip)}`);
    }
    // ActiveValue stands over its bar's middle, within the half pixel each of the two snaps.
    const middle = (activeBar.along[0] + activeBar.along[1]) / 2;
    if (shot.value !== null && Math.abs(shot.value.centre - middle) > device + SERIAL) {
      failures.push(`active value at ${String(shot.value.centre)} off its bar's middle ${String(middle)}`);
    }
  }
  for (const reference of shot.references) {
    if (reference.outside && reference.stacked) failures.push(`hidden ${reference.what} holds a label place`);
    if (reference.outside === reference.shown) {
      failures.push(
        `${reference.what} outside ${String(reference.outside)} but shown ${String(reference.shown)}`
      );
    }
    if (!reference.outside && reference.span[1] - reference.span[0] < device - SERIAL) {
      failures.push(`${reference.what} ${show(reference.span)} under a device pixel`);
    }
  }
  return failures;
}

/** Every mark against the model, exactly. */
function mismatches(shot: Shot, model: Expected): string[] {
  const failures: string[] = [];
  if (shot.baseline === null || !near(shot.baseline, model.baseline)) {
    failures.push(`baseline ${String(shot.baseline)}, model ${String(model.baseline)}`);
  }
  for (const [name, bar] of model.bars) {
    const drawn = shot.bars.get(name);
    if (drawn === undefined) failures.push(`bar ${name} missing`);
    else {
      if (!sameSpan(drawn.along, bar.along) || !sameSpan(drawn.across, bar.across)) {
        failures.push(
          `bar ${name} ${show(drawn.along)} × ${show(drawn.across)}, model ${show(bar.along)} × ${show(bar.across)}`
        );
      }
      if (drawn.negative !== null && drawn.negative !== bar.negative)
        failures.push(`bar ${name} side ${String(drawn.negative)}`);
    }
  }
  for (const name of shot.bars.keys())
    if (!model.bars.has(name)) failures.push(`bar ${name} drawn, model none`);
  for (const [name, tick] of model.ticks) {
    const drawn = shot.ticks.get(name);
    if (drawn === undefined || !sameSpan(drawn.along, tick.along) || !near(drawn.base, tick.base)) {
      failures.push(`tick ${name} ${drawn ? show(drawn.along) : "missing"}, model ${show(tick.along)}`);
    }
  }
  if (shot.ticks.size !== model.ticks.size)
    failures.push(`${String(shot.ticks.size)} ticks, model ${String(model.ticks.size)}`);
  if ((shot.overlay === null) !== (model.overlay === null))
    failures.push(`overlay ${shot.overlay ? "shown" : "hidden"}`);
  else if (
    shot.overlay &&
    model.overlay &&
    (!sameSpan(shot.overlay.along, model.overlay.along) ||
      !sameSpan(shot.overlay.across, model.overlay.across))
  ) {
    failures.push(
      `overlay ${show(shot.overlay.along)} × ${show(shot.overlay.across)}, model ${show(model.overlay.along)} × ${show(model.overlay.across)}`
    );
  }
  if (
    (shot.line === null) !== (model.line === null) ||
    (shot.line !== null && model.line !== null && !near(shot.line, model.line))
  ) {
    failures.push(`value line ${String(shot.line)}, model ${String(model.line)}`);
  }
  if (
    model.value !== null &&
    (shot.value === null ||
      !near(shot.value.centre, model.value.centre) ||
      !near(shot.value.tip, model.value.tip))
  ) {
    failures.push(`active value ${JSON.stringify(shot.value)}, model ${JSON.stringify(model.value)}`);
  }
  model.references.forEach((reference, index) => {
    const drawn = shot.references[index];
    if (drawn === undefined) return;
    if (drawn.outside === reference.visible) {
      failures.push(
        `${reference.what} outside ${String(drawn.outside)}, model visible ${String(reference.visible)}`
      );
    }
    if (drawn.shown !== reference.visible)
      failures.push(`${reference.what} shown ${String(drawn.shown)}, model ${String(reference.visible)}`);
    if (drawn.stacked !== reference.stacked) {
      failures.push(`${reference.what} stacked ${String(drawn.stacked)}, model ${String(reference.stacked)}`);
    }
    if (reference.visible && !sameSpan(drawn.span, reference.span)) {
      failures.push(`${reference.what} ${show(drawn.span)}, model ${show(reference.span)}`);
    }
  });
  return failures;
}

/** Marks one frame drew that moved more than they may since another, mapped by a resize's ratios. */
function jumps(before: Shot, after: Shot, keys: (key: string) => boolean): string[] {
  const ratio = {
    along: after.plot.along / before.plot.along,
    across: after.plot.across / before.plot.across,
  };
  const failures: string[] = [];
  for (const [key, mark] of before.marks) {
    if (!keys(key)) continue;
    const now = after.marks.get(key);
    if (now === undefined || now.values.length !== mark.values.length) continue;
    mark.values.forEach((value, index) => {
      const scale = ratio[mark.axes[index] ?? "across"];
      // A snapped pixel mapped and the mapped value snapped differ by half a device pixel each.
      const slack = (1 + 0.5 * Math.max(1, scale)) / after.plot.dpr + (mark.hold ?? 0) + SERIAL;
      if (Math.abs((now.values[index] ?? 0) - value * scale) > slack) {
        failures.push(`${key}: ${mark.values.join(",")} → ${now.values.join(",")}`);
      }
    });
  }
  return failures;
}

// The steps.

type Step =
  | { readonly kind: "update"; readonly readings: readonly Reading[] }
  | { readonly kind: "add"; readonly v: Reading }
  | { readonly kind: "remove"; readonly at: number }
  | { readonly kind: "reorder" }
  | { readonly kind: "swap" }
  | { readonly kind: "window"; readonly from: number; readonly span: number }
  | { readonly kind: "resize"; readonly width: number; readonly height: number }
  | { readonly kind: "turn" }
  | { readonly kind: "activate"; readonly key: "{Home}" | "{End}" | "{ArrowRight}" }
  | { readonly kind: "reference"; readonly line: Line; readonly area: Area }
  | { readonly kind: "edge"; readonly end: "low" | "high"; readonly past: number }
  | { readonly kind: "axis" }
  | { readonly kind: "wait"; readonly ms: number };

/** A fresh name for an added category, unique across the run. */
let named = 0;
const fresh = () => {
  named += 1;
  return `n${String(named)}`;
};

/** A window kept only while both its names remain, in order. */
function keepWindow(world: World, data: readonly Datum[]): World["window"] {
  if (world.window === null) return null;
  const names = data.map(({ name }) => name);
  const [a = -1, b = -1] = world.window.map((name) => names.indexOf(name));
  return a < 0 || b < a ? null : world.window;
}

/** The world a step leaves, or null for a step that renders nothing new. */
function stepped(world: World, step: Step): World | null {
  const withData = (data: readonly Datum[]): World => ({ ...world, data, window: keepWindow(world, data) });
  switch (step.kind) {
    case "update":
      return withData(
        world.data.map((datum, index) => ({
          name: datum.name,
          v: step.readings[index % step.readings.length] ?? null,
        }))
      );
    case "add":
      return world.data.length >= 100 ? null : withData([...world.data, { name: fresh(), v: step.v }]);
    case "remove":
      return world.data.length <= 3
        ? null
        : withData(world.data.filter((_, index) => index !== step.at % world.data.length));
    case "reorder":
      return withData([...world.data.slice(1), ...world.data.slice(0, 1)]);
    case "swap":
      return withData(
        world.data.length > 100
          ? world.data.slice(0, 5)
          : [
              ...world.data,
              ...Array.from({ length: 101 - world.data.length }, (_, index) => ({
                name: fresh(),
                v: 1 + (index % 7),
              })),
            ]
      );
    case "window": {
      const from = step.from % world.data.length;
      const to = Math.min(world.data.length - 1, from + step.span);
      const [a, b] = [world.data[from]?.name, world.data[to]?.name];
      const window = a === undefined || b === undefined || step.span === 0 ? null : ([a, b] as const);
      // A window that names what the chart already shows commits nothing.
      const same = window === null ? world.window === null : world.window?.join() === window.join();
      return same ? null : { ...world, window };
    }
    case "resize":
      return { ...world, width: step.width, height: step.height };
    case "turn":
      return { ...world, orientation: world.orientation === "vertical" ? "horizontal" : "vertical" };
    case "reference":
      return { ...world, line: step.line, area: step.area };
    case "edge": {
      const [low, high] = domainOf(world);
      const at = step.end === "low" ? low - step.past * (high - low) : high + step.past * (high - low);
      return { ...world, line: { axis: "value", at } };
    }
    case "axis":
      return {
        ...world,
        line:
          world.line.axis === "value"
            ? { axis: "slot", name: world.data[1]?.name ?? "c0" }
            : { axis: "value", at: 2 },
        area:
          world.area.axis === "value"
            ? { axis: "slot", first: world.data[1]?.name ?? "c0", last: world.data[2]?.name ?? "c0" }
            : { axis: "value", from: 1, to: 3 },
      };
    default:
      return null;
  }
}

/** Wait for every tween to end, then a few frames more. */
async function settle(): Promise<void> {
  const start = performance.now();
  while (performance.now() - start < 700) await frame();
}

/** Run a world through its steps, checking every sampled frame, and the model where marks rest. */
async function run(dpr: number, first: World, steps: readonly Step[]): Promise<Shot> {
  await setRatio(dpr);
  let world = first;
  const { host, rerender, unmount } = renderThemed(view(world));
  const failures: string[] = [];
  const check = (when: string): Shot => {
    const shot = shoot(host, world);
    failures.push(...faults(shot, world).map((fault) => `${when}: ${fault}`));
    return shot;
  };
  // Every mark rests on the model, in a frame where none moves.
  const atRest = (when: string): Shot => {
    const shot = check(when);
    failures.push(
      ...mismatches(shot, expected(world, shot.plot, shot.active)).map((fault) => `${when}: ${fault}`)
    );
    return shot;
  };
  try {
    await frame();
    atRest("mount");
    for (const [index, step] of steps.entries()) {
      const when = `step ${String(index)} ${step.kind}`;
      if (step.kind === "wait") {
        const start = performance.now();
        while (performance.now() - start < step.ms) {
          await frame();
          check(when);
        }
        if (step.ms >= 700) atRest(`${when} at rest`);
        continue;
      }
      if (step.kind === "activate") {
        // DOM audit: the plot's single tab stop is the listbox's option.
        host.querySelector<HTMLElement>('[role="option"]')?.focus();
        // A key step places only the followers, which join the bar the step lands on, as check 1
        // holds them in every frame from here. The key arrives over frames in which the tweens run
        // on, so no frame before it compares.
        await userEvent.keyboard(step.key);
        check(when);
        continue;
      }
      // A reference's new value is not a data update, so it waits for the guides to rest first.
      if (step.kind === "reference" || step.kind === "edge") await settle();
      const next = stepped(world, step);
      if (next === null) continue;
      const before = check(`${when} before`);
      const previous = world;
      world = next;
      rerender(view(world));
      // A follower that re-rendered without Root paints in a microtask after the commit, which the
      // browser runs before it paints, so the frame the commit shows waits for it, and no frame more.
      await Promise.resolve();
      // Which marks the commit snaps: every mark on a turn, a window, an update the path form draws
      // and an update that relays the plot, and the references a reference step changes.
      const data =
        step.kind === "update" ||
        step.kind === "add" ||
        step.kind === "remove" ||
        step.kind === "reorder" ||
        step.kind === "swap";
      const snapsAll =
        step.kind === "turn" ||
        step.kind === "window" ||
        (data && (pathForm(world) || relays(previous, world)));
      const snapsReferences = step.kind === "reference" || step.kind === "edge" || step.kind === "axis";
      if (snapsAll) {
        atRest(`${when} commit`);
        continue;
      }
      const after = check(when);
      const kept = (key: string) =>
        !(snapsReferences && key.startsWith("reference ")) &&
        !(pathForm(previous) !== pathForm(world) && (key.startsWith("bar ") || key.startsWith("column ")));
      const moved = jumps(before, after, kept);
      // A data update that mounts a mark while a tween still runs relays the plot, which the
      // browser's clock decides, so such a commit may instead snap every mark onto the model.
      const relayed =
        data && moved.length > 0 && mismatches(after, expected(world, after.plot, after.active)).length === 0;
      if (!relayed) failures.push(...moved.map((jump) => `${when}: ${jump}`));
      if (snapsReferences) {
        const model = expected(world, after.plot, after.active);
        const references = mismatches(after, model).filter(
          (fault) => fault.startsWith("line") || fault.startsWith("area")
        );
        failures.push(...references.map((fault) => `${when}: ${fault}`));
      }
    }
    await settle();
    const end = atRest("end");
    expect(failures.slice(0, 6)).toEqual([]);
    return end;
  } finally {
    unmount();
  }
}

// The worlds.

/** Readings of every magnitude, missing only at odd places, so every window holds one. */
const reading: fc.Arbitrary<number> = fc.oneof(
  { weight: 1, arbitrary: fc.constant(0) },
  {
    weight: 2,
    arbitrary: fc.double({ min: 0.01, max: 0.2, noNaN: true }).chain((size) => fc.constantFrom(size, -size)),
  },
  { weight: 6, arbitrary: fc.integer({ min: -9, max: 9 }) }
);
const readings = fc
  .array(fc.tuple(reading, fc.boolean()), { minLength: 101, maxLength: 101 })
  .map((list) => list.map(([value, missing], index): Reading => (missing && index % 2 === 1 ? null : value)));

/** Category names c0, c1, … for a list of readings. */
const namedFrom = (list: readonly Reading[]): readonly Datum[] =>
  list.map((v, index) => ({ name: `c${String(index)}`, v }));

const line: fc.Arbitrary<Line> = fc.oneof(
  fc.constantFrom(10.015, 9.99, -10.01, 0, 2.5, 4).map((at): Line => ({ axis: "value", at })),
  fc.integer({ min: 0, max: 5 }).map((index): Line => ({ axis: "slot", name: `c${String(index)}` }))
);
const area: fc.Arbitrary<Area> = fc.oneof(
  fc
    .constantFrom([0.001, 0.005], [9.999, 10.02], [-10.02, -10.01], [-3, 4])
    .map(([from = 0, to = 0]): Area => ({ axis: "value", from, to })),
  fc
    .integer({ min: 0, max: 3 })
    .map((index): Area => ({ axis: "slot", first: `c${String(index)}`, last: `c${String(index + 1)}` }))
);

const step: fc.Arbitrary<Step> = fc.oneof(
  { weight: 3, arbitrary: readings.map((list): Step => ({ kind: "update", readings: list })) },
  { weight: 1, arbitrary: fc.oneof(reading, fc.constant(null)).map((v): Step => ({ kind: "add", v })) },
  { weight: 1, arbitrary: fc.nat().map((at): Step => ({ kind: "remove", at })) },
  { weight: 1, arbitrary: fc.constant<Step>({ kind: "reorder" }) },
  { weight: 1, arbitrary: fc.constant<Step>({ kind: "swap" }) },
  {
    weight: 1,
    arbitrary: fc
      .record({ from: fc.nat(), span: fc.integer({ min: 0, max: 4 }) })
      .map(({ from, span }): Step => ({ kind: "window", from, span })),
  },
  {
    weight: 2,
    arbitrary: fc
      .record({
        width: fc.double({ min: 280, max: 520, noNaN: true }),
        height: fc.double({ min: 150, max: 320, noNaN: true }),
      })
      .map(({ width, height }): Step => ({
        kind: "resize",
        width: Math.round(width * 4) / 4,
        height: Math.round(height * 4) / 4,
      })),
  },
  { weight: 1, arbitrary: fc.constant<Step>({ kind: "turn" }) },
  {
    weight: 2,
    arbitrary: fc
      .constantFrom("{Home}", "{End}", "{ArrowRight}")
      .map((key): Step => ({ kind: "activate", key })),
  },
  {
    weight: 1,
    arbitrary: fc
      .record({ line, area })
      .map(({ line: l, area: a }): Step => ({ kind: "reference", line: l, area: a })),
  },
  {
    weight: 1,
    arbitrary: fc
      .record({
        end: fc.constantFrom("low" as const, "high" as const),
        past: fc.constantFrom(0, 1e-4, -1e-4),
      })
      .map(({ end, past }): Step => ({ kind: "edge", end, past })),
  },
  { weight: 1, arbitrary: fc.constant<Step>({ kind: "axis" }) },
  {
    weight: 4,
    arbitrary: fc
      .oneof(fc.integer({ min: 16, max: 60 }), fc.integer({ min: 150, max: 260 }), fc.constant(700))
      .map((ms): Step => ({ kind: "wait", ms })),
  }
);

/** A five-category world on 400 × 200 px over [-10, 10]. */
const FIVE: World = {
  orientation: "vertical",
  width: 400,
  height: 200,
  data: namedFrom([3, -2, null, 0.1, 7]),
  window: null,
  line: { axis: "value", at: 2.5 },
  area: { axis: "value", from: -3, to: 4 },
  variant: "default",
  include: [-10, 10],
};

/** The values `yInclude` holds: a fixed domain, one the data moves, and one off zero. */
const include = fc.constantFrom<readonly [number, number]>([-10, 10], [0, 1], [0, 4], [-2, 6]);

/** Readings for every category of a 101-category world, the rest at 1. */
const rest = (list: readonly Reading[]): readonly Reading[] => [
  ...list,
  ...Array.from({ length: 101 - list.length }, () => 1),
];

describe("one world of marks", () => {
  it("keeps every mark on the model at rest and coherent between, through any commits, at any ratio", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(1, 1.25, 1.5, 2),
        fc.record({
          orientation: fc.constantFrom("vertical" as const, "horizontal" as const),
          readings: readings.map((list) => list.slice(0, 5)),
          include,
          line,
          area,
        }),
        fc.array(step, { minLength: 2, maxLength: 7 }),
        async (dpr, start, steps) => {
          const { readings: list, ...others } = start;
          await run(dpr, { ...FIVE, ...others, data: namedFrom(list) }, steps);
        }
      ),
      {
        numRuns: 14,
        // Every run checks a resize, a key step and a path-form update while a data update runs, a
        // window that leaves a slot reference outside, and a resize while a slot line glides.
        examples: [
          [
            1.5,
            {
              orientation: "vertical",
              readings: [3, -2, null, 0.1, 7],
              include: [-10, 10],
              line: { axis: "value", at: 0 },
              area: { axis: "value", from: 0.001, to: 0.005 },
            },
            [
              { kind: "update", readings: rest([-4, 2, null, -0.1, 7]) },
              { kind: "wait", ms: 150 },
              { kind: "resize", width: 410.25, height: 250.5 },
              { kind: "wait", ms: 60 },
              { kind: "activate", key: "{Home}" },
              { kind: "swap" },
              { kind: "update", readings: rest([6, null, 2]) },
              { kind: "wait", ms: 30 },
            ],
          ],
          [
            1.25,
            {
              orientation: "horizontal",
              readings: [2, null, -0.05, 4, -6],
              include: [0, 4],
              line: { axis: "slot", name: "c4" },
              area: { axis: "slot", first: "c0", last: "c1" },
            },
            [
              { kind: "activate", key: "{End}" },
              { kind: "window", from: 0, span: 2 },
              { kind: "update", readings: rest([-2, null, 0.05, -4, 6]) },
              { kind: "wait", ms: 200 },
              { kind: "axis" },
              { kind: "turn" },
            ],
          ],
          [
            2,
            {
              orientation: "vertical",
              readings: [2, null, 0.0149, null, 5],
              include: [-10, 10],
              line: { axis: "slot", name: "c2" },
              area: { axis: "slot", first: "c1", last: "c2" },
            },
            [
              { kind: "resize", width: 409.75, height: 318.75 },
              { kind: "add", v: -6 },
              { kind: "resize", width: 487.75, height: 174.75 },
            ],
          ],
        ],
      }
    );
  }, 600_000);

  it("moves ActiveValue with its bar when a category joins (B12-1, Q12-1)", async () => {
    // 400 px over [0, 4] with a active: b joins, a slides from a centre of 200 to 100 px, and the
    // value over a slides with it rather than jumping.
    const world: World = { ...FIVE, include: [0, 4], data: [{ name: "a", v: 2 }] };
    await run(1, world, [
      { kind: "activate", key: "{Home}" },
      { kind: "update", readings: [3] },
      { kind: "wait", ms: 700 },
      { kind: "add", v: 1 },
      { kind: "wait", ms: 120 },
      { kind: "wait", ms: 600 },
    ]);
  });

  it("keeps a slot line outside an x range window outside (B12-2)", async () => {
    // 401 categories and a window of c0 to c399 on 200 px: c400's centre lies past the plot, so its
    // labelled line hides and holds no label place, though its band would floor onto 199–200.
    const data = Array.from({ length: 401 }, (_, index): Datum => ({ name: `c${String(index)}`, v: 1 }));
    const world: World = {
      ...FIVE,
      width: 200,
      data,
      window: ["c0", "c399"],
      line: { axis: "slot", name: "c400" },
    };
    const end = await run(1, world, []);
    expect(end.references.find(({ what }) => what === "line")?.outside).toBe(true);
  });

  it("snaps a reference at 0 with the bars when the path form switches to elements (B12-3)", async () => {
    // 101 categories over [0, 4], the last at -4, draw as paths over [-4, 4]. Dropping the last
    // draws elements over [0, 4]: the bars mount at their targets, and the reference at 0 and the
    // rest of the plot snap with them.
    const data = Array.from({ length: 101 }, (_, index): Datum => ({
      name: `c${String(index)}`,
      v: index === 100 ? -4 : 2,
    }));
    await run(1, { ...FIVE, include: [0, 4], data }, [
      { kind: "remove", at: 100 },
      { kind: "wait", ms: 60 },
    ]);
  });

  it("hides a value line just past the domain's trailing edge (Q12-3)", async () => {
    // -10.01 over [-10, 10] lies past the plot's bottom edge, so the line hides, as the model says,
    // and a line exactly on the edge shows.
    await run(1, { ...FIVE, line: { axis: "value", at: -10.01 } }, [
      { kind: "edge", end: "low", past: 0 },
      { kind: "edge", end: "high", past: 1e-4 },
    ]);
  });

  it("keeps a value line's width a size through a resize mid-tween (Q12-2)", async () => {
    // A resize maps a running tween's coordinates and leaves its sizes alone, so every width the
    // line writes in the commit that doubles the plot is the 1 px hairline.
    await setRatio(1);
    const world: World = {
      ...FIVE,
      include: [0, 1],
      data: namedFrom([1, 1, 1, 1, 1]),
      line: { axis: "value", at: 1 },
    };
    const moved = { ...world, data: namedFrom([4, 1, 1, 1, 1]) };
    const { host, rerender, unmount } = renderThemed(view(world));
    try {
      // DOM audit: the labelled line is the second reference.
      const reference = host.querySelectorAll<HTMLElement>('[data-slot="chart-reference-line"]')[1];
      if (reference === undefined) throw new Error("no line");
      rerender(view(moved));
      for (let count = 0; count < 6; count += 1) await frame();
      const styles: string[] = [];
      const observer = new MutationObserver((records) => {
        for (const record of records) styles.push(record.oldValue ?? "");
      });
      observer.observe(reference, { attributes: true, attributeFilter: ["style"], attributeOldValue: true });
      rerender(view({ ...moved, height: 400 }));
      styles.push(...observer.takeRecords().map((record) => record.oldValue ?? ""));
      styles.push(reference.getAttribute("style") ?? "");
      observer.disconnect();
      const widths = styles.flatMap((style) =>
        [...style.matchAll(/--_rule-width:\s*([\d.]+)px/gu)].map(([, px]) => Number(px))
      );
      expect(widths.length).toBeGreaterThan(0);
      expect(widths).toEqual(widths.map(() => 1));
    } finally {
      unmount();
    }
  });
});
