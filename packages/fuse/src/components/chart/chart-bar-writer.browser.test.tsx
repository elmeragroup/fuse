// The writer that draws a bar from its loop's numbers. A plain bar is one polygon, and anything a
// page adds inside it, such as a title, must not take its geometry. The expectations are written
// by hand from the plot: 200 px tall over 0 to 4, so a reading of 2 stands 100 px and one of 4
// stands 200 px.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { drawnRect } from "../../../test/chart/bar-box";
import { installFrameClock } from "../../../test/chart/frame-clock";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

const CONFIG = { a: { label: "A", color: "chart-1" } } as const satisfies ChartConfig;

function near(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.5);
}

describe("a bar that holds a node of its own", () => {
  it("keeps drawing its geometry with a title inside it, through a data update", () => {
    // A plain bar is a polygon, and a title or desc a page adds inside it is valid SVG. The bar
    // must keep taking its own geometry: on a 200 px plot over 0 to 4, a reading of 2 stands
    // 100 px tall and one of 4 stands 200 px, as its sibling without a title does.
    const clock = installFrameClock();
    try {
      const chart = (a: number) => (
        <LocaleProvider locale="nb-NO">
          <div style={{ width: 160 }}>
            <Chart.Root
              data-intro="none"
              data={[
                { name: "x", a },
                { name: "y", a },
              ]}
              config={CONFIG}
              xKey="name"
              yInclude={[0, 4]}
              aria-label="To">
              <Chart.Bar dataKey="a" />
            </Chart.Root>
          </div>
        </LocaleProvider>
      );
      const { host, rerender } = renderThemed(chart(2));
      // DOM audit: bars are aria-hidden plot output, so their slot is the only locator.
      const [first, second] = host.querySelectorAll('[data-slot="chart-bar"]');
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = "x";
      first?.append(title);
      near(drawnRect(first).height, 100);
      const start = clock.now();
      rerender(chart(4));
      clock.frameAt(start + 2000);
      near(drawnRect(first).height, 200);
      near(drawnRect(second).height, 200);
      expect(title.hasAttribute("points")).toBe(false);
    } finally {
      clock.restore();
    }
  });
});
