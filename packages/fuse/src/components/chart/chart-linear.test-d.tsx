/**
 * The public type constraints of `xScale="linear"` (issue #515). The TypeScript checker is the
 * oracle. Each `@ts-expect-error` line must fail, and an unused one fails the file. Each case fits
 * on one formatted line, because a directive covers only the line below it, so the data and
 * configs are hoisted.
 */
import type { ReactElement } from "react";

import { expectTypeOf, test } from "vitest";

import { Chart, LineChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig, ChartPoint, ChartRootProps, ChartRow } from "@elmeragroup/fuse/chart";

const curve = [{ soc: 0, kw: 50, at: new Date(0), name: "a" }];
const kw = { kw: { label: "Ladeeffekt", color: "chart-1" } } as const satisfies ChartConfig;
/** A number-column chart's props, so each case adds only the prop it tests. */
const linear = { data: curve, config: kw, xKey: "soc", xScale: "linear", "aria-label": "x" } as const;
const percent = { style: "unit", unit: "percent" } as const;

test("a number column takes xScale=linear with a value format, an x name and x includes", () => {
  const chart = (
    <LineChart.Root {...linear} xFormat={percent} xLabel="Ladenivå" xInclude={[0, 100]} xRange={[0, 50]}>
      <LineChart.Line dataKey="kw" curve="step-after" />
    </LineChart.Root>
  );
  expectTypeOf(chart).toExtend<ReactElement>();
  // A number column without xScale="linear" is still a time axis, which needs interval.
  const time = (
    <Chart.Root data={curve} config={kw} xKey="soc" interval="hour" timeZone="UTC" aria-label="x" />
  );
  expectTypeOf(time).toExtend<ReactElement>();
});

test("xScale=linear forbids the time-axis props, a time format and the horizontal orientation", () => {
  // @ts-expect-error A linear axis has no interval.
  void (<Chart.Root {...linear} interval="hour" />);
  // @ts-expect-error A linear axis has no time zone.
  void (<Chart.Root {...linear} timeZone="Europe/Oslo" />);
  // @ts-expect-error A linear axis has no now.
  void (<Chart.Root {...linear} now={0} />);
  // @ts-expect-error A linear axis has no period.
  void (<Chart.Root {...linear} period={[0, 1]} />);
  // @ts-expect-error A linear axis prints numbers, so a time preset is no format.
  void (<Chart.Root {...linear} xFormat="hour" />);
  // @ts-expect-error A linear axis runs along the bottom.
  void (<Chart.Root {...linear} orientation="horizontal" />);
  // @ts-expect-error A linear range names x numbers.
  void (<Chart.Root {...linear} xRange={[new Date(0), new Date(1)]} />);
});

test("only a number column takes xScale=linear, and only a linear axis takes xLabel and xInclude", () => {
  // @ts-expect-error A Date column is a time axis.
  void (<Chart.Root data={curve} config={kw} xKey="at" xScale="linear" aria-label="x" />);
  // @ts-expect-error A string column is a category axis.
  void (<Chart.Root data={curve} config={kw} xKey="name" xScale="linear" aria-label="x" />);
  // @ts-expect-error A category axis names no x measure.
  void (<Chart.Root data={curve} config={kw} xKey="name" xLabel="Ladenivå" aria-label="x" />);
  // @ts-expect-error A category axis has no x domain to reach.
  void (<Chart.Root data={curve} config={kw} xKey="name" xInclude={[0]} aria-label="x" />);
});

test("a point reports a linear slot's x as its number", () => {
  expectTypeOf<number>().toExtend<ChartPoint["x"]>();
});

test("a wrapper typed for a linear axis names its chart itself and forwards the rest", () => {
  function ChargingCurve(
    props: Omit<ChartRootProps<ChartRow, ChartConfig, string, "linear">, "aria-label" | "aria-labelledby">
  ) {
    return <Chart.Root aria-label="Ladekurve" {...props} />;
  }
  expectTypeOf(
    <ChargingCurve data={curve} config={kw} xKey="soc" xScale="linear" xLabel="Ladenivå" />
  ).toExtend<ReactElement>();
  // @ts-expect-error A linear axis has no interval.
  void (<ChargingCurve data={curve} config={kw} xKey="soc" xScale="linear" interval="hour" />);
});
