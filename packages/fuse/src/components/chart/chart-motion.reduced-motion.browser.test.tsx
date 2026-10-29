// Reduced motion in Chromium, Firefox and WebKit, whose Playwright context sets
// prefers-reduced-motion: reduce. Oracle: CONTRACT section 9.9's limit of 150 ms for the legend
// fade, DECISIONS' rule that movement goes under no-preference, and section 11's keyframe
// properties at none.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { S06Chart } from "../../../test/chart/bar-charts";
import { MOTION_A, MOTION_B, MotionChart } from "../../../test/chart/motion-fixture";
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

  it("fades the legend and its toggles in 150 ms or less and moves no bar", () => {
    const { host } = renderThemed(
      <S06Chart>
        <Chart.Bar dataKey="household" />
        <Chart.Legend />
        <Chart.LegendToggleGroup />
      </S06Chart>
    );
    // DOM audit: the transitions under test live on these slots, and bars are aria-hidden.
    const item = host.querySelector('[data-slot="chart-legend-item"]');
    const toggle = host.querySelector('[data-slot="chart-legend-toggle"]');
    const bar = host.querySelector('[data-slot="chart-bar"]');
    for (const element of [item, toggle]) {
      expect(element).not.toBeNull();
      expect(durationOf(element ?? document.body, "opacity")).toBeLessThanOrEqual(150);
    }
    const barProperties = getComputedStyle(bar ?? document.body).transitionProperty;
    for (const movement of ["transform", "translate", "scale", "top", "height", "clip-path"]) {
      expect(barProperties.split(",").map((entry) => entry.trim())).not.toContain(movement);
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

  it("runs no animation other than opacity or colour at first mount or after a data update", async () => {
    const { host, rerender } = renderThemed(<MotionChart data={MOTION_A} />);
    // DOM audit: Root's figure holds every animation of the chart.
    const root = host.querySelector('[data-slot="chart"]') ?? document.body;
    const moving = (): Animation[] =>
      root.getAnimations({ subtree: true }).filter((animation) => {
        const property =
          "transitionProperty" in animation ? String(animation.transitionProperty) : "keyframes";
        return !["opacity", "color", "background-color"].includes(property);
      });
    expect(moving()).toEqual([]);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    rerender(<MotionChart data={MOTION_B} />);
    expect(moving()).toEqual([]);
  });
});
