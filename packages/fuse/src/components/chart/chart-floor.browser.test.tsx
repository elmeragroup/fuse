// Every mark Chromium draws in the plot, against the device pixels, in random dense charts.
// Unit under test: the whole geometry path from the model to the SVG attributes, for every SVG
// mark the parts draw: bars and their looks' parts, path columns and emphasis, missing ticks in
// both forms, the active overlay, the grid, both crosshairs, reference lines and areas on both
// axes, the active value line, a step line's and a step area's runs, dots, a marker and the
// active dot. FLOOR_MARKS lists them, a source contract holds the list to the
// chart source, and WALKERS walks each one. Oracle: the device pixel grid itself. Chromium draws
// an SVG layer's origin on the device pixel nearest its page position, so a mark's drawn span is
// that origin plus its attributes, and clips it to the plot's box, whose edges it rounds the same
// way. Under the owner's slot grid, a plot with a whole device pixel or more per slot gives each
// slot the same whole pixels from a start that splits the leftover between both ends.
// Otherwise a slot's band covers the device pixels from the one its start lies in to the one its
// end lies in, among the plot's, and a slot wholly outside them covers the plot's nearest pixel. Each
// mark of a slot must draw at least one device pixel inside the pixels its slot covers, and every
// rule and band of the value axis inside the plot. Along the value axis every bar, path column,
// emphasis box and active overlay of a non-zero reading, some far under a device pixel, must draw
// at least one device pixel inside the plot, its base on the zero rule's near edge, which the grid
// draws on its own, and its far edge on the reading's side of it, and a reading of 0 none. The
// scenario model and the walkers live in test/chart/floor-walkers.ts.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { FLOOR_MARKS } from "../../../test/chart/floor-marks";
import type { FloorMark } from "../../../test/chart/floor-marks";
import {
  DECIMATE_ABOVE,
  WALKERS,
  floorFault,
  missingAt,
  reading,
  ruleBox,
} from "../../../test/chart/floor-walkers";
import type { Dense, Span, Walk } from "../../../test/chart/floor-walkers";
import { SERIAL } from "../../../test/chart/world-model";
import { emulatePixelRatio } from "../../../test/page-metrics";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartBarVariant, ChartConfig, ChartSeriesConfig } from "./chart-types";
import "./chart.css";

async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

