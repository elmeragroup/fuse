// Where a legend and a legend toggle group sit beside Panels. With Panels the frame names no rows,
// and each part takes its column and order, per the frame's own description in chart.css. The
// expectations are that description's, written by hand: a top part is a row of its own above the
// first Panel across the frame's columns, a bottom part a row of its own below the last Panel,
// and a start or end part sits in the frame's outer column on its side, beside the first Panel.
// In a row of its own a legend spans the row, and a toggle group, whose own rule centres it, sits
// in the row's middle.
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { COMPOSED_CONFIG, day } from "../../../test/chart/panel-fixtures";
import { frame } from "../../../test/chart/panel-readers";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

type Side = "top" | "bottom" | "start" | "end";

/** Two Panels with a legend part outside them, 400 px wide. */
function Panelled({ legend }: { readonly legend: ReactNode }): ReactNode {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 400 }}>
        <Chart.Root
          data={day()}
          config={COMPOSED_CONFIG}
          xKey="start"
          interval="quarter-hour"
          timeZone="Europe/Oslo"
          data-intro="none"
          style={{ "--chart-plot-height": "120px" }}
          aria-label="Forbruk og pris">
          <Chart.Panel series={["kwh"]} yInclude={[5]}>
            <Chart.Bar dataKey="kwh" />
          </Chart.Panel>
          <Chart.Panel series={["price"]} yInclude={[1]}>
            <Chart.Line dataKey="price" curve="linear" />
          </Chart.Panel>
          {legend}
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

const PARTS = {
  legend: { slot: "chart-legend", centred: false, render: (side: Side) => <Chart.Legend side={side} /> },
  toggles: {
    slot: "chart-legend-toggle-group",
    centred: true,
    render: (side: Side) => <Chart.LegendToggleGroup side={side} />,
  },
} as const;

/** The part's box, the frame's and the two Panels', once the Panels have registered. */
async function boxes(host: HTMLElement, slot: string) {
  await frame();
  await frame();
  // DOM audit: the frame, the Panels and the legend part carry their slots; the frame and Panels
  // have no role, and the boxes are layout, which no role exposes.
  const box = (selector: string) => host.querySelector(selector)?.getBoundingClientRect() ?? new DOMRect();
  const panels = [...host.querySelectorAll('[data-slot="chart-panel"]')].map((panel) =>
    panel.getBoundingClientRect()
  );
  const [first = new DOMRect(), last = new DOMRect()] = [panels[0], panels.at(-1)];
  return { part: box(`[data-slot="${slot}"]`), frame: box('[data-slot="chart-frame"]'), first, last };
}

/** Check that a part in a row of its own spans the frame, or sits centred in it. */
function acrossRow(part: DOMRect, chart: DOMRect, centred: boolean): void {
  if (centred) {
    expect(part.width).toBeLessThan(chart.width);
    expect(Math.abs(part.left - chart.left - (chart.right - part.right))).toBeLessThanOrEqual(1);
  } else {
    expect(Math.abs(part.left - chart.left)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(part.right - chart.right)).toBeLessThanOrEqual(0.5);
  }
}

/** Whether two spans along one axis share more than an edge. */
function overlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 - 0.5 && b0 < a1 - 0.5;
}

describe.each(Object.entries(PARTS))("a %s beside Panels", (_, { slot, centred, render }) => {
  it("takes a row of its own above the first Panel at the top, across the frame", async () => {
    const { host } = renderThemed(<Panelled legend={render("top")} />);
    const { part, frame: chart, first } = await boxes(host, slot);
    expect(part.height).toBeGreaterThan(0);
    expect(part.bottom).toBeLessThanOrEqual(first.top + 0.5);
    acrossRow(part, chart, centred);
  });

  it("takes a row of its own below the last Panel at the bottom, across the frame", async () => {
    const { host } = renderThemed(<Panelled legend={render("bottom")} />);
    const { part, frame: chart, last } = await boxes(host, slot);
    expect(part.height).toBeGreaterThan(0);
    expect(part.top).toBeGreaterThanOrEqual(last.bottom - 0.5);
    acrossRow(part, chart, centred);
  });

  it("sits in the frame's first column beside the first Panel at the start", async () => {
    const { host } = renderThemed(<Panelled legend={render("start")} />);
    const { part, frame: chart, first } = await boxes(host, slot);
    expect(part.width).toBeGreaterThan(0);
    expect(Math.abs(part.left - chart.left)).toBeLessThanOrEqual(0.5);
    expect(part.right).toBeLessThanOrEqual(first.left + 0.5);
    expect(overlap(part.top, part.bottom, first.top, first.bottom)).toBe(true);
  });

  it("sits in the frame's last column beside the first Panel at the end", async () => {
    const { host } = renderThemed(<Panelled legend={render("end")} />);
    const { part, frame: chart, first } = await boxes(host, slot);
    expect(part.width).toBeGreaterThan(0);
    expect(Math.abs(part.right - chart.right)).toBeLessThanOrEqual(0.5);
    expect(part.left).toBeGreaterThanOrEqual(first.right - 0.5);
    expect(overlap(part.top, part.bottom, first.top, first.bottom)).toBe(true);
  });
});
