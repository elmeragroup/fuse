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
});
