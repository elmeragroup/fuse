// E11's motion rules on the JS loop, in Chromium, after motion-decision.md. Each expected geometry
// comes from motion-frames.json, which .scratch/charts-v1/tools/l05-oracles/motion_fixture.py
// writes by hand from the fixture values. The checks read the two ends of an update, which are
// exact at any machine load: the first paint after a commit and the geometry the loop settles on.
// chart-motion.test.ts walks the frames in between on a hand-driven clock.
import { useLayoutEffect } from "react";
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { barBox } from "../../../test/chart/bar-box";
import { finishedFade, runningFade } from "../../../test/chart/fade";
import { barLayerBox } from "../../../test/chart/marks";
import { OCTOBER_RELOAD, october } from "../../../test/chart/month-switch";
import { MOTION_A, MOTION_B, MOTION_C, MotionChart, oslo } from "../../../test/chart/motion-fixture";
import type { MotionRow } from "../../../test/chart/motion-fixture";
import frames from "../../../test/chart/motion-frames.json" with { type: "json" };
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { useChartRoot } from "./chart-context";
import type { ChartMotion } from "./chart-motion";
import { Chart } from "./chart-namespace";
import "./chart.css";

type Box = { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number };
type Fractions = {
  readonly series: string;
  readonly position: number;
  readonly day: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly topPx: number;
  readonly bottom: number;
};

/** Every edge lands on the nearest whole pixel, so a box sits within half a pixel of the oracle. */
const TOLERANCE = 0.5;

/** The expected box of oracle fractions on a plot. */
function expected(fractions: Fractions, plot: DOMRect): Box {
  return {
    left: fractions.left * plot.width,
    right: fractions.right * plot.width,
    top: fractions.top * plot.height + fractions.topPx,
    bottom: fractions.bottom * plot.height,
  };
}

function near(actual: Box, wanted: Box): boolean {
  return (["left", "right", "top", "bottom"] as const).every(
    (edge) => Math.abs(actual[edge] - wanted[edge]) <= TOLERANCE
  );
}

/** The bars of one series in DOM order, which is x order. */
function seriesBars(host: HTMLElement, seriesIndex: 0 | 1): Element[] {
  // DOM audit: bars are aria-hidden plot output, so their slots are the only locator.
  return [
    ...host.querySelectorAll(
      `[data-slot="chart-bar-series"][data-series="${String(seriesIndex)}"] [data-slot="chart-bar"]`
    ),
  ];
}

/** Each oracle bar's box, found by its series and its place in the window. */
function boxesOf(host: HTMLElement, oracle: readonly Fractions[]): Box[] {
  const plot = barLayerBox(host);
  return oracle.map((entry) => {
    const bar = seriesBars(host, entry.series === "p" ? 0 : 1)[entry.position];
    if (bar === undefined) throw new Error(`no bar for ${entry.series} ${String(entry.day)}`);
    return barBox(bar, plot);
  });
}

/** Whether every oracle bar sits on its oracle box. */
function settledOn(host: HTMLElement, oracle: readonly Fractions[]): boolean {
  const plot = barLayerBox(host);
  return boxesOf(host, oracle).every((box, index) => {
    const entry = oracle[index];
    return entry !== undefined && near(box, expected(entry, plot));
  });
}

/** The oracle bars of one data set whose days another data set keeps, at their new positions. */
function surviving(from: readonly Fractions[], to: readonly Fractions[]): Fractions[] {
  return from.flatMap((entry) => {
    const kept = to.find((other) => other.series === entry.series && other.day === entry.day);
    return kept === undefined ? [] : [{ ...entry, position: kept.position }];
  });
}

async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

function mount(data: readonly MotionRow[], xRange?: readonly [Date, Date]) {
  return renderThemed(<MotionChart data={data} xRange={xRange} />);
}

