// Exact bar gaps through one slot grid, in Chromium at 1x and 2x. Unit under test: the element
// form's bars, a BarGroup's bars, a coarse series' bars, a band-scale line and the focus options,
// from the model to each polygon's points, the path's vertices and the options' pixel columns.
// Oracle: the owner's grid rule worked by hand in device pixels (dp). A plot L px long draws P dp
// from the pixel nearest its start to the one nearest its end, a tie toward the left. Over n slots
// every band takes w = floor(P / n) dp, starting floor((P - n * w) / 2) dp in, so the leftover
// splits between both ends. Every bar is its band less one gap G = max(1, round(w * 25 %)) dp, and
// a band of 1 dp has no gap. Every bar is the same width and every gap the same.
//   - 31 slots on 514.109375 px: at 2x, P = 1028, w = 33, offset 2, G = 8, bars 25. At 1x, P =
//     514, w = 16, offset 9, G = 4, bars 12.
//   - 96 slots on 469.4375 px: at 2x, P = 938, w = 9, offset 37, G = 2, bars 7. At 1x, P = 469,
//     w = 4, offset 42, G = 1, bars 3.
//   - 96 slots on 461.515625 px: at 2x, P = 923, w = 9, offset 29, G = 2, bars 7. At 1x the end at
//     461.52 px lies past the middle of pixel 461, so P = 462, w = 4, offset 39, G = 1, bars 3.
//   - 20 slots on 30 px at 1x: w = 1, offset 5, no gap, every bar 1 dp.
//   - 120 slots on 514.109375 px at 2x, drawn as path columns: P = 1028, w = 8, offset 34, G = 2,
//     columns 6 dp.
//   - A BarGroup of two on 31 slots at 2x: each band's 25 dp inside less a 2 px (4 dp) bar gap
//     leaves 21 dp, so bars of 10 dp, the spare 1 dp after the second, 4 dp apart inside a band and
//     8 + 1 = 9 dp from one band's second bar to the next band's first.
//   - 32 quarters on 390 px at 1x: w = 12, G = 3. An hourly series covers 4 bands, 48 dp, and
//     loses G once: 45 dp bars, 3 dp apart.
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { drawnRect } from "../../../test/chart/bar-box";
import { installFrameClock } from "../../../test/chart/frame-clock";
import { bars } from "../../../test/chart/marks";
import { lineVertices } from "../../../test/chart/panel-readers";
import { pathRects } from "../../../test/chart/world-reader";
import { emulatePixelRatio } from "../../../test/page-metrics";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

/** Emulate a pixel ratio on a square page, for the rest of the test. */
async function atRatio(dpr: number): Promise<void> {
  await emulatePixelRatio(dpr, { width: 1024, height: 1024 });
}

type Row = { readonly name: string; readonly a: number; readonly b: number };

function rows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `s${String(index)}`,
    a: index % 7 === 3 ? -0.1 : 0.2 + (index % 5) / 10,
    b: 0.3 + (index % 3) / 10,
  }));
}

const CONFIG = {
  a: { label: "A", color: "chart-1" },
  b: { label: "B", color: "chart-2" },
} as const;

/** A chart with no axes, so its plot is the box `length` px long. */
function Plain({
  length,
  count,
  orientation = "vertical",
  children,
}: {
  readonly length: number;
  readonly count: number;
  readonly orientation?: "vertical" | "horizontal";
  readonly children: React.ReactNode;
}) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: orientation === "vertical" ? length : 300 }}>
        <Chart.Root
          data-intro="none"
          data={rows(count)}
          config={CONFIG}
          xKey="name"
          orientation={orientation}
          style={
            orientation === "horizontal"
              ? { "--chart-plot-height": `${String(length)}px` }
              : { "--chart-plot-height": "200px" }
          }
          aria-label="Exact gaps">
          {children}
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

