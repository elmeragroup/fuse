// Reveal's edge under the reader's reduced-motion preference. Unit under test: Reveal's follower.
// Oracle: the active slot's place, which the edge takes at once, as the crosshair does.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { dispatchSlotMove } from "../../../test/chart/tooltip-glide";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

const CONFIG = { v: { label: "V", color: "chart-1" } } as const satisfies ChartConfig;
const ROWS = ["a", "b", "c", "d"].map((name, index) => ({ name, v: index + 1 }));

describe("Chart.Reveal under reduced motion", () => {
  it("moves the edge to the active slot at once", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root data={ROWS} config={CONFIG} xKey="name" data-intro="none" aria-label="Reveal">
            <Chart.Crosshair />
            <Chart.Reveal>
              <Chart.Line dataKey="v" />
            </Chart.Reveal>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    await nextFrames(2);
    // DOM audit: the series is aria-hidden plot output.
    const line = host.querySelector<SVGElement>('[data-slot="chart-line-series"]');
    if (line === null) throw new Error("no line");
    // The first and the fourth of four 100 px bands.
    dispatchSlotMove(host, 0.125);
    await nextFrames(2);
    dispatchSlotMove(host, 0.875);
    await nextFrames(1);
    // The fourth of four 100 px bands centres at 350 px, the middle of the device pixel 350 to 351.
    expect(line.getAnimations()).toEqual([]);
    expect(getComputedStyle(line).getPropertyValue("--chart-active-x").trim()).toBe("350.5px");
  });
});
