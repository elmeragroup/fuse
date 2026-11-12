/**
 * LiveLineChart's public type constraints. The TypeScript checker is the oracle: each positive case
 * compiles with no cast, and each `@ts-expect-error` marks a prop the API must reject.
 */
import { test } from "vitest";

import { LiveLineChart } from "@elmeragroup/fuse/chart";
import type { LiveLineChartCurve } from "@elmeragroup/fuse/chart";

const readings = [{ time: Date.UTC(2026, 9, 16, 12), value: 1.2 }];

test("a reading's time prints in a time preset or Intl options", () => {
  <LiveLineChart.Root data={readings} timeFormat="time" aria-label="x">
    <LiveLineChart.XAxis format={{ hour: "2-digit", minute: "2-digit" }} />
  </LiveLineChart.Root>;
});

test("a range preset, which names a span a reading has none of, is no time format", () => {
  // @ts-expect-error -- "time-range" needs a slot of a minute or more, and a reading is an instant.
  <LiveLineChart.Root data={readings} timeFormat="time-range" aria-label="x" />;
  // @ts-expect-error -- "hour-range" needs an hour's slot, and a tick is an instant.
  <LiveLineChart.XAxis format="hour-range" />;
});

test("the Line and the Area take only curves that stay between their readings", () => {
  const curves = [
    "monotone",
    "linear",
    "step",
    "step-before",
    "step-after",
    "bump",
    "basis",
  ] as const satisfies readonly LiveLineChartCurve[];
  <LiveLineChart.Root data={readings} aria-label="x">
    {curves.map((curve) => (
      <LiveLineChart.Line key={curve} curve={curve} />
    ))}
    <LiveLineChart.Area curve="basis" />
  </LiveLineChart.Root>;
  // @ts-expect-error -- a natural spline overshoots its readings, past the domain that holds them.
  <LiveLineChart.Line curve="natural" />;
  // @ts-expect-error -- the Area draws the Line's curve, and natural is none of them.
  <LiveLineChart.Area curve="natural" />;
});
