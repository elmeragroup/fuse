// What a pointer sweep and a data update render in a scatter chart, in a development build of
// Chromium, where React's Profiler reports every commit. Unit under test: the surface's pointer path,
// the store between it and the marks, and the domains a mark draws under. Oracles: the performance
// plan's rules, under which a pointer move writes the store and the Root's attributes and renders no
// mark, and a data update that snaps its domains builds each series' path once, under the new
// domains. A positive control renders a mark on purpose, so a counter that stopped counting would
// fail the control.
import { Profiler } from "react";
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { surfaceBox } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ScatterChart } from "./scatter-chart-namespace";

const CONFIG = { a: { label: "A", color: "chart-1" } } as const satisfies ChartConfig;

/** 400 points along a diagonal, so a sweep across the plot passes over many of them. */
const ROWS = Array.from({ length: 400 }, (_, index) => ({ t: index, v: index % 37, s: "a" }));

const commits = new Map<string, number>();

function Counted({ id, children }: { readonly id: string; readonly children: ReactNode }): ReactNode {
  return (
    <Profiler
      id={id}
      onRender={(_, phase) => {
        if (phase !== "mount") commits.set(id, (commits.get(id) ?? 0) + 1);
      }}>
      {children}
    </Profiler>
  );
}

/** The chart, whose points' size the control changes to render the marks on purpose. */
function Chart({ size }: { readonly size: "sm" | "lg" }) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 400 }}>
        <ScatterChart.Root
          data={ROWS}
          config={CONFIG}
          xKey="t"
          yKey="v"
          seriesKey="s"
          data-intro="none"
          aria-label="Sveip">
          <Counted id="points">
            <ScatterChart.Points dataKey="a" size={size} />
          </Counted>
          <ScatterChart.ActiveDot />
          <ScatterChart.Tooltip />
        </ScatterChart.Root>
      </div>
    </LocaleProvider>
  );
}

describe("a pointer sweep", () => {
  it("renders no mark, and the counter sees a mark that renders on purpose", async () => {
    const { host, rerender } = renderThemed(<Chart size="sm" />);
    // DOM audit: the points are aria-hidden plot output.
    await expect.poll(() => host.querySelector('[data-slot="chart-points-path"]')).not.toBeNull();
    await nextFrames();
    commits.clear();
    const surface = host.querySelector('[role="listbox"]');
    const box = surfaceBox(host);
    let shown = 0;
    for (let step = 0; step <= 120; step += 1) {
      surface?.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerType: "mouse",
          clientX: box.left + (box.width * step) / 120,
          clientY: box.top + box.height * (1 - (step % 37) / 37),
        })
      );
      await nextFrames();
      // DOM audit: Root's active state is the attribute its CSS reads.
      if (host.querySelector('[data-slot="chart"]')?.hasAttribute("data-active") === true) shown += 1;
    }
    // The sweep found points, so the store moved, and no mark rendered for it.
    expect(shown).toBeGreaterThan(0);
    expect(commits.get("points") ?? 0).toBe(0);
    // The control: a new size renders the points, and the counter counts it.
    rerender(<Chart size="lg" />);
    expect(commits.get("points") ?? 0).toBeGreaterThan(0);
  });
});

/**
 * 6 000 points of one series from x `start` on, past the 5 000 a glide draws, with y cycling
 * through 0 to 49 by `step`.
 */
function line(start: number, step: number): { readonly t: number; readonly v: number; readonly s: string }[] {
  return Array.from({ length: 6_000 }, (_, index) => ({ t: start + index, v: (index * step) % 50, s: "a" }));
}

function Many({
  data,
}: {
  readonly data: readonly { readonly t: number; readonly v: number; readonly s: string }[];
}) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 400 }}>
        <ScatterChart.Root
          data={data}
          config={CONFIG}
          xKey="t"
          yKey="v"
          seriesKey="s"
          data-intro="none"
          aria-label="Mange">
          <ScatterChart.Points dataKey="a" size="sm" />
        </ScatterChart.Root>
      </div>
    </LocaleProvider>
  );
}

describe("a data update past the glide limit", () => {
  it("builds the series' path once, under the new domains", async () => {
    // x runs 0 to 5 999, which nices to [0, 6 000], then 20 000 to 25 999, which nices to
    // [20 000, 26 000], so the update moves the x domain and snaps it.
    const { host, rerender } = renderThemed(<Many data={line(0, 1)} />);
    // DOM audit: the points are aria-hidden plot output.
    const path = () => host.querySelector('[data-slot="chart-points-path"]');
    await expect.poll(path).not.toBeNull();
    await nextFrames();
    const drawn = path();
    const before = drawn?.getAttribute("d");
    const writes: MutationRecord[] = [];
    const observer = new MutationObserver((records) => {
      writes.push(...records);
    });
    if (drawn !== null) {
      observer.observe(drawn, { attributes: true, attributeFilter: ["d"], attributeOldValue: true });
    }
    rerender(<Many data={line(20_000, 7)} />);
    await nextFrames(2);
    writes.push(...observer.takeRecords());
    observer.disconnect();
    // The same element takes one new path, straight from the old one. A first build under the old
    // domains would have drawn every point past the plot's right edge, and a second write followed.
    expect(path()).toBe(drawn);
    expect(writes.map((record) => record.oldValue)).toEqual([before]);
    expect(drawn?.getAttribute("d")).not.toBe(before);
  });
});

/** The chart under a config whose label the test changes, its tooltip counted. */
function Labelled({ label }: { readonly label: string }) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 400 }}>
        <ScatterChart.Root
          data={ROWS}
          config={{ a: { label, color: "chart-1" } }}
          xKey="t"
          yKey="v"
          seriesKey="s"
          data-intro="none"
          aria-label="Etikett">
          <ScatterChart.Points dataKey="a" size="sm" />
          <Counted id="tooltip">
            <ScatterChart.Tooltip />
          </Counted>
          <ScatterChart.Legend />
        </ScatterChart.Root>
      </div>
    </LocaleProvider>
  );
}

describe("a label-only config change", () => {
  it("keeps the model, so the store carries no walk and the path stays as it was", async () => {
    const { host, rerender } = renderThemed(<Labelled label="Forbruk" />);
    // DOM audit: the points are aria-hidden plot output.
    const path = () => host.querySelector('[data-slot="chart-points-path"]');
    await expect.poll(path).not.toBeNull();
    await nextFrames();
    const drawn = path();
    const before = drawn?.getAttribute("d");
    commits.clear();
    rerender(<Labelled label="Forbruk 2026" />);
    await nextFrames(2);
    // The legend prints the new label, so the config change reached the parts.
    expect(host.querySelector('[data-slot="chart-series-label"]')?.textContent).toBe("Forbruk 2026");
    expect(path()).toBe(drawn);
    expect(path()?.getAttribute("d")).toBe(before);
    // The tooltip reads the walk, so it renders once for the new config. A rebuilt model would
    // make Root carry the walk into it, and the tooltip would render a second time.
    expect(commits.get("tooltip") ?? 0).toBe(1);
  });
});
