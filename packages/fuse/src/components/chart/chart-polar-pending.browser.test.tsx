// The polar Roots before their layers land, after finding q2 of layer 05's review: ordinary children
// render as written, and the shared parts render nothing instead of throwing outside a cartesian
// Root. The oracle is the review's own example, `<PieChart.Root><p>Consumer content</p></PieChart.Root>`.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";

const config = { a: { label: "A", color: "chart-1" }, b: { label: "B", color: "chart-2" } } as const;

describe("polar Roots before their layers", () => {
  it.each([
    [
      "PieChart",
      <PieChart.Root
        key="pie"
        data={[{ name: "a", v: 1 }]}
        config={config}
        nameKey="name"
        valueKey="v"
        aria-label="Kake">
        <p>Consumer content</p>
        <PieChart.Tooltip />
        <PieChart.Legend />
        <PieChart.Table />
        <PieChart.Empty />
      </PieChart.Root>,
    ],
    [
      "RadarChart",
      <RadarChart.Root
        key="radar"
        data={[{ cat: "x", a: 1, b: 2 }]}
        config={config}
        nameKey="cat"
        aria-label="Radar">
        <p>Consumer content</p>
        <RadarChart.Tooltip />
        <RadarChart.Legend />
        <RadarChart.Table />
      </RadarChart.Root>,
    ],
    [
      "RadialChart",
      <RadialChart.Root
        key="radial"
        data={[{ name: "a", v: 1, max: 2 }]}
        config={config}
        nameKey="name"
        valueKey="v"
        maxKey="max"
        aria-label="Ring">
        <p>Consumer content</p>
        <RadialChart.Tooltip />
        <RadialChart.Legend />
        <RadialChart.Table />
      </RadialChart.Root>,
    ],
  ])("renders %s's ordinary children and none of the shared parts", (_, chart) => {
    const { host } = renderThemed(<LocaleProvider locale="nb-NO">{chart}</LocaleProvider>);
    expect(host.querySelector("figure p")?.textContent).toBe("Consumer content");
    // DOM audit: the shared parts' slots are the only way to see that they rendered nothing.
    for (const slot of ["chart-tooltip", "chart-legend", "chart-table", "chart-empty"]) {
      expect(host.querySelector(`[data-slot="${slot}"]`), slot).toBeNull();
    }
  });
});
