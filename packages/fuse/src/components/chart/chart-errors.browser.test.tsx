// CONTRACT section 8.1's error tiers in a development build, for every rule layer 05 reaches. Each
// case renders to a string and expects the thrown error's name and rule, both written by hand from
// the section's table.
import type { ReactElement } from "react";

import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaughtError, caughtError } from "../../../test/caught-error";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";

const OSLO = "Europe/Oslo";
/** 1 to 3 October 2025 at Oslo midnight, summer time. */
const DAYS = [1, 2, 3].map((date) => ({ day: new Date(Date.UTC(2025, 9, date, -2)), kwh: date }));
const CONFIG = { kwh: { label: "Forbruk", color: "chart-1" } } as const satisfies ChartConfig;

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

function daily(
  children: ReactElement,
  rows: readonly object[] = DAYS,
  config: ChartConfig = CONFIG
): ReactElement {
  return (
    // SAFETY: each case passes rows that hold the config's keys, or breaks them on purpose.
    <Chart.Root
      data={rows as typeof DAYS}
      config={config as typeof CONFIG}
      xKey="day"
      interval="day"
      timeZone={OSLO}
      aria-label="Forbruk">
      {children}
    </Chart.Root>
  );
}

const composition = (rule: string) => ({ name: "ChartCompositionError", rule });
/**
 * A threshold colour split at 2, which every threshold case paints with. Its roles are categorical,
 * so it shares a layout with the categorical series and breaks no colour-family rule.
 */
const SPLIT = {
  threshold: 2,
  below: { color: "chart-3", label: "Lav" },
  above: { color: "chart-4", label: "Høy" },
} as const;
const data = (rule: string) => ({ name: "ChartDataError", rule });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("composition errors", () => {
  it.each([
    ["a Bar outside Root", <Chart.Bar key="bar" dataKey="kwh" />, composition("part-outside-root")],
    ["an unknown Bar key", daily(<Chart.Bar dataKey="pris" />), composition("unknown-key")],
    [
      "an unknown BarGroup key",
      daily(
        <Chart.BarGroup series={["kwh", "pris"]}>
          <Chart.Bar dataKey="kwh" />
        </Chart.BarGroup>
      ),
      composition("unknown-key"),
    ],
    // q15 and s19: an explicit readout key must name a config key too.
    ["an unknown Swatch key", daily(<Chart.Swatch dataKey="typo" />), composition("unknown-key")],
    ["an unknown SeriesLabel key", daily(<Chart.SeriesLabel dataKey="typo" />), composition("unknown-key")],
    ["an unknown SeriesIcon key", daily(<Chart.SeriesIcon dataKey="typo" />), composition("unknown-key")],
    ["an unknown LegendValue key", daily(<Chart.LegendValue dataKey="typo" />), composition("unknown-key")],
    ["an unknown LegendShare key", daily(<Chart.LegendShare dataKey="typo" />), composition("unknown-key")],
    [
      "a config key no row holds",
      daily(<Chart.Bar dataKey="pris" />, DAYS, { pris: { label: "Pris", color: "chart-1" } }),
      composition("unknown-key"),
    ],
    [
      "a string x on a time axis",
      daily(<Chart.ReferenceLine x="2025-10-02" />),
      composition("x-type-mismatch"),
    ],
    [
      "a string emphasis on a time axis",
      daily(<Chart.Bar dataKey="kwh" emphasis={{ x: "2025-10-02" }} />),
      composition("x-type-mismatch"),
    ],
    [
      "a string projectedFrom on a time axis",
      daily(<Chart.Bar dataKey="kwh" />, DAYS, {
        kwh: { label: "Forbruk", color: "chart-1", projectedFrom: "2025-10-02" },
      }),
      composition("x-type-mismatch"),
    ],
    [
      "a time axis with no zone",
      <Chart.Root key="root" data={DAYS} config={CONFIG} xKey="day" interval="day" aria-label="Forbruk">
        <Chart.Bar dataKey="kwh" />
      </Chart.Root>,
      composition("time-axis-without-zone"),
    ],
    [
      "a Bar in a layout without the zero baseline",
      <Chart.Root
        key="root"
        data={DAYS}
        config={CONFIG}
        xKey="day"
        interval="day"
        timeZone={OSLO}
        yBaseline="none"
        aria-label="Forbruk">
        <Chart.Bar dataKey="kwh" />
      </Chart.Root>,
      composition("baseline-required"),
    ],
    [
      "a Bar on a point scale",
      <Chart.Root
        key="root"
        data={DAYS}
        config={CONFIG}
        xKey="day"
        interval="day"
        timeZone={OSLO}
        xScale="point"
        aria-label="Forbruk">
        <Chart.Bar dataKey="kwh" />
      </Chart.Root>,
      composition("bar-needs-band"),
    ],
    [
      "an Area in a layout without the zero baseline",
      <Chart.Root
        key="root"
        data={DAYS}
        config={CONFIG}
        xKey="day"
        interval="day"
        timeZone={OSLO}
        yBaseline="none"
        aria-label="Forbruk">
        <Chart.Area dataKey="kwh" />
      </Chart.Root>,
      composition("baseline-required"),
    ],
    [
      "a step-after Line on a point scale",
      <Chart.Root
        key="root"
        data={DAYS}
        config={CONFIG}
        xKey="day"
        interval="day"
        timeZone={OSLO}
        xScale="point"
        aria-label="Forbruk">
        <Chart.Line dataKey="kwh" curve="step-after" />
      </Chart.Root>,
      composition("step-curve-needs-cells"),
    ],
    [
      "a step-before Area on a point scale",
      <Chart.Root
        key="root"
        data={DAYS}
        config={CONFIG}
        xKey="day"
        interval="day"
        timeZone={OSLO}
        xScale="point"
        aria-label="Forbruk">
        <Chart.Area dataKey="kwh" curve="step-before" />
      </Chart.Root>,
      composition("step-curve-needs-cells"),
    ],
    ["an unknown Line key", daily(<Chart.Line dataKey="typo" />), composition("unknown-key")],
    ["an unknown Marker key", daily(<Chart.Marker dataKey="typo" at="last" />), composition("unknown-key")],
    [
      "a BarGroup inside a BarGroup",
      daily(
        <Chart.BarGroup series={["kwh"]}>
          <Chart.BarGroup series={["kwh"]}>
            <Chart.Bar dataKey="kwh" />
          </Chart.BarGroup>
        </Chart.BarGroup>
      ),
      composition("nested-bar-group"),
    ],
    [
      "a Bar its group does not list",
      daily(
        <Chart.BarGroup series={["kwh"]}>
          <Chart.Bar dataKey="kost" />
        </Chart.BarGroup>,
        DAYS.map((row) => ({ ...row, kost: 1 })),
        { kwh: { label: "Forbruk", color: "chart-1" }, kost: { label: "Kostnad", color: "chart-2" } }
      ),
      composition("bar-not-in-group"),
    ],
    [
      "a sentiment role beside a categorical role",
      daily(
        <Chart.Bar dataKey="kwh" />,
        DAYS.map((row) => ({ ...row, kost: 1 })),
        {
          kwh: { label: "Forbruk", color: "chart-sentiment-positive" },
          kost: { label: "Kostnad", color: "chart-2" },
        }
      ),
      composition("mixed-sentiment-categorical"),
    ],
  ])("throws for %s", (_, element, expected) => {
    expect(thrown(element)).toEqual(expected);
  });
});

