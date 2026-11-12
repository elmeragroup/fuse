// The polar data and composition rules in a development build. Units under test: the polar
// Roots, GaugeChart's Root and Skeleton, and a shared part inside them. Each case renders to a
// string and expects the thrown error's name and rule, written by hand from CONTRACT section 8.1's
// table and S10's polar rows.
import type { ReactElement } from "react";

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import { ClockChart } from "./clock-chart-namespace";
import { GaugeChart } from "./gauge-chart-namespace";
import { OTHER_KEY } from "./layout/pie";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";

/** The name and rule of what a render throws, or null when it renders. */
function thrown(element: ReactElement): { readonly name: string; readonly rule: string } | null {
  try {
    renderToString(<LocaleProvider locale="nb-NO">{element}</LocaleProvider>);
    return null;
  } catch (error) {
    if (!(error instanceof Error) || !("rule" in error)) throw error;
    return { name: error.name, rule: String(error.rule) };
  }
}

const data = (rule: string) => ({ name: "ChartDataError", rule });
const composition = (rule: string) => ({ name: "ChartCompositionError", rule });

const CONFIG = {
  strom: { label: "Strøm", color: "chart-1" },
  nettleie: { label: "Nettleie", color: "chart-2" },
} as const;

const ROWS = [
  { name: "strom", v: 60 },
  { name: "nettleie", v: 40 },
];

/** A clock's props over one Oslo day of hourly rows. */
const DIAL = {
  data: Array.from({ length: 24 }, (_, hour) => ({
    start: Date.parse("2025-10-24T22:00:00Z") + hour * 3_600_000,
    kwh: 1,
  })),
  config: { kwh: { label: "kWh", color: "chart-1" } },
  xKey: "start",
  cycle: "day",
  interval: "hour",
  timeZone: "Europe/Oslo",
  "aria-label": "Døgn",
} as const;

/** Five price areas, one past the radar's cap, as a config built at run time. */
const AREAS: ChartConfig = {
  no1: { label: "NO1", color: "chart-1" },
  no2: { label: "NO2", color: "chart-2" },
  no3: { label: "NO3", color: "chart-3" },
  no4: { label: "NO4", color: "chart-4" },
  no5: { label: "NO5", color: "chart-5" },
};