/** The plot's length along the slot axis, as its box measures. */
function plotLength(host: HTMLElement, orientation: "vertical" | "horizontal"): number {
  // DOM audit: the measured plot is the part under test.
  const plot = host.querySelector('[data-slot="chart-plot"]');
  if (plot === null) throw new Error("no plot");
  const box = plot.getBoundingClientRect();
  return orientation === "vertical" ? box.width : box.height;
}

/** The plot's drawn device pixels along the slot axis, each end on the pixel nearest it. */
function drawnLength(host: HTMLElement, orientation: "vertical" | "horizontal", dpr: number): number {
  // DOM audit: the measured plot is the part under test.
  const box = host.querySelector('[data-slot="chart-plot"]')?.getBoundingClientRect() ?? new DOMRect();
  const [start, length] = orientation === "vertical" ? [box.left, box.width] : [box.top, box.height];
  const device = (at: number) => Math.ceil(at * dpr - 0.5 - 1e-6);
  return device(start + length) - device(start);
}

/** Each bar's span along the slot axis, in device pixels from the plot's drawn origin, in slot order. */
function spans(
  elements: readonly Element[],
  orientation: "vertical" | "horizontal"
): (readonly [number, number])[] {
  return elements
    .map((bar): readonly [number, number] => {
      const rect = drawnRect(bar);
      const [start, size] = orientation === "vertical" ? [rect.x, rect.width] : [rect.y, rect.height];
      return [
        Math.round(start * devicePixelRatio * 1e4) / 1e4,
        Math.round((start + size) * devicePixelRatio * 1e4) / 1e4,
      ];
    })
    .toSorted((a, b) => a[0] - b[0]);
}

const distinct = (values: readonly number[]): number[] => [...new Set(values)].toSorted((a, b) => a - b);
const widths = (drawn: readonly (readonly [number, number])[]) => distinct(drawn.map(([s, e]) => e - s));
const gaps = (drawn: readonly (readonly [number, number])[]) =>
  distinct(drawn.slice(1).map(([start], k) => start - (drawn[k]?.[1] ?? 0)));

const CASES = [
  { count: 31, length: 514.109375, dpr: 2, offset: 2, width: 25, gap: 8 },
  { count: 31, length: 514.109375, dpr: 1, offset: 9, width: 12, gap: 4 },
  { count: 96, length: 469.4375, dpr: 2, offset: 37, width: 7, gap: 2 },
  { count: 96, length: 469.4375, dpr: 1, offset: 42, width: 3, gap: 1 },
  { count: 96, length: 461.515625, dpr: 2, offset: 29, width: 7, gap: 2 },
  { count: 96, length: 461.515625, dpr: 1, offset: 39, width: 3, gap: 1 },
  { count: 20, length: 30, dpr: 1, offset: 5, width: 1, gap: 0 },
] as const;

