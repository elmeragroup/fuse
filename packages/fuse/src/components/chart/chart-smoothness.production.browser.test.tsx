// The update smoothness judge, in Chromium with React's production build, the build a reader's
// browser runs: a data update of 500 bars, 100 daily slots in 5 stacked series, and one of a line
// of 2,000 vertices, the most a window draws before it decimates, each log no long task over 50 ms
// through its commit and its 480 ms tween. The limit comes from motion-decision.md
// "Judges" and the SVG brief's excellence bar. Dropped frames depend on the machine's load, so the
// long task is the judge.
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
          data-intro="none"
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
  it("updates 500 bars with no long task over 50 ms", async () => {
    const { host, rerender } = renderThemed(<Chart500 phase={0} />);
    // DOM audit: bars are aria-hidden plot output.
    expect(host.querySelectorAll('[data-slot="chart-bar"]')).toHaveLength(500);
    // The mount's own rendering task ends a frame later, so the observer starts after it.
    for (let count = 0; count < 3; count += 1) await new Promise((resolve) => requestAnimationFrame(resolve));
    const long: number[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) long.push(entry.duration);
    });
    observer.observe({ entryTypes: ["longtask"] });
    const first = host.querySelector('[data-slot="chart-bar"]');
    const height = (): string | null | undefined => first?.getAttribute("height");
    const before = height();
    const start = performance.now();
    rerender(<Chart500 phase={3} />);
    // The update moves its bars: the first one paints its old height, then reaches a new one.
    const rewound = height();
    while (performance.now() - start < 560) await new Promise((resolve) => requestAnimationFrame(resolve));
    observer.disconnect();
    expect(rewound).toBe(before);
    expect(height()).not.toBe(before);
    expect(long.filter((duration) => duration > 50)).toEqual([]);
  });

  it("updates a line of 2,000 vertices with no long task over 50 ms", async () => {
    const line = (phase: number) => (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 800 }}>
          <Chart.Root
            data={Array.from({ length: 2000 }, (_, index) => ({
              name: `s${String(index)}`,
              a: tooth(index, phase),
            }))}
            config={{ a: CONFIG.a }}
            xKey="name"
            xScale="point"
            data-intro="none"
            aria-label="2,000 readings">
            <Chart.Line dataKey="a" curve="linear" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const { host, rerender } = renderThemed(line(0));
    for (let count = 0; count < 3; count += 1) await new Promise((resolve) => requestAnimationFrame(resolve));
    const long: number[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) long.push(entry.duration);
    });
    observer.observe({ entryTypes: ["longtask"] });
    // DOM audit: the line is aria-hidden plot output.
    const path = host.querySelector('[data-slot="chart-line"][data-part="solid"]');
    const before = path?.getAttribute("d");
    const start = performance.now();
    rerender(line(3));
    // The update tweens its vertices: the path paints its old data first, then reaches the new.
    const rewound = path?.getAttribute("d");
    while (performance.now() - start < 560) await new Promise((resolve) => requestAnimationFrame(resolve));
    observer.disconnect();
    expect(rewound).toBe(before);
    expect(path?.getAttribute("d")).not.toBe(before);
    expect(long.filter((duration) => duration > 50)).toEqual([]);
  });
});