describe("the polar rules in development", () => {
  it.each([
    [
      "a negative pie reading",
      <PieChart.Root
        key="pie"
        data={[
          { name: "strom", v: 60 },
          { name: "nettleie", v: -1 },
        ]}
        config={CONFIG}
        nameKey="name"
        valueKey="v"
        aria-label="Regning"
      />,
      data("negative-polar-value"),
    ],
    [
      "a negative ring reading",
      <RadialChart.Root
        key="radial"
        data={[{ name: "strom", v: -5 }]}
        config={CONFIG}
        nameKey="name"
        valueKey="v"
        max={10}
        aria-label="Ringer"
      />,
      data("negative-polar-value"),
    ],
    [
      "a pie reading that is not a finite number (B9)",
      <PieChart.Root
        key="pie"
        data={[
          { name: "strom", v: Number.NaN },
          { name: "nettleie", v: 40 },
        ]}
        config={CONFIG}
        nameKey="name"
        valueKey="v"
        aria-label="Regning"
      />,
      data("non-finite-value"),
    ],
    [
      "a ring reading above 1e15 (B9)",
      <RadialChart.Root
        key="radial"
        data={[{ name: "strom", v: 2e15 }]}
        config={CONFIG}
        nameKey="name"
        valueKey="v"
        max={10}
        aria-label="Ringer"
      />,
      data("value-out-of-range"),
    ],
    [
      "two pie rows for one category (B4)",
      <PieChart.Root
        key="pie"
        data={[
          { name: "strom", v: 1 },
          { name: "strom", v: 2 },
        ]}
        config={CONFIG}
        nameKey="name"
        valueKey="v"
        aria-label="Regning"
      />,
      data("duplicate-x"),
    ],
    [
      "two ring rows for one category (B4)",
      <RadialChart.Root
        key="radial"
        data={[
          { name: "strom", v: 1 },
          { name: "strom", v: 2 },
        ]}
        config={CONFIG}
        nameKey="name"
        valueKey="v"
        max={10}
        aria-label="Ringer"
      />,
      data("duplicate-x"),
    ],
    [
      "a category the config lacks",
      <PieChart.Root
        key="pie"
        data={[...ROWS, { name: "fjernvarme", v: 5 }]}
        config={CONFIG}
        nameKey="name"
        valueKey="v"
        aria-label="Regning"
      />,
      data("unknown-category"),
    ],
    [
      "a fifth radar series",
      <RadarChart.Root
        key="radar"
        data={[{ season: "Vinter", no1: 1, no2: 2, no3: 3, no4: 4, no5: 5 }]}
        config={AREAS}
        nameKey="season"
        aria-label="Områder"
      />,
      data("radar-series-cap"),
    ],
    [
      "a Swatch that names the Other slice",
      <PieChart.Root key="pie" data={ROWS} config={CONFIG} nameKey="name" valueKey="v" aria-label="Regning">
        <PieChart.Swatch dataKey={OTHER_KEY} />
      </PieChart.Root>,
      composition("unknown-key"),
    ],
    ["a Table outside its Root", <PieChart.Table key="table" />, composition("part-outside-root")],
    [
      "a pie whose sweep ends at infinity",
      <PieChart.Root
        key="pie"
        data={ROWS}
        config={CONFIG}
        nameKey="name"
        valueKey="v"
        endAngle={Number.POSITIVE_INFINITY}
        aria-label="Regning"
      />,
      composition("invalid-sweep"),
    ],
    [
      "a radial chart whose sweep starts at NaN",
      <RadialChart.Root
        key="radial"
        data={ROWS}
        config={CONFIG}
        nameKey="name"
        valueKey="v"
        startAngle={Number.NaN}
        aria-label="Ringer"
      />,
      composition("invalid-sweep"),
    ],
    [
      "a gauge whose sweep ends at infinity",
      <GaugeChart.Root
        key="gauge"
        value={2}
        max={5}
        endAngle={Number.POSITIVE_INFINITY}
        aria-label="Måler"
      />,
      composition("invalid-sweep"),
    ],
    [
      "a gauge skeleton whose sweep starts at minus infinity",
      <GaugeChart.Skeleton key="skeleton" startAngle={Number.NEGATIVE_INFINITY} />,
      composition("invalid-sweep"),
    ],
    [
      "a gauge whose max is not above its min",
      <GaugeChart.Root key="gauge" value={2} min={5} max={5} aria-label="Måler" />,
      composition("invalid-gauge-domain"),
    ],
    ["a gauge part outside its Root", <GaugeChart.Needle key="needle" />, composition("part-outside-root")],
    [
      "a clock with no time zone",
      <ClockChart.Root key="clock" {...DIAL} timeZone={undefined} />,
      composition("time-axis-without-zone"),
    ],
    [
      "a clock interval coarser than its cycle",
      // SAFETY: the cast stands for a widened prop, which the type check would reject as a literal.
      <ClockChart.Root key="clock" {...DIAL} cycle="day" interval={"day" as "hour"} />,
      composition("interval-not-nested"),
    ],
    [
      "a clock row outside its period",
      <ClockChart.Root
        key="clock"
        {...DIAL}
        data={[...DIAL.data, { start: Date.parse("2025-10-25T22:00:00Z"), kwh: 1 }]}
        period={[Date.parse("2025-10-24T22:00:00Z"), Date.parse("2025-10-25T22:00:00Z")]}
      />,
      data("row-outside-period"),
    ],
    [
      "a clock line painted by a threshold on a stack",
      <ClockChart.Root
        key="clock"
        {...DIAL}
        data={DIAL.data.map((row) => ({ ...row, top: 1 }))}
        config={{
          kwh: {
            label: "kWh",
            stack: "s",
            color: {
              threshold: 1,
              below: { color: "chart-sentiment-positive", label: "Lav" },
              above: { color: "chart-sentiment-negative", label: "Høy" },
            },
          },
          top: { label: "Topp", color: "chart-sentiment-positive", stack: "s" },
        }}>
        <ClockChart.Line dataKey="kwh" />
      </ClockChart.Root>,
      composition("scale-colour-on-stack"),
    ],
    [
      "a clock ValueLabel outside its Marker",
      <ClockChart.Root key="clock" {...DIAL}>
        <ClockChart.ValueLabel />
      </ClockChart.Root>,
      composition("part-outside-root"),
    ],
    [
      "a clock Marker at an x string",
      <ClockChart.Root key="clock" {...DIAL}>
        <ClockChart.Marker dataKey="kwh" at={{ x: "2025-10-25" }} />
      </ClockChart.Root>,
      composition("x-type-mismatch"),
    ],
    // A Column's wedge and an Area's band encode their value as the length from 0, which a
    // yBaseline="none" domain cuts off at the hole, as the cartesian Bar and Area rule says.
    [
      'a clock Column under yBaseline="none"',
      <ClockChart.Root key="clock" {...DIAL} yBaseline="none">
        <ClockChart.Column dataKey="kwh" />
      </ClockChart.Root>,
      composition("baseline-required"),
    ],
    [
      'a clock Area under yBaseline="none"',
      <ClockChart.Root key="clock" {...DIAL} yBaseline="none">
        <ClockChart.Area dataKey="kwh" />
      </ClockChart.Root>,
      composition("baseline-required"),
    ],
    [
      "a pie Table inside a radar",
      <RadarChart.Root key="radar" data={[]} config={{}} nameKey="season" aria-label="Områder">
        <PieChart.Table />
      </RadarChart.Root>,
      composition("part-outside-root"),
    ],
  ])("throws for %s", (_, element, expected) => {
    expect(thrown(element)).toEqual(expected);
  });

  it('draws a clock Line under yBaseline="none", which encodes its value by position', () => {
    expect(
      thrown(
        <ClockChart.Root {...DIAL} yBaseline="none">
          <ClockChart.Line dataKey="kwh" />
        </ClockChart.Root>
      )
    ).toBeNull();
  });

  it("renders a pie whose rows all keep the rules, on the server and in the browser", () => {
    const pie = (
      <PieChart.Root data={ROWS} config={CONFIG} nameKey="name" valueKey="v" aria-label="Regning" />
    );
    expect(thrown(pie)).toBeNull();
    renderThemed(<LocaleProvider locale="nb-NO">{pie}</LocaleProvider>);
    expect(page.getByRole("figure", { name: "Regning" }).elements()).toHaveLength(1);
  });
});
