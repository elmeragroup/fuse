// Reduced motion in Chromium, Firefox and WebKit, whose Playwright context sets
// prefers-reduced-motion: reduce. Oracle: CONTRACT section 9.9's limit of 150 ms for the legend
// fade, motion-decision.md rule 7, under which the entrance and every update land in their first
// paint, with update B's geometry from motion-frames.json, and section 11's keyframe properties at
// none.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { barBox } from "../../../test/chart/bar-box";
import { S06Chart } from "../../../test/chart/bar-charts";
import { MOTION_A, MOTION_B, MotionChart } from "../../../test/chart/motion-fixture";
import frames from "../../../test/chart/motion-frames.json" with { type: "json" };
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

/** The duration a property takes by CSS Transitions' list-matching rule, in milliseconds. */
function durationOf(element: Element, property: string): number | null {
  const style = getComputedStyle(element);
  const properties = style.transitionProperty.split(",").map((entry) => entry.trim());
  const durations = style.transitionDuration.split(",").map((entry) => Number.parseFloat(entry) * 1000);
  const index = properties.indexOf(property);
  if (index === -1) return null;
  return durations[index % durations.length] ?? null;
}

describe("charts under reduced motion", () => {
  it("matches the reduce query in this engine", () => {
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
  });

  it("fades the legend and its toggles in 150 ms or less", () => {
    const { host } = renderThemed(
      <S06Chart>
        <Chart.Bar dataKey="household" />
        <Chart.Legend />
        <Chart.LegendToggleGroup />
      </S06Chart>
    );
    // DOM audit: the transitions under test live on these slots.
    const item = host.querySelector('[data-slot="chart-legend-item"]');
    const toggle = host.querySelector('[data-slot="chart-legend-toggle"]');
    for (const element of [item, toggle]) {
      expect(element).not.toBeNull();
      expect(durationOf(element ?? document.body, "opacity")).toBeLessThanOrEqual(150);
    }
  });

  it("turns the chart keyframe animations off", () => {
    const { host } = renderThemed(<S06Chart />);
    // DOM audit: the keyframe tokens resolve on Root's figure.
    const root = host.querySelector('[data-slot="chart"]') ?? document.body;
    for (const name of ["--animate-chart-ping", "--animate-chart-dash", "--animate-chart-shimmer"]) {
      expect(getComputedStyle(root).getPropertyValue(name).trim(), name).toBe("none");
    }
  });

  it("draws the entrance at rest in its first paint", () => {
    const { host } = renderThemed(<S06Chart intro="left" />);
    // DOM audit: bars are aria-hidden plot output.
    const bars = [...host.querySelectorAll('[data-slot="chart-bar"]')];
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) expect(bar.getBoundingClientRect().height).toBeGreaterThan(0);
  });

  it("lands a data update in its first paint, with no fade", () => {
    const { host, rerender } = renderThemed(<MotionChart data={MOTION_A} />);
    rerender(<MotionChart data={MOTION_B} />);
    // DOM audit: the bar series layer covers the plot box, and bars are aria-hidden plot output.
    const plot =
      host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect() ?? new DOMRect();
    for (const entry of frames.bars.B) {
      const bar = host.querySelectorAll(
        `[data-slot="chart-bar-series"][data-series="${entry.series === "p" ? "0" : "1"}"] [data-slot="chart-bar"]`
      )[entry.position];
      if (bar === undefined) throw new Error("no bar");
      const box = barBox(bar, plot);
      expect(Math.abs(box.left - entry.left * plot.width)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(box.top - (entry.top * plot.height + entry.topPx))).toBeLessThanOrEqual(0.5);
      expect(Math.abs(box.bottom - entry.bottom * plot.height)).toBeLessThanOrEqual(0.5);
    }
    // DOM audit: Root's figure holds every animation of the chart.
    expect(host.querySelector('[data-slot="chart"]')?.getAnimations({ subtree: true })).toEqual([]);
  });

  it("lands a data update in both Panels in its first paint", async () => {
    // Two 200 px Panels on a domain of [0, 4]: 1 and 3 swap, so 50 px and 150 px bars swap too.
    const panels = (up: number, down: number) => (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 200 }}>
          <Chart.Root
            data={[{ name: "a", up, down }]}
            config={{ up: { label: "Opp", color: "chart-1" }, down: { label: "Ned", color: "chart-2" } }}
            xKey="name"
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Nivåer">
            <Chart.Panel series={["up"]} yInclude={[4]}>
              <Chart.Bar dataKey="up" />
            </Chart.Panel>
            <Chart.Panel series={["down"]} yInclude={[4]}>
              <Chart.Bar dataKey="down" />
            </Chart.Panel>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const { host, rerender } = renderThemed(panels(1, 3));
    // DOM audit: bars are aria-hidden plot output.
    const heights = () =>
      [...host.querySelectorAll('[data-slot="chart-bar"]')].map((bar) => bar.getBoundingClientRect().height);
    await expect.poll(heights).toEqual([50, 150]);
    rerender(panels(3, 1));
    expect(heights()).toEqual([150, 50]);
  });

  it("rests a Marker on its grouped bar, as with motion (B2-5, Q2-2)", () => {
    // 300 px, one category, two grouped bars: the first spans 37.5 to 149 px, so its Marker and
    // pill centre over that bar's middle near 93.25 px, never over the group at 150 px.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <Chart.Root
            data={[{ name: "x", a: 3, b: 4 }]}
            config={{ a: { label: "A", color: "chart-1" }, b: { label: "B", color: "chart-2" } }}
            xKey="name"
            aria-label="To">
            <Chart.BarGroup series={["a", "b"]}>
              <Chart.Bar dataKey="a" />
              <Chart.Bar dataKey="b" />
            </Chart.BarGroup>
            <Chart.Marker dataKey="a" at="first">
              <Chart.ValueLabel />
            </Chart.Marker>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: the bar series layer covers the plot box, and the marker parts are aria-hidden output.
    const plot =
      host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect() ?? new DOMRect();
    const bar = host.querySelector('[data-slot="chart-bar-series"][data-series="0"] [data-slot="chart-bar"]');
    const box = bar === null ? null : barBox(bar, plot);
    const dot = host.querySelector('[data-slot="chart-marker"] > svg > [data-slot="chart-dot"]');
    const anchor = host.querySelector<HTMLElement>('[data-slot="chart-marker"] > [data-part="anchor"]');
    const middle = ((box?.left ?? 0) + (box?.right ?? 0)) / 2;
    expect(Math.abs(middle - 93.25)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(Number(dot?.getAttribute("cx")) - middle)).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(Number.parseFloat(anchor?.style.getPropertyValue("--chart-marker-x") ?? "") - middle)
    ).toBeLessThanOrEqual(0.5);
  });

  it("writes each line path once for a tween, a slide and a crossfade", () => {
    const rows = (names: readonly string[], shift: number) =>
      names.map((name, index) => ({ name, v: 10 + ((index + shift) % 5) * 10 }));
    const chart = (data: readonly { name: string; v: number }[]) => (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <Chart.Root
            data={data}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            xScale="point"
            aria-label="Line">
            <Chart.Line dataKey="v" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const names = ["a", "b", "c", "d", "e"];
    const { host, rerender } = renderThemed(chart(rows(names, 0)));
    // DOM audit: the line's path is aria-hidden plot output.
    const path = host.querySelector('[data-slot="chart-line"][data-part="solid"]');
    // A tween over the same slots, an append that drops the first, and a window that grows.
    for (const next of [
      rows(names, 1),
      rows([...names.slice(1), "f"], 2),
      rows(["x", "y", ...names.slice(1), "f"], 3),
    ]) {
      const writes: string[] = [];
      const observer = new MutationObserver((records) => {
        for (const record of records) if (record.attributeName === "d") writes.push("d");
      });
      if (path !== null) observer.observe(path, { attributes: true, attributeFilter: ["d"] });
      rerender(chart(next));
      observer.takeRecords().forEach(() => writes.push("d"));
      observer.disconnect();
      expect(writes).toHaveLength(1);
      // No crossfade copy fades under reduced motion.
      expect(host.querySelector("[data-outgoing]")).toBeNull();
    }
  });
});