describe("data errors in development", () => {
  const at = (date: number, hour = -2) => new Date(Date.UTC(2025, 9, date, hour));
  it.each([
    ["a NaN value", [{ day: at(1), kwh: Number.NaN }], "non-finite-value"],
    ["a value above 1e15", [{ day: at(1), kwh: 2e15 }], "value-out-of-range"],
    ["an invalid date", [{ day: new Date(Number.NaN), kwh: 1 }], "invalid-x"],
    ["a UTC midnight on an Oslo day", [{ day: new Date(Date.UTC(2025, 9, 1)), kwh: 1 }], "off-grid-x"],
    [
      "two rows for one day",
      [
        { day: at(1), kwh: 1 },
        { day: at(1), kwh: 2 },
      ],
      "duplicate-x",
    ],
    ["an estimate with no value", [{ day: at(1), kwh: null, q: "estimated" }], "quality-without-value"],
    ["an Elhub quality code", [{ day: at(1), kwh: 1, q: "E01" }], "invalid-quality"],
  ] as const)("throws for %s", (_, rows, rule) => {
    const config = { kwh: { label: "Forbruk", color: "chart-1", qualityKey: "q" } } as const;
    expect(thrown(daily(<Chart.Bar dataKey="kwh" />, rows, config))).toEqual(data(rule));
  });

  it("throws off-grid-x for an hourly value on a :15 row", () => {
    // Section 8.8: an hourly series reads only the :00 rows, so 0,4 on 00:15 is off its grid.
    const quarters = [
      { start: new Date(Date.UTC(2025, 8, 30, 22, 0)), price: 1 },
      { start: new Date(Date.UTC(2025, 8, 30, 22, 15)), price: 1, kwh: 0.4 },
    ];
    const element = (
      <Chart.Root
        data={quarters}
        config={{
          price: { label: "Pris", color: "chart-1" },
          kwh: { label: "Forbruk", color: "chart-2", interval: "hour" },
        }}
        xKey="start"
        interval="quarter-hour"
        timeZone={OSLO}
        aria-label="Pris og forbruk">
        <Chart.Bar dataKey="kwh" />
      </Chart.Root>
    );
    expect(thrown(element)).toEqual(data("off-grid-x"));
  });

  it("throws for a row outside the period", () => {
    const element = (
      <Chart.Root
        data={[{ day: new Date(Date.UTC(2025, 10, 5, -1)), kwh: 1 }]}
        config={CONFIG}
        xKey="day"
        interval="day"
        timeZone={OSLO}
        period={[new Date(Date.UTC(2025, 9, 1, -2)), new Date(Date.UTC(2025, 10, 1, -1))]}
        aria-label="Forbruk">
        <Chart.Bar dataKey="kwh" />
      </Chart.Root>
    );
    expect(thrown(element)).toEqual(data("row-outside-period"));
  });

  it("throws for a mixed-sign stack under expand", () => {
    const element = (
      <Chart.Root
        data={[{ day: DAYS[0]?.day ?? new Date(0), a: 3, b: -1 }]}
        config={{
          a: { label: "A", color: "chart-1", stack: "s" },
          b: { label: "B", color: "chart-2", stack: "s" },
        }}
        xKey="day"
        interval="day"
        timeZone={OSLO}
        stackOffset="expand"
        aria-label="Andel">
        <Chart.Bar dataKey="a" />
      </Chart.Root>
    );
    expect(thrown(element)).toEqual(data("mixed-sign-expand"));
  });

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("throws non-finite-threshold for a threshold of %s", (_, threshold) => {
    const config = { kwh: { label: "Forbruk", color: { ...SPLIT, threshold } } };
    expect(thrown(daily(<Chart.Line dataKey="kwh" />, DAYS, config))).toEqual(data("non-finite-threshold"));
  });

  it("throws for a time preset on number cells of a TableColumn", () => {
    const rows = DAYS.map((row) => ({ ...row, change: 0.1 }));
    expect(
      thrown(
        daily(
          <Chart.Table>
            <Chart.TableColumn dataKey="change" header="Endring" format="hour" />
          </Chart.Table>,
          rows
        )
      )
    ).toEqual(data("table-column-format"));
  });
});

