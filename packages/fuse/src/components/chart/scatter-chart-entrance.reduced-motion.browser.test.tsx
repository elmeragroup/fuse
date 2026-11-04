// ScatterChart's entrance under reduced motion, in Chromium, Firefox and WebKit, whose Playwright
// context sets prefers-reduced-motion: reduce. Oracle: the reduced-motion rule, no entrance
// motion: Root never waits, and the points and the line draw at rest with no running animation.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ScatterChart } from "./scatter-chart-namespace";

const CONFIG = { a: { label: "A", color: "chart-1" } } as const satisfies ChartConfig;
const ROWS = [
  { t: 0, v: 1, s: "a" },
  { t: 10, v: 4, s: "a" },
];

describe("the scatter entrance under reduced motion", () => {
  it("matches the reduce query in this engine", () => {
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
  });

  it("draws the points and the line at rest, below the fold too, with no waiting state", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ height: 2000 }} />
        <div style={{ width: 300 }}>
          <ScatterChart.Root
            data={ROWS}
            config={CONFIG}
            xKey="t"
            yKey="v"
            seriesKey="s"
            aria-label="Uten bevegelse">
            <ScatterChart.Points dataKey="a" />
            <ScatterChart.Line dataKey="a" />
          </ScatterChart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: the marks are aria-hidden plot output, and Root carries the entrance state.
    await expect.poll(() => host.querySelector('[data-slot="chart-points-path"]')).not.toBeNull();
    expect(host.querySelector('[data-slot="chart"]')?.hasAttribute("data-entrance")).toBe(false);
    const layers = [...host.querySelectorAll('[data-slot="chart-points"], [data-slot="chart-line-series"]')];
    expect(layers).toHaveLength(2);
    expect(layers.flatMap((layer) => layer.getAnimations())).toEqual([]);
  });

  it("snaps the domains to a data update", async () => {
    const draw = (rows: readonly { t: number; v: number; s: string }[]) => (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <ScatterChart.Root
            data={rows}
            config={CONFIG}
            xKey="t"
            yKey="v"
            seriesKey="s"
            aria-label="Uten bevegelse">
            <ScatterChart.Points dataKey="a" />
          </ScatterChart.Root>
        </div>
      </LocaleProvider>
    );
    const { host, rerender } = renderThemed(draw(ROWS));
    // DOM audit: the points are aria-hidden plot output.
    const path = () => host.querySelector('[data-slot="chart-points-path"]')?.getAttribute("d");
    await expect.poll(path).toBe("M0 200h0M300 0h0");
    // x widens to [0, 20], so (10, 4) moves to the middle, 150 px, in the same commit.
    rerender(draw([...ROWS, { t: 20, v: 4, s: "a" }]));
    expect(path()).toBe("M0 200h0M150 0h0M300 0h0");
  });
});