describe("a data update", () => {
  it("rewinds each surviving bar to what it drew, then settles on update B", async () => {
    const { host, rerender } = mount(MOTION_A);
    expect(settledOn(host, frames.bars.A)).toBe(true);
    rerender(<MotionChart data={MOTION_B} />);
    // Before the browser paints, 2 to 10 October still sit where data A drew them, one band left
    // of their new places.
    expect(settledOn(host, surviving(frames.bars.A, frames.bars.B))).toBe(true);
    expect(settledOn(host, frames.bars.B)).toBe(false);
    await expect.poll(() => settledOn(host, frames.bars.B), { timeout: 5000 }).toBe(true);
  });

  it("continues a second update from the drawn geometry, with no jump, and ends on A", async () => {
    const { host, rerender } = mount(MOTION_A);
    rerender(<MotionChart data={MOTION_B} />);
    await frame();
    await frame();
    // 2 to 10 October, at their places under B and then under A.
    const kept = (entry: Fractions): boolean => frames.bars.A.some((other) => other.day === entry.day);
    const drawn = boxesOf(host, frames.bars.B.filter(kept));
    rerender(<MotionChart data={MOTION_A} />);
    // The bars of 2 to 10 October keep their nodes, and their first paint is where they were.
    const after = boxesOf(host, surviving(frames.bars.B, frames.bars.A));
    after.forEach((box, index) => {
      const before = drawn[index];
      if (before === undefined) throw new Error("no box");
      for (const edge of ["left", "right", "top", "bottom"] as const)
        expect(Math.abs(box[edge] - before[edge])).toBeLessThan(0.01);
    });
    await expect.poll(() => settledOn(host, frames.bars.A), { timeout: 5000 }).toBe(true);
  });

  it("fades in a bar the update adds through opacity only, and drops a leaving bar at once", async () => {
    const { host, rerender } = mount(MOTION_A);
    rerender(<MotionChart data={MOTION_B} />);
    const fades: (readonly [Element, Animation])[] = [];
    for (const seriesIndex of [0, 1] as const) {
      const bars = seriesBars(host, seriesIndex);
      // 1 October left, so ten bars remain, and 11 October joined at the end.
      expect(bars).toHaveLength(10);
      const added = bars[9];
      if (added === undefined) throw new Error("no added bar");
      expect(added.getAttribute("data-intro")).toBe("fade");
      // The fade runs from opacity 0, and it animates opacity alone.
      fades.push([added, runningFade(added)]);
      for (const animation of added.getAnimations()) {
        const keyframes = animation.effect instanceof KeyframeEffect ? animation.effect.getKeyframes() : [];
        for (const keyframe of keyframes) {
          expect(
            Object.keys(keyframe).filter(
              (key) => !["offset", "computedOffset", "easing", "composite"].includes(key)
            )
          ).toEqual(["opacity"]);
        }
      }
    }
    // The added bar never grows: it already sits on its own box.
    expect(
      settledOn(
        host,
        frames.bars.B.filter((entry) => entry.day === 11)
      )
    ).toBe(true);
    for (const [bar, fade] of fades) await finishedFade(bar, fade);
  });

  it("pairs bars by position when the update shares no slot, keeping their nodes", async () => {
    const { host, rerender } = mount(MOTION_B);
    const nodes = ([0, 1] as const).map((seriesIndex) => seriesBars(host, seriesIndex).slice(0, 9));
    rerender(<MotionChart data={MOTION_C} />);
    for (const seriesIndex of [0, 1] as const) {
      const bars = seriesBars(host, seriesIndex);
      // November has nine days, so B's tenth bar left at once.
      expect(bars).toHaveLength(9);
      expect(bars).toEqual(nodes[seriesIndex]);
      expect(bars.some((bar) => bar.getAttribute("data-intro") === "fade")).toBe(false);
    }
    await expect.poll(() => settledOn(host, frames.bars.C), { timeout: 5000 }).toBe(true);
  });
});

