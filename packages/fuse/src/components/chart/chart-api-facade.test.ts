// Unit under test: test/chart/api-facade.ts, the plain objects the docs API extractor reads in place
// of the chart entry's ES module namespaces. Oracle: the namespaces of src/chart.ts, which the facade
// must reproduce key for key and component for component, so the docs never describe a part the
// entry lacks.
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";

import * as facade from "../../../test/chart/api-facade";
import * as entry from "../../chart";

/** A chart part, which every namespace member is. */
type Part = (props: never) => ReactElement;

/** Each namespace beside its facade copy. */
const PAIRS: ReadonlyArray<
  readonly [string, Readonly<Record<string, Part>>, Readonly<Record<string, Part>>]
> = [
  ["Chart", entry.Chart, facade.Chart],
  ["AreaChart", entry.AreaChart, facade.AreaChart],
  ["BarChart", entry.BarChart, facade.BarChart],
  ["LineChart", entry.LineChart, facade.LineChart],
  ["PieChart", entry.PieChart, facade.PieChart],
  ["RadialChart", entry.RadialChart, facade.RadialChart],
  ["RadarChart", entry.RadarChart, facade.RadarChart],
];

describe("the docs API facade", () => {
  it.each(PAIRS)("holds %s's parts under the same keys", (_, namespace, copy) => {
    expect(Object.keys(copy).sort()).toEqual(Object.keys(namespace).sort());
    for (const [key, part] of Object.entries(copy)) expect(part, key).toBe(namespace[key]);
  });

  it("passes the entry's other runtime exports through", () => {
    expect(facade.Sparkline).toBe(entry.Sparkline);
    expect(facade.useChartPoint).toBe(entry.useChartPoint);
    expect(facade.formatChartValue).toBe(entry.formatChartValue);
    expect(facade.formatChartSlot).toBe(entry.formatChartSlot);
  });
});
