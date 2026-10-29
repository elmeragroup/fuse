/// <reference types="vite/client" />
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

/**
 * Every chart module that declares a part, keyed by its path. The glob reads the folder, so a new
 * part module joins the cross-checks the moment it exists.
 */
const MODULES = Object.entries(
  import.meta.glob<Readonly<Record<string, Part>>>(["./*.tsx", "!./*.test.tsx", "!./*.test-d.tsx"], {
    eager: true,
  })
);

/** The file that declares each part, read from the modules' own exports. */
const declaringFile = new Map<Part, string>();
for (const [file, exports] of MODULES) {
  for (const value of Object.values(exports)) {
    declaringFile.set(value, file);
  }
}

function fileOf(part: Part): string {
  const file = declaringFile.get(part);
  if (file === undefined) {
    throw new Error(`no chart module exports ${displayNameOf(part) ?? "an unnamed part"}`);
  }
  return file;
}

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

  // Unit under test: the file layout that the docs `sameAs` rule depends on.
  // Oracle: the namespace objects. Two members under one key are one component exactly when their
  // declaring files match.
  it("makes two members under one key the same component exactly when one file declares both", () => {
    const disagreements: string[] = [];
    for (const [leftName, left] of NAMESPACES) {
      for (const [rightName, right] of NAMESPACES) {
        if (leftName >= rightName) continue;
        for (const key of Object.keys(left).filter((candidate) => Object.hasOwn(right, candidate))) {
          const leftPart = left[key];
          const rightPart = right[key];
          if (leftPart === undefined || rightPart === undefined) continue;
          if ((leftPart === rightPart) !== (fileOf(leftPart) === fileOf(rightPart))) {
            disagreements.push(`${leftName}.${key} and ${rightName}.${key}`);
          }
        }
      }
    }
    expect(disagreements).toEqual([]);
  });

  it("keeps every part of one file in the same set of namespaces, so a shared file holds no family part", () => {
    const mixed: string[] = [];
    for (const [file, exports] of MODULES) {
      const memberships = new Set(
        Object.values(exports)
          .filter((value) => declaringFile.get(value) === file)
          .map((value) =>
            NAMESPACES.filter(([, namespace]) => Object.values(namespace).some((member) => member === value))
              .map(([name]) => name)
              .join(",")
          )
          .filter((membership) => membership !== "")
      );
      if (memberships.size > 1) mixed.push(`${file}: ${[...memberships].join(" | ")}`);
    }
    expect(MODULES.map(([file]) => file)).toContain("./pie-chart-center.tsx");
    expect(mixed).toEqual([]);
  });
});
