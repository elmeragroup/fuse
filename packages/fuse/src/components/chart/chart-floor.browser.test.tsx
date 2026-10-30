// Every mark Chromium draws in the plot, against the device pixels, in random dense charts.
// Unit under test: the whole geometry path from the model to the SVG attributes, for every SVG
// mark phase 1 draws: bars and their looks' parts, path columns and emphasis, missing ticks in
// both forms, the active overlay, the grid, both crosshairs, reference lines and areas on both
// axes, and the active value line. FLOOR_MARKS lists them, a source contract holds the list to the
// chart source, and WALKERS walks each one. Oracle: the device pixel grid itself. Chromium draws
// an SVG layer's origin on the device pixel nearest its page position, so a mark's drawn span is
// that origin plus its attributes, and clips it to the plot's box, whose edges it rounds the same
// way. A slot's band covers the device pixels from the one its start lies in to the one its end
// lies in, among the plot's, and a slot wholly outside them covers the plot's nearest pixel. Each
// mark of a slot must draw at least one device pixel inside the pixels its slot covers, and every
// rule and band of the value axis inside the plot.
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { cdp, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { FLOOR_MARKS } from "../../../test/chart/floor-marks";
import type { FloorMark } from "../../../test/chart/floor-marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import type { BarVariant } from "./layout/bar-shapes";

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

const VARIANTS: readonly BarVariant[] = [
  "default",
  "hatched",
  "duotone",
  "duotone-reverse",
  "gradient",
  "striped",
  "blocks",
  "expandable",
  "isometric",
];

/** How far a computed style may stray from what it stands for: it serializes six decimals. */
const SERIAL = 1e-5;

/** One colour per series of a group. */
const COLORS = ["chart-1", "chart-2", "chart-3"] as const;

/** One random dense chart and the guides drawn on it. */
type Dense = {
  readonly count: number;
  readonly length: number;
  readonly group: number;
  readonly variant: BarVariant;
  readonly orientation: "vertical" | "horizontal";
  readonly missing: readonly boolean[];
  readonly offset: number;
  readonly crosshair: "band" | "line";
  /** The active slot: the first or the last. */
  readonly last: boolean;
  /** The slot a slot reference line marks, and the first and last slot of a slot area. */
  readonly line: number;
  readonly from: number;
  readonly span: number;
};

/** A reading of 1 to 4 for a series at a slot, the same in the chart and in the oracle. */
function reading(slot: number, series: number): number {
  return 1 + ((slot + series) % 4);
}

/** The chart: `group` series side by side, missing where the list says, with every guide. */
function render(chart: Dense) {
  const { count, length, group, variant, orientation, missing, offset } = chart;
  const keys = Array.from({ length: group }, (_, index) => `s${String(index)}`);
  const config: ChartConfig = Object.fromEntries(
    keys.map((key, index) => [key, { label: key, color: COLORS[index] ?? "chart-1", qualityKey: "q" }])
  );
  const rows = Array.from({ length: count }, (_, slot) => ({
    name: `c${String(slot)}`,
    q: missing[slot] === true ? "missing" : "measured",
    ...Object.fromEntries(
      keys.map((key, index) => [key, missing[slot] === true ? null : reading(slot, index)])
    ),
  }));
  const bars = keys.map((key) => <Chart.Bar key={key} dataKey={key} variant={variant} emphasis="max" />);
  const vertical = orientation === "vertical";
  const line = chart.line % count;
  const from = chart.from % count;
  const to = Math.min(count - 1, from + chart.span);
  return renderThemed(
    <LocaleProvider locale="nb-NO">
      <div style={{ marginLeft: offset, marginTop: offset, width: vertical ? length : 300 }}>
        <Chart.Root
          data-intro="none"
          data={rows}
          config={config}
          xKey="name"
          orientation={orientation}
          style={{ "--chart-plot-height": `${String(vertical ? 160 : length)}px` }}
          aria-label="Tett">
          <Chart.Grid orientation="both" />
          {group > 1 ? <Chart.BarGroup series={keys}>{bars}</Chart.BarGroup> : bars}
          <Chart.Crosshair variant={chart.crosshair} />
          <Chart.ReferenceLine x={`c${String(line)}`} label="Linje" />
          {/* Every reading is 1 or more, so every domain with a reading holds these values. */}
          <Chart.ReferenceLine y={0.5} label="Mål" />
          <Chart.ReferenceArea x1={`c${String(from)}`} x2={`c${String(to)}`} label="Spenn" />
          <Chart.ReferenceArea y1={0.25} y2={0.75} />
          <Chart.ActiveValueLine dataKey="s0">
            <Chart.ValueLabel />
          </Chart.ActiveValueLine>
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

/** The rectangles of a path written as closed rectangles, and the horizontal ticks of another. */
function pathRects(d: string): { x: number; y: number; width: number; height: number }[] {
  return [...d.matchAll(/M([-\d.e]+) ([-\d.e]+)H([-\d.e]+)V([-\d.e]+)H[-\d.e]+Z/gu)].map(
    ([, x, y, x2, y2]) => ({
      x: Number(x),
      y: Number(y),
      width: Number(x2) - Number(x),
      height: Number(y2) - Number(y),
    })
  );
}

function pathTicks(d: string): [number, number][] {
  return [...d.matchAll(/M([-\d.e]+) [-\d.e]+H([-\d.e]+)/gu)].map(([, x, x2]) => [Number(x), Number(x2)]);
}

/** A span in device pixels. */
type Span = readonly [number, number];

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** What every walker reads: the plot's drawn origin and size, the slots, and the checks. */
type Walk = {
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
  /** Check a mark of the value axis inside the plot along it. */
  readonly inPlot: (what: string, span: Span) => void;
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
  return {
    x: Number(element.getAttribute("x")),
    y: Number(element.getAttribute("y")),
    width: Number(element.getAttribute("width")),
    height: Number(element.getAttribute("height")),
  };
}

/** A line's endpoints as a box, which its stroke widens by half the stroke's width each side. */
function ruleBox(line: Element): Box {
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

/** The slots a series emphasises with `emphasis="max"`: every present slot of its largest reading. */
function maxima(walk: Walk, series: number): number[] {
  const top = Math.max(...walk.present.map((slot) => reading(slot, series)));
  return walk.present.filter((slot) => reading(slot, series) === top);
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

/** One walker for every mark, so a mark added to the list without a walker fails to compile. */
type Walkers = { readonly [Mark in FloorMark]: Walker };

const WALKERS: Walkers = {
  "chart-bar": (walk) => {
    let checked = 0;
    for (const layer of walk.layers) {
      const bars = barsOf(layer);
      if (bars.length === 0) continue;
      expect(bars).toHaveLength(walk.present.length);
      bars.forEach((bar, index) => {
        // DOM audit: a bar's body carries the bar's slot.
        const body = bar.tagName === "g" ? bar.querySelector('[data-slot="chart-bar"]') : bar;
        if (body === null) return;
        const slot = walk.present[index] ?? -1;
        walk.inSlots("bar", slot, slot, walk.along(box(body)));
        checked += 1;
      });
    }
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
          if (part.tagName === "rect") walk.inSlots(name, slot, slot, walk.along(box(part)));
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
    for (const layer of walk.layers) {
      // DOM audit: the path form's paths are aria-hidden plot output.
      const paths = [...layer.querySelectorAll('[data-slot="chart-bar-path"]')];
      if (paths.length === 0) continue;
      const columns = paths
        .filter((path) => path.getAttribute("data-quality") !== "missing")
        .flatMap((path) => pathRects(path.getAttribute("d") ?? ""))
        .toSorted((a, b) => a.x - b.x);
      expect(columns).toHaveLength(walk.present.length);
      columns.forEach((rect, index) => {
        const slot = walk.present[index] ?? -1;
        walk.inSlots("column", slot, slot, [rect.x, rect.x + rect.width]);
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
    }
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
      const slots = maxima(walk, series);
      expect(overlays).toHaveLength(slots.length);
      overlays.forEach((rect, index) => {
        const slot = slots[index] ?? -1;
        walk.inSlots("emphasis", slot, slot, [rect.x, rect.x + rect.width]);
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
    for (const layer of walk.layers) {
      // DOM audit: the active overlay is aria-hidden plot output.
      const overlay = layer.querySelector('[data-slot="chart-bar-active"]');
      if (overlay?.getAttribute("visibility") !== "visible") continue;
      walk.inSlots("overlay", walk.active, walk.active, walk.along(box(overlay)));
      checked += 1;
    }
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
      walk.host.querySelector('[data-slot="chart"]')?.hasAttribute("data-active") !== true
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

describe("every drawn mark under the pixel floor", () => {
  it("walks every mark the chart source draws", () => {
    expect(Object.keys(WALKERS).toSorted()).toEqual([...FLOOR_MARKS].toSorted());
  });

  it("draws each mark one device pixel wide or more, inside its slot band or the plot", async () => {
    const dense = fc.record({
      count: fc.integer({ min: 20, max: 400 }),
      length: fc.integer({ min: 100, max: 400 }),
      group: fc.integer({ min: 1, max: 3 }),
      variant: fc.constantFrom(...VARIANTS),
      orientation: fc.constantFrom("vertical" as const, "horizontal" as const),
      // About one reading in seven is missing.
      missing: fc.array(
        fc.integer({ min: 0, max: 6 }).map((draw) => draw === 0),
        { minLength: 400, maxLength: 400 }
      ),
      offset: fc.double({ min: 0, max: 3, noNaN: true }),
      crosshair: fc.constantFrom("band" as const, "line" as const),
      last: fc.boolean(),
      line: fc.nat(),
      from: fc.nat(),
      span: fc.integer({ min: 0, max: 3 }),
    });
    const DENSE: Dense = {
      count: 400,
      length: 200,
      group: 1,
      variant: "default",
      orientation: "vertical",
      missing: Array.from({ length: 400 }, (_, slot) => slot === 0),
      offset: 0,
      crosshair: "line",
      last: true,
      line: 399,
      from: 0,
      span: 0,
    };
    await fc.assert(
      fc.asyncProperty(dense, fc.constantFrom(1, 1.25, 1.5, 2, 3), async (chart, dpr) => {
        await session().send("Emulation.setDeviceMetricsOverride", {
          width: 1024,
          height: 768,
          deviceScaleFactor: dpr,
          mobile: false,
        });
        await frame();
        const { host, unmount } = render(chart);
        try {
          // DOM audit: the plot's single tab stop is the listbox's option.
          host.querySelector<HTMLElement>('[role="option"]')?.focus();
          await userEvent.keyboard(chart.last ? "{End}" : "{Home}");
          await frame();
          await frame();
          const vertical = chart.orientation === "vertical";
          // DOM audit: each Bar's layer is aria-hidden plot output, one per series in order.
          const layers = [...host.querySelectorAll('[data-slot="chart-bar-series"]')];
          expect(layers).toHaveLength(chart.group);
          const plot = layers[0]?.getBoundingClientRect() ?? new DOMRect();
          const page = vertical ? plot.left : plot.top;
          const length = vertical ? plot.width : plot.height;
          const breadth = vertical ? plot.height : plot.width;
          // The drawn origin, on the device pixel nearest the layer's page position.
          const origin = Math.ceil(page * dpr - 0.5) / dpr;
          // The drawn origin on each axis, for rules that run either way.
          const origins = {
            x: Math.ceil(plot.left * dpr - 0.5) / dpr,
            y: Math.ceil(plot.top * dpr - 0.5) / dpr,
          };
          // 1 px rounded down to whole device pixels, at least one.
          const hairline = Math.max(1, Math.floor(dpr));
          // The plot's first and last drawn device pixel edges.
          const first = Math.ceil(page * dpr - 0.5);
          const last = Math.ceil((page + length) * dpr - 0.5);
          const cover = (slot: number): Span => {
            const low = Math.max(first, Math.floor((page + (slot * length) / chart.count) * dpr + 1e-6));
            const high = Math.min(last, Math.ceil((page + ((slot + 1) * length) / chart.count) * dpr - 1e-6));
            if (low < high) return [low, high];
            return low >= last ? [last - 1, last] : [first, first + 1];
          };
          const present = Array.from({ length: chart.count }, (_, slot) => slot).filter(
            (slot) => chart.missing[slot] !== true
          );
          // An empty chart, every reading missing, draws no missing marker, as section 8.13 says.
          const absent =
            present.length === 0
              ? []
              : Array.from({ length: chart.count }, (_, slot) => slot).filter(
                  (slot) => chart.missing[slot] === true
                );
          const failures: string[] = [];
          const walk: Walk = {
            host,
            chart,
            vertical,
            layers,
            present,
            absent,
            active: chart.last ? chart.count - 1 : 0,
            along: (rect) => (vertical ? [rect.x, rect.x + rect.width] : [rect.y, rect.y + rect.height]),
            across: (rect) => (vertical ? [rect.y, rect.y + rect.height] : [rect.x, rect.x + rect.width]),
            inSlots: (what, first, last, [start, end]) => {
              const drawn: Span = [(origin + start) * dpr, (origin + end) * dpr];
              const low = cover(first)[0];
              const high = cover(last)[1];
              if (drawn[1] - drawn[0] < 1 - SERIAL || drawn[0] < low - SERIAL || drawn[1] > high + SERIAL) {
                failures.push(
                  `${what} of ${String(first)}–${String(last)}: ${drawn.join("–")} in ${String(low)}–${String(high)}`
                );
              }
            },
            crisp: (what, axis, [start, end], width) => {
              const edges = [(origins[axis] + start) * dpr, (origins[axis] + end) * dpr];
              const [low = 0, high = 0] = edges;
              const whole = edges.every((edge) => Math.abs(edge - Math.round(edge)) < SERIAL);
              const wide =
                width === "hairline"
                  ? Math.abs(high - low - hairline) < SERIAL
                  : high - low > 1 - SERIAL && high - low < hairline + SERIAL;
              if (!whole || !wide)
                failures.push(`${what} soft: ${edges.join("–")} for a ${String(hairline)} px hairline`);
            },
            centred: (what, label, rule) => {
              // Layout keeps positions in 1/64 px.
              if (Math.abs(label - rule) > 1 / 64 + SERIAL)
                failures.push(`${what} at ${String(label)} off its rule at ${String(rule)}`);
            },
            inPlot: (what, [start, end]) => {
              // A rule may start on the plot's far edge, as the zero line runs past the bars' base.
              if (end - start < 1 / dpr - SERIAL || start < -SERIAL || start > breadth + SERIAL) {
                failures.push(`${what}: ${String(start)}–${String(end)} in 0–${String(breadth)}`);
              }
            },
          };
          const counts = new Map(FLOOR_MARKS.map((mark) => [mark, WALKERS[mark](walk)] as const));
          // DOM audit: counts every rendered mark of a slot, which the walkers check.
          const rendered = (mark: FloorMark) => host.querySelectorAll(`[data-slot="${mark}"]`).length;
          expect(failures.slice(0, 5)).toEqual([]);
          // The marks every chart draws: the grid, the crosshair and the four references.
          expect(counts.get("chart-grid-line")).toBeGreaterThan(0);
          expect(counts.get("chart-crosshair-mark")).toBe(present.length === 0 ? 0 : 1);
          expect(counts.get("chart-reference-rule")).toBe(2);
          expect(counts.get("chart-reference-band")).toBe(2);
          expect(rendered("chart-reference-rule") + rendered("chart-reference-band")).toBe(4);
        } finally {
          unmount();
        }
      }),
      {
        numRuns: 40,
        // Every run checks the dense charts that broke the floor in review: a missing first
        // reading, a one-slot area and a line crosshair on the last of 400 on 200 px, and a group
        // whose gaps outgrow 38 bands on 100 px. Then three at 1.5x: grouped missing ticks on a
        // plot whose origin lies on a half device pixel, a slot reference line on a band two
        // device pixels wide, and a last slot in the half pixel past the plot's drawn end. Then
        // every rule at 1.25x and 1.5x, in both orientations, on a plot a fraction of a pixel in,
        // with a slot line and the line crosshair in the middle, where their labels centre.
        examples: [
          [DENSE, 1],
          [
            {
              ...DENSE,
              count: 38,
              length: 100,
              group: 2,
              variant: "expandable",
              crosshair: "band",
              last: false,
            },
            1,
          ],
          [
            {
              ...DENSE,
              count: 29,
              length: 101,
              group: 2,
              missing: Array.from({ length: 400 }, (_, slot) => slot < 28),
              offset: 3,
              crosshair: "band",
              last: false,
              line: 0,
            },
            1.5,
          ],
          [{ ...DENSE, count: 265, length: 393, group: 2, offset: 3, crosshair: "band", line: 111 }, 1.5],
          [{ ...DENSE, count: 392, length: 101, crosshair: "band", last: false, line: 18 }, 1.5],
          [{ ...DENSE, count: 40, length: 301, offset: 0.4, last: false, line: 20 }, 1.25],
          [{ ...DENSE, count: 40, length: 301, offset: 0.4, last: false, line: 20 }, 1.5],
          [{ ...DENSE, count: 40, length: 301, offset: 0.4, orientation: "horizontal", line: 20 }, 1.25],
        ],
      }
    );
  }, 240_000);
});
