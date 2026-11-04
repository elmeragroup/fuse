/**
 * ScatterChart's public type constraints. The TypeScript checker is the oracle: each positive case
 * compiles with no cast, and each `@ts-expect-error` marks a call the API must reject.
 */
import type { ReactElement } from "react";

import { expectTypeOf, test } from "vitest";

import { ScatterChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig, ScatterChartReferenceLineProps } from "@elmeragroup/fuse/chart";

type Week = {
  readonly tempC: number;
  readonly kwh: number | null;
  readonly series: string;
  readonly week: string;
};

const weeks: readonly Week[] = [
  { tempC: -0.8, kwh: 146_500, series: "2026", week: "1" },
  { tempC: -1, kwh: 151_800, series: "normal", week: "1" },
];

const config = {
  "2026": { label: "Forbruk 2026", color: "chart-1" },
  normal: { label: "Normalforbruk", color: "chart-2", format: { preset: "energy", unit: "kWh" } },
} as const satisfies ChartConfig;

test("the energy-signature composition compiles with no cast", () => {
  const chart: ReactElement = (
    <ScatterChart.Root
      data={weeks}
      config={config}
      xKey="tempC"
      yKey="kwh"
      seriesKey="series"
      xFormat={{ style: "unit", unit: "celsius" }}
      valueFormat={{ preset: "energy", unit: "kWh" }}
      xLabel="Ukemiddeltemperatur"
      yLabel="Ukeforbruk"
      aria-label="Ukeforbruk mot temperatur">
      <ScatterChart.Grid orientation="both" />
      <ScatterChart.XAxis label="Ukemiddeltemperatur (°C)" />
      <ScatterChart.YAxis label="kWh per uke" format={{ maximumFractionDigits: 0 }} />
      <ScatterChart.Points dataKey="2026" size="lg" />
      <ScatterChart.Line dataKey="normal" curve="linear" />
      <ScatterChart.ReferenceLine x={0} />
      <ScatterChart.ReferenceLine from={[-1, 152_000]} to={[17.4, 58_000]} variant="dashed" />
      <ScatterChart.ActiveDot />
      <ScatterChart.Tooltip />
      <ScatterChart.Legend />
      <ScatterChart.Table />
    </ScatterChart.Root>
  );
  expectTypeOf(chart).toEqualTypeOf<ReactElement>();
});

test("the x and y keys must name number columns, and the series key a string column", () => {
  // @ts-expect-error -- `week` is a string column, so it cannot be the x axis.
  <ScatterChart.Root data={weeks} config={config} xKey="week" yKey="kwh" seriesKey="series" aria-label="x" />;
  // @ts-expect-error -- `tempC` is a number column, so it cannot name the series.
  <ScatterChart.Root data={weeks} config={config} xKey="tempC" yKey="kwh" seriesKey="tempC" aria-label="x" />;
});

test("scatter config takes no slot fields and no scale or role list", () => {
  const stacked = { a: { label: "A", color: "chart-1", stack: "s" } } as const satisfies ChartConfig;
  const scaled = { a: { label: "A", color: "chart-seq" } } as const satisfies ChartConfig;
  const listed = { a: { label: "A", color: ["chart-1", "chart-2"] } } as const satisfies ChartConfig;
  <ScatterChart.Root
    data={weeks}
    // @ts-expect-error -- a stack needs slots.
    config={stacked}
    xKey="tempC"
    yKey="kwh"
    seriesKey="series"
    aria-label="x"
  />;
  <ScatterChart.Root
    data={weeks}
    // @ts-expect-error -- a scale would colour by y, which the y axis shows already.
    config={scaled}
    xKey="tempC"
    yKey="kwh"
    seriesKey="series"
    aria-label="x"
  />;
  <ScatterChart.Root
    data={weeks}
    // @ts-expect-error -- a role list runs along a category axis, which a scatter chart lacks.
    config={listed}
    xKey="tempC"
    yKey="kwh"
    seriesKey="series"
    aria-label="x"
  />;
});

test("a reference line takes exactly one of y, x or a from-to segment", () => {
  expectTypeOf<{ y: number }>().toExtend<ScatterChartReferenceLineProps>();
  expectTypeOf<{ x: number }>().toExtend<ScatterChartReferenceLineProps>();
  expectTypeOf<{ from: [number, number]; to: [number, number] }>().toExtend<ScatterChartReferenceLineProps>();
  expectTypeOf<{ x: number; y: number }>().not.toExtend<ScatterChartReferenceLineProps>();
  expectTypeOf<{ from: [number, number] }>().not.toExtend<ScatterChartReferenceLineProps>();
});

test("sizes and looks are named steps", () => {
  // @ts-expect-error -- a size is a named step, never pixels.
  <ScatterChart.Points dataKey="2026" size={12} />;
  // @ts-expect-error -- "faded" is no look.
  <ScatterChart.Points dataKey="2026" variant="faded" />;
  // @ts-expect-error -- "monotone-y" has no meaning over an x-sorted series.
  <ScatterChart.Line dataKey="normal" curve="monotone-y" />;
});
