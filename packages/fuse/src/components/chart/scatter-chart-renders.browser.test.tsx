// What a pointer sweep renders in a scatter chart, in a development build of Chromium, where React's
// Profiler reports every commit. Unit under test: the surface's pointer path and the store between
// it and the marks. Oracle: SPEC.md's performance plan, under which a pointer move writes the store
// and the Root's attributes and renders no mark. A positive control renders a mark on purpose, so
// a counter that stopped counting would fail the control.
import { Profiler } from "react";
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
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

async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

describe("a pointer sweep", () => {
  it("renders no mark, and the counter sees a mark that renders on purpose", async () => {
    const { host, rerender } = renderThemed(<Chart size="sm" />);
    // DOM audit: the points are aria-hidden plot output.
    await expect.poll(() => host.querySelector('[data-slot="chart-points-path"]')).not.toBeNull();
    await frame();
    commits.clear();
    const surface = host.querySelector('[role="listbox"]');
    const box = surface?.getBoundingClientRect() ?? new DOMRect();
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
      await frame();
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