describe("exact bar gaps", () => {
  for (const orientation of ["vertical", "horizontal"] as const) {
    for (const { count, length, dpr, offset, width, gap } of CASES) {
      it(`draws ${String(count)} ${orientation} bars on ${String(length)} px at ${String(dpr)}x ${String(width)} dp wide, ${String(gap)} dp apart, ${String(offset)} dp in`, async () => {
        await atRatio(dpr);
        const { host } = renderThemed(
          <Plain length={length} count={count} orientation={orientation}>
            <Chart.Bar dataKey="a" />
          </Plain>
        );
        await expect.poll(() => bars(host)).toHaveLength(count);
        expect(plotLength(host, orientation)).toBe(length);
        const drawn = spans(bars(host), orientation);
        expect(widths(drawn)).toEqual([width]);
        if (count > 1) expect(gaps(drawn)).toEqual([gap]);
        // The first band starts `offset` dp into the plot and its bar half a gap, rounded down, past it.
        expect(drawn[0]?.[0]).toBe(offset + Math.floor(gap / 2));
        // The leftover splits: the first band's margin and the last's differ by at most 1 dp.
        const after = drawnLength(host, orientation, dpr) - (drawn.at(-1)?.[1] ?? 0) - Math.ceil(gap / 2);
        expect(Math.abs(offset - after)).toBeLessThanOrEqual(1);
      });
    }
  }

  it("draws 120 path columns on 514.109375 px at 2x 6 dp wide and 2 dp apart, 34 dp in", async () => {
    await atRatio(2);
    const { host } = renderThemed(
      <Plain length={514.109375} count={120}>
        <Chart.Bar dataKey="b" />
      </Plain>
    );
    // DOM audit: the path form's fill is aria-hidden plot output, so its slot is the only locator.
    const fill = () =>
      host.querySelector('[data-slot="chart-bar-path"][data-part="fill"]')?.getAttribute("d") ?? "";
    await expect.poll(() => pathRects(fill()).length).toBe(120);
    const drawn = pathRects(fill())
      .map((rect): readonly [number, number] => [
        Math.round(rect.x * 2e4) / 1e4,
        Math.round((rect.x + rect.width) * 2e4) / 1e4,
      ])
      .toSorted((a, b) => a[0] - b[0]);
    expect(widths(drawn)).toEqual([6]);
    expect(gaps(drawn)).toEqual([2]);
    expect(drawn[0]?.[0]).toBe(35);
    const after = drawnLength(host, "vertical", 2) - (drawn.at(-1)?.[1] ?? 0) - 1;
    expect(Math.abs(34 - after)).toBeLessThanOrEqual(1);
  });

  it("draws every grouped bar 10 dp wide, 4 dp apart in a band and 9 dp across bands, on 31 slots at 2x", async () => {
    await atRatio(2);
    const { host } = renderThemed(
      <Plain length={514.109375} count={31}>
        <Chart.BarGroup series={["a", "b"]}>
          <Chart.Bar dataKey="a" />
          <Chart.Bar dataKey="b" />
        </Chart.BarGroup>
      </Plain>
    );
    await expect.poll(() => bars(host)).toHaveLength(62);
    const drawn = spans(bars(host), "vertical");
    expect(widths(drawn)).toEqual([10]);
    const inside = drawn.flatMap(([start], k) => (k % 2 === 1 ? [start - (drawn[k - 1]?.[1] ?? 0)] : []));
    const across = drawn.flatMap(([start], k) =>
      k % 2 === 0 && k > 0 ? [start - (drawn[k - 1]?.[1] ?? 0)] : []
    );
    expect(distinct(inside)).toEqual([4]);
    expect(distinct(across)).toEqual([9]);
  });

  it("draws an hourly series on 32 quarters 45 dp wide and 3 dp apart at 1x", async () => {
    await atRatio(1);
    const quarterAt = (index: number) => new Date(Date.UTC(2025, 8, 30, 22, index * 15));
    const data = Array.from({ length: 32 }, (_, index) =>
      index % 4 === 0 ? { start: quarterAt(index), kwh: 1 + (index % 3) } : { start: quarterAt(index) }
    );
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 390 }}>
          <Chart.Root
            data={data}
            config={{ kwh: { label: "Forbruk", color: "chart-1", interval: "hour" } }}
            xKey="start"
            interval="quarter-hour"
            timeZone="Europe/Oslo"
            data-intro="none"
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Forbruk per time">
            <Chart.Bar dataKey="kwh" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    await expect.poll(() => bars(host)).toHaveLength(8);
    expect(plotLength(host, "vertical")).toBe(390);
    const drawn = spans(bars(host), "vertical");
    expect(widths(drawn)).toEqual([45]);
    expect(gaps(drawn)).toEqual([3]);
  });

  it("puts a band-scale line's vertex, the option and the pointer's crosshair band on the bar's slot under rule A", async () => {
    await atRatio(2);
    const { host } = renderThemed(
      <Plain length={514.109375} count={31}>
        <Chart.Bar dataKey="a" />
        <Chart.Line dataKey="b" curve="linear" />
        <Chart.Crosshair />
      </Plain>
    );
    await expect.poll(() => bars(host)).toHaveLength(31);
    await expect.poll(() => lineVertices(host)).toHaveLength(31);
    const drawn = spans(bars(host), "vertical");
    // The band is the bar with its 8 dp gap split 4 before and 4 after.
    const bandOf = ([start, end]: readonly [number, number]) => [start - 4, end + 4] as const;
    const vertices = lineVertices(host).map(([x]) => x * 2);
    drawn.forEach((bar, slot) => {
      const [start, end] = bandOf(bar);
      expect(
        Math.abs((vertices[slot] ?? 0) - (start + end) / 2),
        `vertex ${String(slot)}`
      ).toBeLessThanOrEqual(0.5);
    });
    const rounded = (start: number, end: number) => [
      Math.round(start * 1e4) / 1e4,
      Math.round(end * 1e4) / 1e4,
    ];
    // DOM audit: the plot's one option is its focus target, read for its pixel columns.
    const option = host.querySelector<HTMLElement>('[data-slot="chart-point"]');
    if (option === null) throw new Error("no option");
    const slot = Number(option.getAttribute("aria-posinset")) - 1;
    const optionStart = Number.parseFloat(option.style.getPropertyValue("--chart-option-start")) * 2;
    const optionSize = Number.parseFloat(option.style.getPropertyValue("--chart-option-size")) * 2;
    expect(rounded(optionStart, optionStart + optionSize)).toEqual(bandOf(drawn[slot] ?? [0, 0]));
    // The last band starts 2 + 30 * 33 = 992 dp in, at 496 px, where an even split of 514.11 px
    // would still be slot 29's (497.5 px on). Half a pixel past that edge picks slot 30, and the
    // crosshair band covers it.
    const last = bandOf(drawn[30] ?? [0, 0]);
    expect(last[0]).toBe(992);
    // DOM audit: the surface is the pointer target over the plot.
    const surface = host.querySelector<HTMLElement>('[data-slot="chart-surface"]');
    if (surface === null) throw new Error("no surface");
    await userEvent.hover(surface, { position: { x: last[0] / 2 + 0.5, y: 100 } });
    // DOM audit: the crosshair is aria-hidden plot output, so its slot is the only locator.
    const mark = host.querySelector('[data-slot="chart-crosshair-mark"]');
    await expect
      .poll(() => {
        const x = Number(mark?.getAttribute("x")) * 2;
        return rounded(x, x + Number(mark?.getAttribute("width")) * 2);
      })
      .toEqual(last);
  });

  it("keeps every gap exact at rest after a tween from 96 bars to 80 at 2x", async () => {
    await atRatio(2);
    // 96 slots on 469.4375 px at 2x rest as 7 dp bars. 80 slots: p = 11.74, w = 11, 938 - 880 = 58
    // <= 93.9, rule A, G = round(2.93) = 3, so every bar is 8 dp. Each tween frame draws a width
    // between a bar's two rests.
    const clock = installFrameClock();
    try {
      const { host, rerender } = renderThemed(
        <Plain length={469.4375} count={96}>
          <Chart.Bar dataKey="a" />
        </Plain>
      );
      await expect.poll(() => bars(host)).toHaveLength(96);
      const start = clock.now();
      rerender(
        <Plain length={469.4375} count={80}>
          <Chart.Bar dataKey="a" />
        </Plain>
      );
      for (const ms of [60, 120, 240]) {
        clock.frameAt(start + ms);
        const frameWidths = widths(spans(bars(host).slice(0, 80), "vertical"));
        expect(Math.min(...frameWidths), `at ${String(ms)} ms`).toBeGreaterThanOrEqual(7);
        expect(Math.max(...frameWidths), `at ${String(ms)} ms`).toBeLessThanOrEqual(8);
      }
      clock.frameAt(start + 2000);
      expect(bars(host)).toHaveLength(80);
      const rest = spans(bars(host), "vertical");
      expect(widths(rest)).toEqual([8]);
      expect(gaps(rest)).toEqual([3]);
    } finally {
      clock.restore();
    }
  });
});