const VARIANTS: readonly ChartBarVariant[] = [
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

/** One colour per series of a group. */
const COLORS = ["chart-1", "chart-2", "chart-3"] as const;

/** The chart: `group` series side by side, missing where the list says, with every guide. */
function render(chart: Dense) {
  const { count, length, group, variant, orientation, offset } = chart;
  const keys = Array.from({ length: group }, (_, index) => `s${String(index)}`);
  const panelled = chart.panels && orientation === "vertical";
  // With Panels the upper Panel draws a series of its own.
  const series = (
    key: string,
    color: ChartSeriesConfig["color"],
    look: ChartSeriesConfig["barVariant"] = "default"
  ): [string, ChartSeriesConfig] => {
    const own: ChartSeriesConfig = { label: key, color, qualityKey: "q", barVariant: look };
    return [key, stacked && (key === "s0" || key === "under") ? { ...own, stack: "s" } : own];
  };
  // Where the chart asks, its one series stacks on a series of zeros that draws no Bar, so its marks
  // floor through the stack floors as a stack's outer segment, the only one with length.
  const stacked = chart.stacked && group === 1;
  const entries = keys.map((key, index) => series(key, COLORS[index] ?? "chart-1", variant));
  if (stacked) entries.unshift(series("under", "chart-2"));
  if (panelled) entries.push(series("upper", "chart-4"));
  const config: ChartConfig = Object.fromEntries(entries);
  // Every row holds the upper Panel's reading, which only a chart with Panels reads.
  const rows = Array.from({ length: count }, (_, slot) => ({
    name: `c${String(slot)}`,
    q: missingAt(chart, slot) ? "missing" : "measured",
    upper: reading(slot, 3, { small: false, peak: false }),
    under: 0,
    ...Object.fromEntries(
      keys.map((key, index) => [key, missingAt(chart, slot) ? null : reading(slot, index, chart)])
    ),
  }));
  // A present reading under 1, as `chart.emphasis` "small" emphasises it.
  const under = (series: number) =>
    Array.from({ length: count }, (_, slot) => slot).filter(
      (slot) => !missingAt(chart, slot) && Math.abs(reading(slot, series, chart)) < 1
    );
  const bars = keys.map((key, index) => (
    <Chart.Bar
      key={key}
      dataKey={key}
      emphasis={chart.emphasis === "max" ? "max" : { x: under(index).map((slot) => `c${String(slot)}`) }}
    />
  ));
  const vertical = orientation === "vertical";
  const line = chart.line % count;
  const from = chart.from % count;
  const to = Math.min(count - 1, from + chart.span);
  const decimated = count > DECIMATE_ABOVE;
  const marks = (
    <>
      <Chart.Grid orientation="both" />
      {group > 1 ? <Chart.BarGroup series={keys}>{bars}</Chart.BarGroup> : bars}
      <Chart.Crosshair variant={chart.crosshair} />
      <Chart.ReferenceLine x={`c${String(line)}`} label="Linje" />
      {/* Every chart reads 1 or more somewhere, so every domain with a reading holds these values. */}
      <Chart.ReferenceLine y={0.5} label="Mål" />
      <Chart.ReferenceArea x1={`c${String(from)}`} x2={`c${String(to)}`} label="Spenn" />
      <Chart.ReferenceArea y1={0.25} y2={0.75} />
      <Chart.ActiveValueLine dataKey="s0">
        <Chart.ValueLabel />
      </Chart.ActiveValueLine>
      {/* Step runs fill their cells, so a line and an area of the first series walk like bars.
          A decimated window's line keeps only some readings, which these walks do not model. */}
      {decimated ? null : (
        <>
          <Chart.Area dataKey="s0" curve="step-after" variant="solid" />
          <Chart.Line dataKey="s0" curve={chart.curve} variant={chart.stroke} />
          <Chart.Dots dataKey="s0" />
          <Chart.Marker dataKey="s0" at="max" />
          <Chart.ActiveDot dataKey="s0" />
        </>
      )}
    </>
  );
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
          {panelled ? (
            <>
              <Chart.Panel series={["upper"]}>
                <Chart.Grid />
                <Chart.Bar dataKey="upper" />
              </Chart.Panel>
              {/* The series of zeros a stacked chart's series stacks on sits in its Panel. */}
              <Chart.Panel series={stacked ? ["under", ...keys] : keys}>{marks}</Chart.Panel>
            </>
          ) : (
            marks
          )}
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

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
      stroke: fc.constantFrom("default" as const, "quiet" as const),
      curve: fc.constantFrom("step-after" as const, "step" as const),
      last: fc.boolean(),
      small: fc.boolean(),
      peak: fc.boolean(),
      emphasis: fc.constantFrom("max" as const, "small" as const),
      stacked: fc.boolean(),
      line: fc.nat(),
      from: fc.nat(),
      span: fc.integer({ min: 0, max: 3 }),
      panels: fc.boolean(),
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
      stroke: "default",
      curve: "step-after",
      last: true,
      small: false,
      peak: false,
      emphasis: "max",
      stacked: false,
      line: 399,
      from: 0,
      span: 0,
      panels: false,
    };
    await fc.assert(
      fc.asyncProperty(dense, fc.constantFrom(1, 1.25, 1.5, 2, 3), async (chart, dpr) => {
        await emulatePixelRatio(dpr);
        await frame();
        const { host: root, unmount } = render(chart);
        try {
          // With Panels the walk reads the lower Panel, whose plot origin lies below the upper's.
          // DOM audit: a Panel is a plot section with no role of its own, so its slot is the only locator.
          const host =
            chart.panels && chart.orientation === "vertical"
              ? (root.querySelectorAll<HTMLElement>('[data-slot="chart-panel"]')[1] ?? root)
              : root;
          // DOM audit: the plot's single tab stop is the listbox's option.
          root.querySelector<HTMLElement>('[role="option"]')?.focus();
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
          // The plot's drawn length along the value axis, between its edges' device pixels.
          const acrossPage = vertical ? plot.top : plot.left;
          const drawnBreadth =
            (Math.ceil((acrossPage + breadth) * dpr - 0.5) - Math.ceil(acrossPage * dpr - 0.5)) / dpr;
          // DOM audit: grid lines are aria-hidden plot output, and the zero line carries data-zero.
          const zeroRule = host.querySelector('[data-slot="chart-grid-line"][data-zero]');
          // The zero rule starts at its coordinate, its near edge, as a CSS border does.
          const zero = zeroRule === null ? null : vertical ? ruleBox(zeroRule).y : ruleBox(zeroRule).x;
          // The owner's slot grid: every band takes the same whole pixels, at least one, from a start
          // that splits the leftover between both ends.
          const pixels = last - first;
          const whole = Math.floor(pixels / chart.count);
          const leftover = pixels - chart.count * whole;
          const lead = whole >= 1 ? first + Math.floor(leftover / 2) : null;
          const cover = (slot: number): Span => {
            if (lead !== null) return [lead + slot * whole, lead + (slot + 1) * whole];
            const low = Math.max(first, Math.floor((page + (slot * length) / chart.count) * dpr + 1e-6));
            const high = Math.min(last, Math.ceil((page + ((slot + 1) * length) / chart.count) * dpr - 1e-6));
            if (low < high) return [low, high];
            return low >= last ? [last - 1, last] : [first, first + 1];
          };
          const present = Array.from({ length: chart.count }, (_, slot) => slot).filter(
            (slot) => !missingAt(chart, slot)
          );
          // An empty chart, every reading missing, draws no missing marker, as section 8.13 says.
          const absent =
            present.length === 0
              ? []
              : Array.from({ length: chart.count }, (_, slot) => slot).filter((slot) =>
                  missingAt(chart, slot)
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
            read: (slot, series) => reading(slot, series, chart),
            zero,
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
            riser: (left, right, at, width) => {
              const pixels = Math.round(width * dpr);
              const centre = (origin + at) * dpr;
              const soft = [centre - pixels / 2, centre + pixels / 2].some(
                (edge) => Math.abs(edge - Math.round(edge)) > SERIAL
              );
              const place = centre - (pixels % 2 === 1 ? 0.5 : 0);
              const low = cover(left)[0];
              const high = cover(right)[1];
              if (soft || place < low - SERIAL || place > high + SERIAL) {
                failures.push(
                  `riser of ${String(left)}–${String(right)}: ${String(centre)} for ${String(pixels)} device px in ${String(low)}–${String(high)}`
                );
              }
            },
            stroked: (what, slot, [start, end], width) => {
              const pixels = Math.round(width * dpr);
              const centres = [(origin + start) * dpr, (origin + end) * dpr];
              const soft = centres.some((centre) =>
                [centre - pixels / 2, centre + pixels / 2].some(
                  (edge) => Math.abs(edge - Math.round(edge)) > SERIAL
                )
              );
              const shift = pixels % 2 === 1 ? 0.5 : 0;
              const [low, high] = cover(slot);
              const [from = 0, to = 0] = centres.map((centre) => centre - shift);
              if (soft || to - from < 1 - SERIAL || from < low - SERIAL || to > high + SERIAL) {
                failures.push(
                  `${what} of ${String(slot)}: risers at ${centres.join(", ")} for ${String(pixels)} device px in ${String(low)}–${String(high)}`
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
            valued: (what, value, [start, end]) => {
              if (value === 0) {
                if (zero === null || end - start > SERIAL || Math.abs(start - zero) > SERIAL)
                  failures.push(`${what} reading 0: ${String(start)}–${String(end)}, zero ${String(zero)}`);
                return;
              }
              const fault =
                zero === null
                  ? "no zero rule"
                  : floorFault(
                      [start, end],
                      { zero, length: drawnBreadth },
                      { vertical, sign: value > 0 ? 1 : -1, dpr }
                    );
              if (fault !== null) failures.push(`${what} reading ${String(value)}: ${fault}`);
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
        // with a slot line and the line crosshair in the middle, where their labels centre. Then
        // seed -1298470839's path form at 1x: 101 slots on 100 px, a 64th of a pixel in, every
        // reading missing but the last, where slot 50's snapped column middle lay in slot 51. Then
        // readings far under a device pixel on both sides of zero and readings of 0: path columns
        // at 1x, their emphasis boxes on exactly those readings, horizontal bars at 1.5x, and a
        // group of blocks bars at 2x, each a fraction of a pixel in. Then a peak of 1e15, which
        // projects every other reading onto its base exactly, over bars, path columns and, past
        // 2,000 slots, decimated columns.
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
          // Quiet 1 px risers at 1x, odd, and at 2x, even, and the default 2 px one at 1.5x, odd.
          [{ ...DENSE, count: 20, length: 200, stroke: "quiet" }, 1],
          [{ ...DENSE, count: 20, length: 200, stroke: "quiet", offset: 0.5 }, 2],
          [{ ...DENSE, count: 20, length: 200, offset: 1 / 3 }, 1.5],
          // Plain step risers, a 2 px one at 1x, even, and a quiet one at 1x, odd, and 1.5x.
          [{ ...DENSE, count: 20, length: 200, curve: "step" }, 1],
          [{ ...DENSE, count: 20, length: 200, curve: "step", stroke: "quiet" }, 1],
          [{ ...DENSE, count: 37, length: 211, curve: "step", stroke: "quiet", offset: 0.4 }, 1.5],
          // Every mark inside a lower Panel, a fraction of a pixel in, at 1.5x and 2x.
          [{ ...DENSE, count: 40, length: 301, offset: 0.4, last: false, line: 20, panels: true }, 1.5],
          [{ ...DENSE, count: 29, length: 101, group: 2, offset: 3, crosshair: "band", panels: true }, 2],
          [
            {
              ...DENSE,
              count: 101,
              length: 100,
              missing: Array.from({ length: 400 }, (_, slot) => slot !== 100),
              offset: 1 / 64,
              crosshair: "band",
              last: false,
              line: 0,
            },
            1,
          ],
          [{ ...DENSE, count: 120, length: 300, small: true, offset: 0.4, last: false }, 1],
          [{ ...DENSE, count: 120, length: 300, small: true, emphasis: "small", offset: 0.4 }, 1],
          [{ ...DENSE, count: 30, length: 200, orientation: "horizontal", small: true, offset: 0.3 }, 1.5],
          [{ ...DENSE, count: 40, length: 301, group: 2, variant: "blocks", small: true, offset: 1 / 3 }, 2],
          [{ ...DENSE, count: 30, length: 200, small: true, peak: true, offset: 0.2 }, 1],
          [{ ...DENSE, count: 120, length: 300, small: true, peak: true, offset: 0.7 }, 1.5],
          // A decimated window under a peak, every bucket's column but the peak's under a device
          // pixel, on both sides of zero and held apart where its projection collapses.
          [{ ...DENSE, count: 2500, length: 400, small: true, peak: true, offset: 0.4 }, 1],
          [{ ...DENSE, count: 2500, length: 400, small: true, peak: true, offset: 0.3 }, 1.5],
          // A stack of one series over zeros in a lower Panel, which holds the zeros' series too.
          [{ ...DENSE, count: 40, length: 301, stacked: true, panels: true, offset: 0.4, last: false }, 1.5],
          // A decimated stack of one series under a peak, its emphasis boxes on its small readings
          // and the active overlay on its first and on its last slot.
          [
            {
              ...DENSE,
              count: 2500,
              length: 400,
              small: true,
              peak: true,
              emphasis: "small",
              stacked: true,
              last: false,
            },
            1,
          ],
          [
            {
              ...DENSE,
              count: 2500,
              length: 400,
              small: true,
              peak: true,
              emphasis: "small",
              stacked: true,
              offset: 0.3,
            },
            1.5,
          ],
        ],
      }
    );
  }, 240_000);
});
