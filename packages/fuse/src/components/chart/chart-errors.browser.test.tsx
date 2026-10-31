// CONTRACT section 8.1's error tiers in a development build, for every rule layer 05 reaches. Each
// case renders to a string and expects the thrown error's name and rule, both written by hand from
// the section's table. The production fallbacks run in chart-errors.production.browser.test.
import type { ReactElement } from "react";

import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("Panel and resolution errors on the first render", () => {
  const TWO = {
    kwh: { label: "Forbruk", color: "chart-1" },
    kost: { label: "Kostnad", color: "chart-2" },
  } as const satisfies ChartConfig;
  const twoRows = DAYS.map((row) => ({ ...row, kost: 1 }));
  const STACKED = {
    kwh: { label: "Forbruk", color: "chart-1", stack: "sum" },
    kost: { label: "Kostnad", color: "chart-2", stack: "sum" },
  } as const satisfies ChartConfig;
  it.each([
    [
      "a Panel inside a Panel",
      daily(
        <Chart.Panel series={["kwh"]}>
          <Chart.Panel series={["kwh"]} />
        </Chart.Panel>
      ),
      composition("nested-panel"),
    ],
    [
      "a Panel under horizontal bars",
      <Chart.Root
        key="root"
        data={[{ name: "a", v: 1 }]}
        config={{ v: { label: "V", color: "chart-1" } }}
        xKey="name"
        orientation="horizontal"
        aria-label="Liggende">
        <Chart.Panel series={["v"]} />
      </Chart.Root>,
      composition("horizontal-panels"),
    ],
    [
      "a Panel series that names no config key",
      daily(<Chart.Panel series={["pris"]} />),
      composition("unknown-key"),
    ],
    [
      "a Bar its Panel does not list",
      daily(
        <>
          <Chart.Panel series={["kwh"]}>
            <Chart.Bar dataKey="kost" />
          </Chart.Panel>
          <Chart.Panel series={["kost"]} />
        </>,
        twoRows,
        TWO
      ),
      composition("series-not-in-panel"),
    ],
    [
      "a Line its Panel does not list",
      daily(
        <Chart.Panel series={["kwh"]}>
          <Chart.Line dataKey="kost" />
        </Chart.Panel>,
        twoRows,
        TWO
      ),
      composition("series-not-in-panel"),
    ],
    [
      "a Bar in a Panel whose baseline is none",
      daily(
        <Chart.Panel series={["kwh"]} yBaseline="none">
          <Chart.Bar dataKey="kwh" />
        </Chart.Panel>
      ),
      composition("baseline-required"),
    ],
    [
      // Section 8.8: an hour does not hold whole days.
      "a series interval finer than Root's",
      daily(<Chart.Bar dataKey="kwh" />, DAYS, {
        kwh: { label: "Forbruk", color: "chart-1", interval: "hour" },
      }),
      composition("interval-not-nested"),
    ],
    [
      // Section 8.8: an ISO week crosses month boundaries, so it nests in no month.
      "a week series on Root's month",
      <Chart.Root
        key="root"
        data={DAYS}
        config={{ kwh: { label: "Forbruk", color: "chart-1", interval: "month" } }}
        xKey="day"
        interval="week"
        timeZone={OSLO}
        aria-label="Forbruk">
        <Chart.Bar dataKey="kwh" />
      </Chart.Root>,
      composition("interval-not-nested"),
    ],
    [
      "a series interval on a category axis",
      <Chart.Root
        key="root"
        data={[{ name: "a", v: 1 }]}
        config={{ v: { label: "V", color: "chart-1", interval: "day" } }}
        xKey="name"
        aria-label="Kategori">
        <Chart.Bar dataKey="v" />
      </Chart.Root>,
      composition("interval-not-nested"),
    ],
    [
      "a stack split over two Panels",
      daily(
        <>
          <Chart.Panel series={["kwh"]} />
          <Chart.Panel series={["kost"]} />
        </>,
        twoRows,
        STACKED
      ),
      composition("stack-across-panels"),
    ],
    [
      "a scale-coloured Line in a stack",
      daily(<Chart.Line dataKey="kwh" />, twoRows, {
        ...STACKED,
        kwh: { ...STACKED.kwh, color: "chart-seq" },
      }),
      composition("scale-colour-on-stack"),
    ],
    [
      "a scale-coloured Area in a stack",
      daily(<Chart.Area dataKey="kost" />, twoRows, {
        ...STACKED,
        kost: { ...STACKED.kost, color: "chart-diverging" },
      }),
      composition("scale-colour-on-stack"),
    ],
    [
      "a scale-coloured Area under the expand offset",
      <Chart.Root
        key="root"
        data={DAYS}
        config={{ kwh: { label: "Forbruk", color: "chart-seq" } }}
        xKey="day"
        interval="day"
        timeZone={OSLO}
        stackOffset="expand"
        aria-label="Forbruk">
        <Chart.Area dataKey="kwh" />
      </Chart.Root>,
      composition("scale-colour-on-stack"),
    ],
  ])("throws for %s", (_, element, expected) => {
    expect(thrown(element)).toEqual(expected);
  });

  it("renders a whole stack in one Panel, and scale-coloured stacked Bars", () => {
    expect(
      thrown(
        daily(
          <Chart.Panel series={["kwh", "kost"]}>
            <Chart.Line dataKey="kwh" />
            <Chart.Line dataKey="kost" />
          </Chart.Panel>,
          twoRows,
          STACKED
        )
      )
    ).toBeNull();
    expect(
      thrown(
        daily(
          <Chart.BarGroup series={["kwh", "kost"]}>
            <Chart.Bar dataKey="kwh" />
            <Chart.Bar dataKey="kost" />
          </Chart.BarGroup>,
          twoRows,
          { ...STACKED, kwh: { ...STACKED.kwh, color: "chart-seq" } }
        )
      )
    ).toBeNull();
    expect(
      thrown(daily(<Chart.Line dataKey="kwh" />, DAYS, { kwh: { label: "Forbruk", color: "chart-seq" } }))
    ).toBeNull();
  });

  it("renders a sentiment Panel beside a categorical Panel, each one colour family (Q1-2, B1-2)", () => {
    const rows = DAYS.map((row) => ({ ...row, balance: -1 }));
    expect(
      thrown(
        daily(
          <>
            <Chart.Panel series={["kwh"]}>
              <Chart.Bar dataKey="kwh" />
            </Chart.Panel>
            <Chart.Panel series={["balance"]}>
              <Chart.Bar dataKey="balance" />
            </Chart.Panel>
          </>,
          rows,
          {
            kwh: { label: "Forbruk", color: "chart-1" },
            balance: { label: "Balanse", color: "chart-sentiment-positive" },
          }
        )
      )
    ).toBeNull();
  });

  it("throws for one Panel that mixes a sentiment role with a categorical role", () => {
    const rows = DAYS.map((row) => ({ ...row, balance: -1 }));
    expect(
      thrown(
        daily(
          <Chart.Panel series={["kwh", "balance"]}>
            <Chart.Bar dataKey="kwh" />
          </Chart.Panel>,
          rows,
          {
            kwh: { label: "Forbruk", color: "chart-1" },
            balance: { label: "Balanse", color: "chart-sentiment-positive" },
          }
        )
      )
    ).toEqual(composition("mixed-sentiment-categorical"));
  });

  it("renders a day series on Root's hour with its value on the day's first hour", () => {
    // Oslo's 1 October 2025 starts at 22:00 UTC the day before.
    const hour = (index: number) => new Date(Date.UTC(2025, 8, 30, 22 + index));
    const hours = [{ start: hour(0), kwh: 1 }, { start: hour(1) }, { start: hour(2) }];
    expect(
      thrown(
        <Chart.Root
          data={hours}
          config={{ kwh: { label: "Forbruk", color: "chart-1", interval: "day" } }}
          xKey="start"
          interval="hour"
          timeZone={OSLO}
          aria-label="Forbruk">
          <Chart.Bar dataKey="kwh" />
        </Chart.Root>
      )
    ).toBeNull();
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

describe("development hints", () => {
  it("warns reference-outside-domain and names yInclude", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderToString(<LocaleProvider locale="nb-NO">{daily(<Chart.ReferenceLine y={40} />)}</LocaleProvider>);
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
      expect.stringContaining("yInclude"),
    ]);
  });

  it("warns absent-column for a TableColumn no row holds", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderToString(
      <LocaleProvider locale="nb-NO">
        {daily(
          <Chart.Table>
            <Chart.TableColumn dataKey="peak" header="Topptime" />
          </Chart.Table>
        )}
      </LocaleProvider>
    );
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([expect.stringContaining('"peak"')]);
  });

  it("warns bar-variant-needs-html for blocks in the path form", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const rows = Array.from({ length: 120 }, (_, index) => ({ category: `c${String(index)}`, kwh: index }));
    renderToString(
      <LocaleProvider locale="nb-NO">
        <Chart.Root data={rows} config={CONFIG} xKey="category" aria-label="Mange">
          <Chart.Bar dataKey="kwh" variant="blocks" />
        </Chart.Root>
      </LocaleProvider>
    );
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
      expect.stringContaining('variant="blocks"'),
    ]);
  });

  it.each([
    ["reference-outside-domain", <Chart.ReferenceLine key="line" y={40} />, "yInclude"],
    [
      "absent-column",
      <Chart.Table key="table">
        <Chart.TableColumn dataKey="peak" header="Topptime" />
      </Chart.Table>,
      '"peak"',
    ],
  ] as const)("warns %s once over three renders of one Root (X25)", (_, child, named) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const chart = (title: string) => (
      <LocaleProvider locale="nb-NO">
        <Chart.Root data={DAYS} config={CONFIG} xKey="day" interval="day" timeZone={OSLO} aria-label={title}>
          <Chart.Bar dataKey="kwh" />
          {child}
        </Chart.Root>
      </LocaleProvider>
    );
    const { rerender } = renderThemed(chart("Forbruk"));
    rerender(chart("Forbruk per dag"));
    rerender(chart("Forbruk i oktober"));
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([expect.stringContaining(named)]);
  });

  it("warns bars-overlap once, naming BarGroup, after two loose Bars register", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const rows = DAYS.map((row) => ({ ...row, kost: 1 }));
    renderThemed(
      <LocaleProvider locale="nb-NO">
        {daily(
          <>
            <Chart.Bar dataKey="kwh" />
            <Chart.Bar dataKey="kost" />
          </>,
          rows,
          { kwh: { label: "Forbruk", color: "chart-1" }, kost: { label: "Kostnad", color: "chart-2" } }
        )}
      </LocaleProvider>
    );
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
      expect.stringContaining("Chart.BarGroup"),
    ]);
  });
});