describe("marks that move with the bars", () => {
  function marks(data: readonly MotionRow[], range: readonly [Date, Date] = [oslo(10, 1), oslo(10, 11)]) {
    return (
      <MotionChart data={data} xRange={range}>
        <Chart.Grid />
        <Chart.ReferenceLine y={6} />
        <Chart.ReferenceArea y1={2} y2={4} />
      </MotionChart>
    );
  }

  /** The reference line's centre and the band's edges, as shares of the plot's height. */
  function references(host: HTMLElement) {
    // DOM audit: reference marks are aria-hidden plot output, so their slots are the only locator.
    const line = host.querySelector('[data-slot="chart-reference-line"] line');
    const area = host.querySelector('[data-slot="chart-reference-area"] rect');
    const height = barLayerBox(host).height;
    const y = Number(line?.getAttribute("y1"));
    const top = Number(area?.getAttribute("y"));
    return {
      line: y,
      areaTop: top / height,
      areaBottom: (top + Number(area?.getAttribute("height"))) / height,
      height,
    };
  }

  it("rewinds the reference marks with the bars on update C, snaps the grid, and settles on C", async () => {
    const { host, rerender } = renderThemed(marks(MOTION_B));
    // DOM audit: grid lines are aria-hidden plot output.
    const gridBefore = [...host.querySelectorAll('[data-slot="chart-grid-line"]')].map((line) =>
      line.getAttribute("y1")
    );
    rerender(marks(MOTION_C));
    const { line, areaTop, areaBottom, height } = references(host);
    // The line starts its 1 px rule at its share of the plot, so its centre sits half a pixel below.
    expect(Math.abs(line - 0.5 - frames.references.line.from * height)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(areaTop - frames.references.areaTop.from)).toBeLessThanOrEqual(TOLERANCE / height);
    expect(Math.abs(areaBottom - frames.references.areaBottom.from)).toBeLessThanOrEqual(TOLERANCE / height);
    // Ticks and grid lines take the new scale in the same paint.
    const gridAfter = [...host.querySelectorAll('[data-slot="chart-grid-line"]')].map((rule) =>
      rule.getAttribute("y1")
    );
    expect(gridAfter).not.toEqual(gridBefore);
    await expect
      .poll(() => Math.abs(references(host).line - 0.5 - frames.references.line.to * height), {
        timeout: 5000,
      })
      .toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(references(host).areaTop - frames.references.areaTop.to)).toBeLessThanOrEqual(
      TOLERANCE / height
    );
  });
});

describe("followers on a data update", () => {
  it("move the active value line and its pill with 7 October, then settle on update B", async () => {
    const { host, rerender } = renderThemed(
      <MotionChart data={MOTION_A}>
        <Chart.ActiveValueLine dataKey="p">
          <Chart.ValueLabel />
        </Chart.ActiveValueLine>
      </MotionChart>
    );
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(document.activeElement?.getAttribute("aria-posinset")).toBe("7");
    // DOM audit: the line is aria-hidden plot output, and its pill reads the share it writes.
    const line = host.querySelector<HTMLElement>('[data-slot="chart-active-value-line"]');
    const share = (): number =>
      Number.parseFloat(line?.style.getPropertyValue("--chart-line-top") ?? "") / 100;
    // The line sits on the bar's drawn end, the oracle's share snapped to a whole pixel.
    const height = barLayerBox(host).height;
    const off = (wanted: number): number => Math.abs(share() - wanted) * height;
    const { from, to } = frames.activeP7.top;
    expect(off(from)).toBeLessThanOrEqual(TOLERANCE);
    rerender(
      <MotionChart data={MOTION_B}>
        <Chart.ActiveValueLine dataKey="p">
          <Chart.ValueLabel />
        </Chart.ActiveValueLine>
      </MotionChart>
    );
    // 7 October keeps its x, so the line starts where it was and moves with its bar.
    expect(off(from)).toBeLessThanOrEqual(TOLERANCE);
    await expect.poll(() => off(to), { timeout: 5000 }).toBeLessThanOrEqual(TOLERANCE);
  });
});

