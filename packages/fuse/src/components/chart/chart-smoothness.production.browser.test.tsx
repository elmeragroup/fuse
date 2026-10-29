// The update smoothness judge of ticket 05, row T177, in Chromium with React's production build,
// the build a reader's browser runs: a data update of 500 HTML bars, 100 daily slots in 5 stacked
// series, logs no long task over 50 ms and drops at most 2 frames at 60 Hz over the 480 ms
// transition. The limits come from motion-decision.md "Judges".
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

const KEYS = ["a", "b", "c", "d", "e"] as const;
const CONFIG = {
  a: { label: "A", color: "chart-1", stack: "all" },
  b: { label: "B", color: "chart-2", stack: "all" },
  c: { label: "C", color: "chart-3", stack: "all" },
  d: { label: "D", color: "chart-4", stack: "all" },
  e: { label: "E", color: "chart-5", stack: "all" },
} as const satisfies ChartConfig;

/** A sawtooth from 1 to 7 at a slot, shifted per series and per update. */
function tooth(index: number, shift: number): number {
  return 1 + ((index + shift) % 7);
}

/** 100 Oslo days from 1 January 2026. Midnight falls at 22:00 UTC from 30 March, index 88. */
function rows(phase: number) {
  return Array.from({ length: 100 }, (_, index) => ({
    day: new Date(Date.UTC(2026, 0, 1 + index, index >= 88 ? -2 : -1)),
    a: tooth(index, phase),
    b: tooth(index, phase + 3),
    c: tooth(index, phase + 6),
    d: tooth(index, phase + 9),
    e: tooth(index, phase + 12),
  }));
}

function Chart500({ phase }: { readonly phase: number }) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 800 }}>
        <Chart.Root
          data={rows(phase)}
          config={CONFIG}
          xKey="day"
          interval="day"
          timeZone="Europe/Oslo"
          aria-label="500 bars">
          {KEYS.map((key) => (
            <Chart.Bar key={key} dataKey={key} />
          ))}
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

describe("update smoothness", () => {
  it("updates 500 bars with no long task over 50 ms and at most 2 dropped frames", async () => {
    const { host, rerender } = renderThemed(<Chart500 phase={0} />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    // DOM audit: Root's figure holds every animation of the chart.
    for (const animation of host.querySelector('[data-slot="chart"]')?.getAnimations({ subtree: true }) ??
      []) {
      animation.finish();
    }
    // DOM audit: bars are aria-hidden plot output.
    expect(host.querySelectorAll('[data-slot="chart-bar"]')).toHaveLength(500);
    // The mount's own rendering task ends a frame later, so the observer starts after it.
    for (let count = 0; count < 3; count += 1) await new Promise((resolve) => requestAnimationFrame(resolve));
    const long: number[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) long.push(entry.duration);
    });
    observer.observe({ entryTypes: ["longtask"] });
    const stamps: number[] = [];
    const start = performance.now();
    rerender(<Chart500 phase={3} />);
    while (performance.now() - start < 480) {
      stamps.push(await new Promise<number>((resolve) => requestAnimationFrame(resolve)));
    }
    observer.disconnect();
    const dropped = stamps
      .slice(1)
      .map((stamp, index) => Math.max(0, Math.round((stamp - (stamps[index] ?? stamp)) / (1000 / 60)) - 1))
      .reduce((sum, count) => sum + count, 0);
    expect(long.filter((duration) => duration > 50)).toEqual([]);
    expect(dropped).toBeLessThanOrEqual(2);
  });
});
