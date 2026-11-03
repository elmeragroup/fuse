// The pointer-following glides under reduced motion, in Chromium, Firefox and WebKit, whose
// Playwright context sets prefers-reduced-motion: reduce. Oracle: DECISIONS D16, reduced motion
// snaps every new motion: after a step the line crosshair, Chart.SlotLabel's pill and its parts
// and the ticks it covers show their resting state in the same frame, with no animation running.
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { S06Chart } from "../../../test/chart/bar-charts";
import { renderThemed } from "../../../test/themed-browser-render";
import { Chart } from "./chart-namespace";
import "./chart.css";

describe("the glides under reduced motion", () => {
  it("matches the reduce query in this engine", () => {
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
  });

  it("places the line crosshair, the pill, its parts and the covered ticks at once", async () => {
    const { host } = renderThemed(
      <div style={{ width: 600 }}>
        <S06Chart>
          <Chart.XAxis />
          <Chart.Line dataKey="household" />
          <Chart.Crosshair variant="line">
            <Chart.SlotLabel />
          </Chart.Crosshair>
        </S06Chart>
      </div>
    );
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}{Home}{ArrowRight}{ArrowRight}{ArrowRight}");
    // DOM audit: the crosshair, the pill and the ticks are aria-hidden plot output.
    const rect = host.querySelector('[data-slot="chart-crosshair-mark"]');
    const label = host.querySelector<HTMLElement>('[data-slot="chart-slot-label"]');
    const ticks = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"]')];
    expect(rect).not.toBeNull();
    expect(label).not.toBeNull();
    const crosshair = host.querySelector('[data-slot="chart-crosshair"]');
    const running = [crosshair, label, ...ticks].flatMap(
      (node) => node?.getAnimations({ subtree: true }) ?? []
    );
    expect(running).toEqual([]);
    // The line shows on the column its x attribute names, in the plot the layer spans.
    const plot =
      host.querySelector('[data-slot="chart-grid"], [role="listbox"]')?.getBoundingClientRect().left ?? 0;
    expect(rect?.getBoundingClientRect().left).toBeCloseTo(plot + Number(rect?.getAttribute("x")), 1);
    // A covered tick is already out.
    const covered = ticks.filter((tick) => tick.hasAttribute("data-covered"));
    expect(covered.length).toBeGreaterThan(0);
    for (const tick of covered) expect(getComputedStyle(tick).opacity).toBe("0");
  });
});