describe("a range step", () => {
  function month(range: readonly [Date, Date]) {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root
            data={OCTOBER_RELOAD}
            config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
            xKey="day"
            interval="day"
            timeZone="Europe/Oslo"
            xRange={range}
            data-intro="none"
            aria-label="Forbruk per dag">
            <Chart.Bar dataKey="kwh" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  /** Every bar's box. */
  function all(host: HTMLElement): Box[] {
    const plot = barLayerBox(host);
    // DOM audit: bars are aria-hidden plot output.
    return [...host.querySelectorAll('[data-slot="chart-bar"]')].map((bar) => barBox(bar, plot));
  }

  it("moves the window from 10–20 to 11–21 October at once, and the entering bar snaps in", async () => {
    const { host, rerender } = renderThemed(month([october(10), october(20)]));
    rerender(month([october(11), october(21)]));
    const first = all(host);
    expect(first).toHaveLength(11);
    // DOM audit: data-intro is the bars' public entrance attribute.
    const entering = host.querySelectorAll('[data-slot="chart-bar"]')[10];
    expect(entering?.getAttribute("data-intro")).toBe("none");
    expect(entering?.getAnimations()).toEqual([]);
    // Nothing moves after the step's first paint.
    await frame();
    await frame();
    expect(all(host)).toEqual(first);
  });

  it("cancels a running data update, which a commit of data and xRange together starts", async () => {
    const { host, rerender } = mount(MOTION_A, [oslo(10, 1), oslo(10, 10)]);
    rerender(<MotionChart data={MOTION_B} xRange={[oslo(10, 2), oslo(10, 11)]} />);
    // The commit changed data, so the surviving bars rewind and move, and 11 October fades in.
    expect(settledOn(host, surviving(frames.bars.A, frames.bars.B))).toBe(true);
    expect(seriesBars(host, 0)[9]?.getAttribute("data-intro")).toBe("fade");
    await frame();
    rerender(<MotionChart data={MOTION_B} xRange={[oslo(10, 3), oslo(10, 11)]} />);
    // The range step lands every bar on update B's geometry under the new window at once, and the
    // fade of 11 October ends at full opacity.
    expect(seriesBars(host, 0)).toHaveLength(9);
    expect(settledOn(host, frames.bars.B3to11)).toBe(true);
    // DOM audit: Root's figure holds every animation of the chart.
    expect(host.querySelector('[data-slot="chart"]')?.getAnimations({ subtree: true })).toEqual([]);
    expect(Number(getComputedStyle(seriesBars(host, 0)[8] ?? document.body).opacity)).toBe(1);
  });
});

describe("motion registrations", () => {
  /** Hands Root's loop to the test, which reads how many marks it holds. */
  function MotionProbe({ onMotion }: { readonly onMotion: (motion: ChartMotion) => void }): null {
    const { motion } = useChartRoot("MotionProbe");
    useLayoutEffect(() => {
      onMotion(motion);
    });
    return null;
  }

  const ONE = { p: { label: "Grunnlast", color: "chart-1" } } as const;

  function chart(data: readonly MotionRow[], parts: ReactNode, onMotion: (motion: ChartMotion) => void) {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root
            data={data}
            config={ONE}
            xKey="day"
            interval="day"
            timeZone="Europe/Oslo"
            data-intro="none"
            aria-label="Forbruk per dag">
            <Chart.Grid />
            {parts}
            <MotionProbe onMotion={onMotion} />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("returns Root's loop to its starting size after a series mounts and unmounts ten times", async () => {
    // Root hands its one loop to the probe on every commit.
    const loops: ChartMotion[] = [];
    const hold = (motion: ChartMotion): void => {
      loops.push(motion);
    };
    const size = (): number => loops.at(-1)?.size() ?? Number.NaN;
    const series = (
      <>
        <Chart.Bar dataKey="p" />
        <Chart.ActiveValue dataKey="p" />
        <Chart.ActiveValueLine dataKey="p" />
        <Chart.ReferenceLine y={5} label="Mål" />
      </>
    );
    const { host, rerender } = renderThemed(chart(MOTION_A, null, hold));
    const start = size();
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{ArrowRight}");
    for (let round = 0; round < 10; round += 1) {
      rerender(chart(MOTION_A, series, hold));
      // The followers draw after the commit settles.
      await frame();
      // Ten bars, the active overlay, the plot value, the value line and the reference line.
      expect(size()).toBe(start + 14);
      // A data update starts every bar's tween, and the series unmounts in the middle of it.
      rerender(chart(MOTION_B, series, hold));
      await frame();
      rerender(chart(MOTION_B, null, hold));
      expect(size()).toBe(start);
    }
  });
});

describe("a labelled reference on a data update", () => {
  function referenced(peak: number) {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root
            data={[
              { name: "a", v: peak },
              { name: "b", v: 4 },
            ]}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            data-intro="none"
            aria-label="Topp">
            <Chart.Bar dataKey="v" />
            <Chart.ReferenceLine y={6} label="Mål" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  /** The guide's top edge and the label's bottom edge, in pixels from the plot's top. */
  function edges(host: HTMLElement) {
    const plot = barLayerBox(host);
    // DOM audit: reference marks are aria-hidden plot output, so their slots are the only locator.
    const line = host.querySelector('[data-slot="chart-reference-line"] line');
    const label = host.querySelector('[data-slot="chart-reference-label"]')?.getBoundingClientRect();
    // The 1 px rule's centre sits half a pixel below its top edge.
    return { guide: Number(line?.getAttribute("y1")) - 0.5, label: (label?.bottom ?? Number.NaN) - plot.top };
  }

  it("moves its label with its guide on every frame as the domain grows from 0–12 to 0–20", async () => {
    const { host, rerender } = renderThemed(referenced(12));
    expect(barLayerBox(host).height).toBe(200);
    // 6 on 0–12 lies half way down the 200 px plot, and on 0–20 seven tenths of the way down.
    expect(Math.abs(edges(host).guide - 100)).toBeLessThanOrEqual(0.5);
    rerender(referenced(20));
    const seen = [edges(host)];
    for (let count = 0; count < 120 && Math.abs((seen.at(-1)?.guide ?? 0) - 140) > 0.5; count += 1) {
      await frame();
      seen.push(edges(host));
    }
    expect(Math.abs((seen.at(-1)?.guide ?? 0) - 140)).toBeLessThanOrEqual(0.5);
    // The guide passed through the values between, and the label sat on it every frame.
    expect(seen.some(({ guide }) => guide > 101 && guide < 139)).toBe(true);
    for (const { guide, label } of seen)
      expect(Math.abs(label - guide), String(guide)).toBeLessThanOrEqual(1);
  });
});

describe("guides that move with the bars", () => {
  // One array per peak, so a render that only resizes the plot hands Root the same data and moves
  // nothing but the geometry, as a resize does.
  const rows = new Map<number, readonly { readonly name: string; readonly v: number }[]>();
  const CONFIG = { v: { label: "V", color: "chart-1" } } as const;
  function dataFor(peak: number) {
    const data = rows.get(peak) ?? [
      { name: "a", v: 6 },
      { name: "b", v: peak },
    ];
    rows.set(peak, data);
    return data;
  }

  function chart(peak: number, height: string, guide: ReactNode, width = 400) {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width }}>
          <Chart.Root
            data={dataFor(peak)}
            config={CONFIG}
            xKey="name"
            data-intro="none"
            style={{ "--chart-plot-height": height }}
            aria-label="Topp">
            <Chart.Bar dataKey="v" />
            {guide}
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  /** The top of the bar at 6 and the guide's top edge, in the plot's pixels. */
  function tops(host: HTMLElement) {
    // DOM audit: bars and guides are aria-hidden plot output, so their slots are the only locator.
    const bar = host.querySelector('[data-slot="chart-bar"]');
    const line = host.querySelector('[data-slot="chart-reference-line"] line');
    return { bar: Number(bar?.getAttribute("y")), guide: Number(line?.getAttribute("y1")) - 0.5 };
  }

  it("keeps a guide at 6 on the bar at 6 when the plot doubles its height during the update", async () => {
    // B2-3: on 0–12 over 200 px both sit at 100 px. The update to 0–20 heads for 140 px, and the
    // 400 px plot then for 280 px, from wherever the two are drawn.
    const guide = <Chart.ReferenceLine y={6} />;
    const { host, rerender } = renderThemed(chart(12, "200px", guide));
    expect(tops(host)).toEqual({ bar: 100, guide: 100 });
    rerender(chart(20, "200px", guide));
    await frame();
    await frame();
    rerender(chart(20, "400px", guide));
    const seen = [tops(host)];
    for (let count = 0; count < 120 && seen.at(-1)?.bar !== 280; count += 1) {
      await frame();
      seen.push(tops(host));
    }
    expect(seen.at(-1)).toEqual({ bar: 280, guide: 280 });
    expect(seen.some(({ bar }) => bar > 140 && bar < 280)).toBe(true);
    for (const { bar, guide: edge } of seen) expect(edge, String(bar)).toBe(bar);
  });

  it("slides a cut area's label inside the area, from its edge, as the domain shrinks", async () => {
    // Q2-1: the area from 2 to 10 tops at 100 px of 200 on 0–20. On 0–8 its top lies 50 px above
    // the plot, so its label comes to rest one line and 0.25rem inside, and on the way it sits on
    // the area's top edge for as long as that edge is in the plot.
    const area = <Chart.ReferenceArea y1={2} y2={10} label="Bånd" />;
    const { host, rerender } = renderThemed(chart(20, "200px", area));
    // DOM audit: reference marks are aria-hidden plot output, so their slots are the only locator.
    const band = () =>
      Number(host.querySelector('[data-slot="chart-reference-area"] rect')?.getAttribute("y"));
    const label = host.querySelector<HTMLElement>('[data-slot="chart-reference-label"]');
    if (label === null) throw new Error("no label");
    const bottom = () => label.getBoundingClientRect().bottom - barLayerBox(host).top;
    const rest = 4 + Number.parseFloat(getComputedStyle(label).lineHeight);
    expect(Math.abs(bottom() - 100)).toBeLessThanOrEqual(1);
    rerender(chart(8, "200px", area));
    const seen = [{ band: band(), label: bottom() }];
    for (let count = 0; count < 120 && Math.abs((seen.at(-1)?.label ?? 0) - rest) > 0.5; count += 1) {
      await frame();
      seen.push({ band: band(), label: bottom() });
    }
    // The first paint after the update still shows the label on the edge at 100 px.
    expect(Math.abs((seen[0]?.label ?? 0) - 100)).toBeLessThanOrEqual(1);
    expect(seen.some(({ band: top }) => top > 0 && top < 100)).toBe(true);
    for (const { band: top, label: edge } of seen) {
      if (top > 0) expect(Math.abs(edge - top), String(top)).toBeLessThanOrEqual(1);
      else expect(edge).toBeLessThanOrEqual(rest + 0.5);
    }
    expect(Math.abs((seen.at(-1)?.label ?? 0) - rest)).toBeLessThanOrEqual(0.5);
  });

  /** Each labelled line's drawn top edge and its label's bottom, in the plot's pixels, in mount order. */
  function labelled(host: HTMLElement) {
    const plot = barLayerBox(host);
    // DOM audit: reference marks are aria-hidden plot output, so their slots are the only locator.
    return [...host.querySelectorAll('[data-slot="chart-reference-line"]')].map((reference) => ({
      guide: Number(reference.querySelector("line")?.getAttribute("y1")) - 0.5,
      label:
        (reference.querySelector('[data-slot="chart-reference-label"]')?.getBoundingClientRect().bottom ??
          0) - plot.top,
      shown: !reference.hasAttribute("data-outside"),
    }));
  }

  it("keeps the label of a line at 9.5 a line below the one at 10 while both leave a shrinking plot", async () => {
    // Q3-2: on 0–20 over 200 px the lines draw at 100 and 105 px, so the second label stacks a
    // 16 px line under the first, at 116 px. On 0–8 both lie above the plot. While both still
    // show, the second label stays a line under the first in every frame.
    const lines = (
      <>
        <Chart.ReferenceLine y={10} label="Ti" />
        <Chart.ReferenceLine y={9.5} label="Ni" />
      </>
    );
    const { host, rerender } = renderThemed(chart(20, "200px", lines));
    // DOM audit: reference labels are aria-hidden plot output, and their line height is the oracle's line.
    const line = Number.parseFloat(
      getComputedStyle(host.querySelector('[data-slot="chart-reference-label"]') ?? document.body).lineHeight
    );
    expect(labelled(host).map(({ label }) => Math.round(label))).toEqual([100, 100 + line]);
    rerender(chart(8, "200px", lines));
    const seen = [labelled(host)];
    for (let count = 0; count < 120 && seen.at(-1)?.some(({ shown }) => shown); count += 1) {
      await frame();
      seen.push(labelled(host));
    }
    expect(seen.length).toBeGreaterThan(2);
    for (const [first, second] of seen) {
      if (first?.shown !== true || second?.shown !== true) continue;
      expect(second.label - first.label, String(first.guide)).toBeGreaterThanOrEqual(line - 0.5);
    }
  });

  it("keeps a guide at 6 on the bar at 6 when the plot doubles its width during the update", async () => {
    // B3-2: the width-only resize moves the bar sideways and leaves both tops' targets alone, so
    // both keep heading from 100 to 140 px together.
    const guide = <Chart.ReferenceLine y={6} />;
    const wide = (peak: number, width: number) => chart(peak, "200px", guide, width);
    const { host, rerender } = renderThemed(wide(12, 400));
    rerender(wide(20, 400));
    for (let count = 0; count < 7; count += 1) await frame();
    rerender(wide(20, 800));
    expect(barLayerBox(host).width).toBe(800);
    const seen = [tops(host)];
    for (let count = 0; count < 120 && seen.at(-1)?.bar !== 140; count += 1) {
      await frame();
      seen.push(tops(host));
    }
    expect(seen.at(-1)).toEqual({ bar: 140, guide: 140 });
    expect(seen.some(({ bar }) => bar > 100 && bar < 140)).toBe(true);
    for (const { bar, guide: edge } of seen) expect(edge, String(bar)).toBe(bar);
  });

  it("moves two labels with their guides as lines at 15 and 5 swap, without a jump at the commit", async () => {
    // B3-4: on 0–20 over 200 px, 15 draws at 50 px and 5 at 150 px. After the swap each label
    // still sits on its guide in the first frame, rides it, sits at most a line below it where the
    // two meet, and ends on the other's place.
    const swapped = (first: number, second: number) => (
      <>
        <Chart.ReferenceLine y={first} label="A" />
        <Chart.ReferenceLine y={second} label="B" />
      </>
    );
    const { host, rerender } = renderThemed(chart(20, "200px", swapped(15, 5)));
    // DOM audit: reference labels are aria-hidden plot output, and their line height is the oracle's line.
    const line = Number.parseFloat(
      getComputedStyle(host.querySelector('[data-slot="chart-reference-label"]') ?? document.body).lineHeight
    );
    expect(labelled(host).map(({ label }) => Math.round(label))).toEqual([50, 150]);
    // The swap arrives with a data update, a new array of the same rows, so the guides tween.
    rows.delete(20);
    rerender(chart(20, "200px", swapped(5, 15)));
    const seen = [labelled(host)];
    expect(seen[0]?.map(({ label }) => Math.round(label))).toEqual([50, 150]);
    for (let count = 0; count < 120 && Math.round(seen.at(-1)?.[0]?.guide ?? 0) !== 150; count += 1) {
      await frame();
      seen.push(labelled(host));
    }
    for (const pair of seen) {
      for (const { guide: edge, label } of pair) {
        expect(label, String(edge)).toBeGreaterThanOrEqual(edge - 0.5);
        expect(label, String(edge)).toBeLessThanOrEqual(edge + line + 0.5);
      }
    }
    expect(seen.at(-1)?.map(({ label }) => Math.round(label))).toEqual([150, 50]);
  });
});

describe("a form swap on a data update", () => {
  /** Categories of value 4, which fill the 200 px plot over 0–4. */
  function many(count: number) {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root
            data={Array.from({ length: count }, (_, index) => ({ name: `c${String(index)}`, v: 4 }))}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            aria-label="Mange">
            <Chart.Bar dataKey="v" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("draws category 101 in the path form at once, with no new entrance for the settled bars", async () => {
    // Q5-2: 100 categories enter, settle at full height, and an update adds category 101, which
    // turns the series into one path. The path form snaps to new data, so it never grows again.
    const { host, rerender } = renderThemed(many(100));
    // DOM audit: bars are aria-hidden plot output, so their slot is the only locator.
    const settled = (): boolean =>
      [...host.querySelectorAll('[data-slot="chart-bar"]')].every(
        (bar) => bar.getAttribute("height") === "200"
      );
    await expect.poll(settled, { timeout: 5000 }).toBe(true);
    rerender(many(101));
    // DOM audit: the path form's marks group carries the entrance's grow transform while it grows.
    const group = (): Element | null =>
      host.querySelector('[data-slot="chart-bar-path"]')?.parentElement ?? null;
    expect(host.querySelectorAll('[data-slot="chart-bar-path"]').length).toBeGreaterThan(0);
    for (let count = 0; count < 10; count += 1) {
      expect(group()?.closest('[data-slot="chart-bar-marks"]')?.getAttribute("transform") ?? null).toBeNull();
      await frame();
    }
  });
});

describe("the row of slot labels while a slot guide departs", () => {
  function categories(names: readonly string[]) {
    const values = new Map([
      ["A", 4],
      ["B", 2],
      ["C", 3],
    ]);
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root
            data={names.map((name) => ({ name, v: values.get(name) ?? 0 }))}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            data-intro="none"
            aria-label="Kategorier">
            <Chart.Bar dataKey="v" />
            <Chart.ReferenceLine y={4} label="Tak" />
            <Chart.ReferenceLine x="C" label="Kampanje" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("keeps a value label at the plot's top below the reserved row until C's guide leaves", async () => {
    // Q6-2: A, B and C on 0–4, the value line at 4 on the plot's top edge, mounted before the slot
    // line at C. Dropping C sends C's guide out of the plot to the left. While it still draws in
    // the plot, its label keeps the row above the plot, and the value label stays a line below the
    // plot's top. Once it has left, the value label sits on its line.
    const { host, rerender } = renderThemed(categories(["A", "B", "C"]));
    // DOM audit: reference marks are aria-hidden plot output, so their slots are the only locator.
    const [value, slot] = [...host.querySelectorAll('[data-slot="chart-reference-line"]')];
    const label = value?.querySelector<HTMLElement>('[data-slot="chart-reference-label"]');
    if (value === undefined || slot === undefined || label === null || label === undefined) {
      throw new Error("no references");
    }
    const line = Number.parseFloat(getComputedStyle(label).lineHeight);
    const sample = () => ({
      inside: !slot.hasAttribute("data-outside"),
      bottom: label.getBoundingClientRect().bottom - barLayerBox(host).top,
    });
    expect(Math.abs(sample().bottom - line)).toBeLessThanOrEqual(0.5);
    rerender(categories(["A", "B"]));
    const seen = [sample()];
    for (let count = 0; count < 120 && seen.at(-1)?.inside === true; count += 1) {
      await frame();
      seen.push(sample());
    }
    expect(seen.filter(({ inside }) => inside).length).toBeGreaterThan(1);
    for (const { inside, bottom } of seen) {
      if (inside) expect(bottom).toBeGreaterThanOrEqual(line - 0.5);
    }
    await expect.poll(() => Math.abs(sample().bottom)).toBeLessThanOrEqual(0.5);
  });
});
