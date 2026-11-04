// The scatter tooltip's anchor under reduced motion, in Chromium, Firefox and WebKit, where the
// popup moves at once. Oracle: the tooltip's rule, the popup rests ROOF_GAP, 8 px, above the
// active point's edge, so its bottom sits half the point's diameter plus 8 px above the point's
// centre: 2.5 + 8 = 10.5 px for a small 5 px point and 5.5 + 8 = 13.5 px for a large 11 px one.
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { popup } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ScatterChart } from "./scatter-chart-namespace";

const CONFIG = { now: { label: "Forbruk 2026", color: "chart-1" } } as const satisfies ChartConfig;

/** now(8, 90 000) sits at (100, 70) on a 200 by 140 px plot over x [−2, 18] and y [20 000, 160 000]. */
const ROWS = [
  { t: -2, kwh: 20_000, s: "now" },
  { t: 8, kwh: 90_000, s: "now" },
  { t: 18, kwh: 160_000, s: "now" },
];

function Sized({ size }: { readonly size: "sm" | "lg" }) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 200, marginTop: 200 }}>
        <ScatterChart.Root
          data={ROWS}
          config={CONFIG}
          xKey="t"
          yKey="kwh"
          seriesKey="s"
          aria-label="Forbruk mot temperatur"
          style={{ "--chart-plot-height": "140px" }}>
          <ScatterChart.Points dataKey="now" size={size} />
          <ScatterChart.Tooltip />
        </ScatterChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** How far the open popup's bottom rests above the point at (100, 70), in CSS pixels. */
function gap(): number | null {
  const open = popup();
  if (open === null) return null;
  const plot = page.getByRole("listbox").element().getBoundingClientRect();
  return plot.top + 70 - open.getBoundingClientRect().bottom;
}

describe("the tooltip's anchor", () => {
  it("rests clear of a point whose size changes while the tooltip stays open", async () => {
    const { rerender } = renderThemed(<Sized size="sm" />);
    await userEvent.hover(page.getByRole("listbox"), { position: { x: 100, y: 70 } });
    await expect.poll(() => Math.abs((gap() ?? 0) - 10.5)).toBeLessThanOrEqual(0.5);
    rerender(<Sized size="lg" />);
    await expect.poll(() => Math.abs((gap() ?? 0) - 13.5)).toBeLessThanOrEqual(0.5);
  });
});