describe("x axis labels on the slot grid", () => {
  // R2-2: once Root measures, the x axis spans the slot run, the plot less its leftover pixels at
  // both ends, and each label's anchor lies at its share of the axis. Slots run left to right in
  // either text direction. Oracle: 96 slots on 469.4375 px at 1x take 4 px each and leave 85 px,
  // 42 before the first and 43 after the last, so slot i's band centre lies at 44 + 4i px. Its bar
  // ends 1 px short for the gap, so its middle lies half a pixel before, and a label's anchor sits
  // within a pixel of it. Margins swapped right to left would move every anchor a pixel further.
  for (const dir of ["ltr", "rtl"] as const) {
    it(`anchors every shown label on its bar under dir="${dir}"`, async () => {
      await atRatio(1);
      const { host } = renderThemed(
        <div dir={dir}>
          <Plain length={469.4375} count={96}>
            <Chart.Bar dataKey="a" />
            <Chart.XAxis />
          </Plain>
        </div>
      );
      await expect.poll(() => bars(host)).toHaveLength(96);
      // DOM audit: the axis and its ticks are aria-hidden plot output.
      const axis = host.querySelector('[data-slot="chart-x-axis"]')?.getBoundingClientRect() ?? new DOMRect();
      const ticks = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"]')].filter(
        (tick) => getComputedStyle(tick).display !== "none"
      );
      expect(ticks.length).toBeGreaterThan(1);
      for (const tick of ticks) {
        const slot = Number(tick.textContent.replace(/^s/u, ""));
        const at = Number(tick.style.getPropertyValue("--chart-at"));
        const bar = bars(host)[slot]?.getBoundingClientRect() ?? new DOMRect();
        expect(
          Math.abs(axis.left + at * axis.width - (bar.left + bar.right) / 2),
          tick.textContent
        ).toBeLessThanOrEqual(1);
      }
    });
  }
});

