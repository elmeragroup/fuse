import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";

import { AreaChart, BarChart, Chart, LineChart } from "./chart-namespace";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";

/** A chart part, which every namespace member and every part-module export is. */
type Part = (props: never) => ReactElement;

/** The `displayName` a part carries, or undefined. */
function displayNameOf(part: Part): string | undefined {
  return "displayName" in part ? String(part.displayName) : undefined;
}

/** The four namespaces in canonical-owner order, as CONTRACT.md section 3 ranks them. */
const NAMESPACES: ReadonlyArray<readonly [string, Readonly<Record<string, Part>>]> = [
  ["Chart", Chart],
  ["PieChart", PieChart],
  ["RadialChart", RadialChart],
  ["RadarChart", RadarChart],
];

/** The 20 parts every namespace shares under the same key, from CONTRACT.md section 3. */
const SHARED_KEYS = [
  "Headline",
  "Takeaway",
  "Tooltip",
  "TooltipLabel",
  "TooltipItems",
  "TooltipValue",
  "TooltipShare",
  "Swatch",
  "SeriesLabel",
  "SeriesIcon",
  "Legend",
  "LegendItem",
  "LegendValue",
  "LegendShare",
  "LegendToggleGroup",
  "LegendToggle",
  "Table",
  "TableColumn",
  "Empty",
  "Background",
] as const;

describe("chart namespaces", () => {
  it("hold the part counts of CONTRACT.md section 3", () => {
    expect(NAMESPACES.map(([name, namespace]) => [name, Object.keys(namespace).length])).toEqual([
      ["Chart", 44],
      ["PieChart", 31],
      ["RadialChart", 30],
      ["RadarChart", 30],
    ]);
  });

  it("give the three aliases Chart's keys, each the same component", () => {
    // Each alias is an ES module namespace of its own, so it is a different object with the same
    // members, and every member is Chart's own component.
    const chart: Readonly<Record<string, Part>> = Chart;
    for (const alias of [AreaChart, BarChart, LineChart] as const) {
      const members: Readonly<Record<string, Part>> = alias;
      expect(Object.keys(members).sort()).toEqual(Object.keys(chart).sort());
      for (const [key, part] of Object.entries(members)) expect(part, key).toBe(chart[key]);
    }
  });

  it.each(SHARED_KEYS)("share %s as one component under every namespace", (key) => {
    const chart: Readonly<Record<string, Part>> = Chart;
    for (const [, namespace] of NAMESPACES) {
      expect(namespace[key]).toBe(chart[key]);
    }
  });

  it("pins the canonical owner's dotted name on parts that other namespaces reuse", () => {
    expect(displayNameOf(BarChart.Root)).toBe("Chart.Root");
    expect(displayNameOf(PieChart.Tooltip)).toBe("Chart.Tooltip");
    expect(displayNameOf(RadarChart.TableColumn)).toBe("Chart.TableColumn");
    expect(displayNameOf(RadialChart.Center)).toBe("PieChart.Center");
    expect(displayNameOf(RadialChart.Glow)).toBe("PieChart.Glow");
    expect(displayNameOf(RadialChart.Bar)).toBe("RadialChart.Bar");
    expect(displayNameOf(RadarChart.Glow)).toBe("RadarChart.Glow");
    expect(displayNameOf(Chart.Skeleton)).toBe("Chart.Skeleton");
    expect(displayNameOf(RadialChart.Skeleton)).toBe("RadialChart.Skeleton");
  });

  it("names every part after the first namespace, in owner order, that holds the same component", () => {
    const misnamed: string[] = [];
    for (const [name, namespace] of NAMESPACES) {
      for (const [key, part] of Object.entries(namespace)) {
        const owner = NAMESPACES.find(([, candidate]) => candidate[key] === part)?.[0];
        if (displayNameOf(part) !== `${owner ?? "?"}.${key}`) {
          misnamed.push(`${name}.${key}: ${displayNameOf(part) ?? "none"}`);
        }
      }
    }
    expect(misnamed).toEqual([]);
  });
});