describe("one part of a kind per series, after registration", () => {
  /** Each part on the same key, under an error boundary. */
  function drawn(children: ReactElement): ReactElement {
    return (
      <LocaleProvider locale="nb-NO">
        <CaughtError>{daily(children)}</CaughtError>
      </LocaleProvider>
    );
  }

  // Each message is the rule's own, written by hand.
  it.each([
    [
      "two Lines",
      <>
        <Chart.Line dataKey="kwh" />
        <Chart.Line dataKey="kwh" />
      </>,
      'Chart.Line draws "kwh", which another Chart.Line in this Chart.Root draws too',
    ],
    [
      "two Areas",
      <>
        <Chart.Area dataKey="kwh" />
        <Chart.Area dataKey="kwh" />
      </>,
      'Chart.Area draws "kwh", which another Chart.Area in this Chart.Root draws too',
    ],
    [
      "two Bars",
      <>
        <Chart.Bar dataKey="kwh" />
        <Chart.Bar dataKey="kwh" />
      </>,
      'Chart.Bar draws "kwh", which another Chart.Bar in this Chart.Root draws too',
    ],
  ])("throws series-drawn-twice for %s on one key once they mount", (_, children, message) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderThemed(drawn(children));
    expect(caughtError().name).toBe("ChartCompositionError");
    expect(caughtError().message).toContain(message);
  });

  it("renders a Bar, an Area and a Line on one key, and a Line that replaces another", () => {
    const { rerender } = renderThemed(
      drawn(
        <>
          <Chart.Bar dataKey="kwh" />
          <Chart.Area dataKey="kwh" />
          <Chart.Line key="first" dataKey="kwh" />
        </>
      )
    );
    rerender(
      drawn(
        <>
          <Chart.Bar dataKey="kwh" />
          <Chart.Area dataKey="kwh" />
          <Chart.Line key="second" dataKey="kwh" />
        </>
      )
    );
    expect(caughtError()).toEqual({ name: null, message: null });
  });
});