describe("paths that slide past the slot run", () => {
  // R3-1: 96 slots on 469.4375 px at 1x take 4 px each from 42 px, so the slot run spans 42 to
  // 426 px and leaves 42 px before and 43 px after it. Sliding the window by four slots, q0…q95 to
  // q4…q99, starts the four incoming vertices one to four slots past the run, at 428, 432, 436 and
  // 440 px, each the middle of its 4 px slot. Oracle: those places, worked by hand, and the run's
  // margins, which the layers clip: 42 px from the box's left and 469.4375 - 426 = 43.4375 px from
  // its right, which computed style prints to three decimals.
  const quarters = (from: number) =>
    Array.from({ length: 96 }, (_, index) => ({
      name: `q${String(from + index)}`,
      a: 0.5 + (((from + index) * 37) % 11) / 10,
    }));
  const slid = [quarters(0), quarters(4)] as const;
  function Sliding({ data }: { readonly data: (typeof slid)[number] }) {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 469.4375 }}>
          <Chart.Root
            data-intro="none"
            data={data}
            config={{ a: { label: "A", color: "chart-1" } }}
            xKey="name"
            yInclude={[0, 2]}
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Glidende">
            <Chart.Area dataKey="a" curve="linear" />
            <Chart.Line dataKey="a" curve="linear" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("starts the incoming vertices at their own places past the run, and clips both layers to it", async () => {
    await atRatio(1);
    const clock = installFrameClock();
    try {
      const { host, rerender } = renderThemed(<Sliding data={slid[0]} />);
      await expect.poll(() => lineVertices(host)).toHaveLength(96);
      rerender(<Sliding data={slid[1]} />);
      clock.frameAt(clock.now());
      // The line's last four vertices are the incoming ones, each half a pixel into its hairline.
      const incoming = lineVertices(host)
        .map(([x]) => x)
        .slice(-4);
      expect(incoming).toEqual([428.5, 432.5, 436.5, 440.5]);
      // DOM audit: the series layers are aria-hidden plot output.
      for (const slot of ["chart-line-series", "chart-area-series"]) {
        const layer = host.querySelector(`[data-slot="${slot}"]`);
        expect(layer === null ? "" : getComputedStyle(layer).clipPath, slot).toMatch(
          /^inset\(-8px 43\.438px -8px 42px\)$/u
        );
      }
    } finally {
      clock.restore();
    }
  });
});
