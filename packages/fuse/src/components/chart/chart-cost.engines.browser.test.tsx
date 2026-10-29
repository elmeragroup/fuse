// The pointer-cost judge of ticket 05, in Chromium, Firefox and WebKit. In a 240-step pointer
// sweep only the tooltip and the plot surface render, and marks, the crosshair and a static legend
// render 0 times. A LegendValue renders at most once per change of active slot. A resize costs 0
// commits. The counts come from React's Profiler, and the expected numbers come from CONTRACT
// section 4 and pass-2's interaction README section 6, not from Fuse.
import { Profiler } from "react";
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { S06Chart } from "../../../test/chart/bar-charts";
import { MOTION_A, MOTION_B, MOTION_CONFIG } from "../../../test/chart/motion-fixture";
import type { MotionRow } from "../../../test/chart/motion-fixture";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

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

async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

describe("pointer cost", () => {
  it("renders only the tooltip, the surface and a LegendValue in a 240-step sweep", async () => {
    commits.clear();
    const { host } = renderThemed(
      <div style={{ width: 820 }}>
        <S06Chart>
          <Counted id="bar">
            <Chart.Bar dataKey="household" />
          </Counted>
          <Counted id="crosshair">
            <Chart.Crosshair />
          </Counted>
          <Counted id="tooltip">
            <Chart.Tooltip />
          </Counted>
          <Counted id="legend">
            <Chart.Legend />
          </Counted>
          <Counted id="legend-value">
            <Chart.Legend>
              <Chart.LegendItem>
                <Chart.LegendValue />
              </Chart.LegendItem>
            </Chart.Legend>
          </Counted>
        </S06Chart>
      </div>
    );
    const surface = host.querySelector<HTMLElement>('[role="listbox"]');
    const box = surface?.getBoundingClientRect() ?? new DOMRect();
    const slots = new Set<number>();
    for (let step = 0; step < 240; step += 1) {
      const x = box.left + (box.width * (step + 0.5)) / 240;
      surface?.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: x,
          clientY: box.top + box.height / 2,
          pointerType: "mouse",
        })
      );
      slots.add(Math.floor(((step + 0.5) / 240) * 24));
      await frame();
    }
    expect(commits.get("bar") ?? 0).toBe(0);
    expect(commits.get("crosshair") ?? 0).toBe(0);
    expect(commits.get("legend") ?? 0).toBe(0);
    expect(commits.get("tooltip") ?? 0).toBeGreaterThan(0);
    // 24 slots, so at most 24 changes of the active slot, each rendering the legend value once.
    expect(commits.get("legend-value") ?? 0).toBeLessThanOrEqual(slots.size);
  });

  it("costs 0 commits for a resize from 820 to 360 px", async () => {
    commits.clear();
    const { host } = renderThemed(
      <div style={{ width: 820 }} data-probe="">
        <Counted id="chart">
          <S06Chart>
            <Chart.Bar dataKey="household" />
            <Chart.XAxis />
            <Chart.YAxis />
            <Chart.Grid />
          </S06Chart>
        </Counted>
      </div>
    );
    await frame();
    commits.clear();
    const box = host.querySelector<HTMLElement>("[data-probe]");
    for (const width of [700, 560, 420, 360]) {
      box?.style.setProperty("width", `${String(width)}px`);
      await frame();
      await frame();
    }
    expect(commits.get("chart") ?? 0).toBe(0);
  });

  it("costs one Root commit for a data update, 0 for its transition, and 0 marks for hover during it", async () => {
    function Motion({ data }: { readonly data: readonly MotionRow[] }): ReactNode {
      return (
        <LocaleProvider locale="nb-NO">
          <div style={{ width: 400 }}>
            <Counted id="root">
              <Chart.Root
                data={data}
                config={MOTION_CONFIG}
                xKey="day"
                interval="day"
                timeZone="Europe/Oslo"
                aria-label="Forbruk per dag">
                <Counted id="bar">
                  <Chart.Bar dataKey="p" />
                </Counted>
              </Chart.Root>
            </Counted>
          </div>
        </LocaleProvider>
      );
    }
    const { host, rerender } = renderThemed(<Motion data={MOTION_A} />);
    await frame();
    commits.clear();
    rerender(<Motion data={MOTION_B} />);
    expect(commits.get("root")).toBe(1);
    // The transition runs in CSS, so its 480 ms commit nothing.
    const quiet = performance.now();
    while (performance.now() - quiet < 520) await frame();
    expect(commits.get("root")).toBe(1);
    rerender(<Motion data={MOTION_A} />);
    const afterUpdate = commits.get("bar") ?? 0;
    const surface = host.querySelector<HTMLElement>('[role="listbox"]');
    const box = surface?.getBoundingClientRect() ?? new DOMRect();
    const start = performance.now();
    // Hover across the plot while the 480 ms transition runs, then wait for it to end.
    for (let step = 0; performance.now() - start < 520; step += 1) {
      const x = box.left + ((step % 10) + 0.5) * (box.width / 10);
      surface?.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: x,
          clientY: box.top + 10,
          pointerType: "mouse",
        })
      );
      await frame();
    }
    expect(commits.get("bar") ?? 0).toBe(afterUpdate);
  });
});
