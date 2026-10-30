// CONTRACT section 8.1's production behaviour, in React's production build: each data rule renders
// the fallback its table row names and warns once, hints stay silent, and a composition error
// still throws. Every expected render is written by hand from the row's fallback text.
import type { ReactElement } from "react";

import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../dist/styles.css";
import { barBox } from "../../../test/chart/bar-box";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig, ChartRow } from "./chart-types";
import "./chart.css";

const OSLO = "Europe/Oslo";
const at = (date: number, hour = -2) => new Date(Date.UTC(2025, 9, date, hour));
const CONFIG = {
  kwh: { label: "Forbruk", color: "chart-1", qualityKey: "q" },
} as const satisfies ChartConfig;

/** A row as an export delivers it, so a quality cell may hold a code Fuse does not know. */
type Row = ChartRow;

/** Rows typed as an export delivers them. */
function asRows(rows: readonly Row[]): readonly Row[] {
  return rows;
}

function daily(rows: readonly Row[], extra?: ReactElement): ReactElement {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 300 }}>
        <Chart.Root
          data={rows}
          config={CONFIG}
          xKey="day"
          interval="day"
          timeZone={OSLO}
          aria-label="Forbruk">
          <Chart.Bar dataKey="kwh" />
          <Chart.Table />
          {extra}
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

/** Each body row's cells, the row header first, as the table prints them. */
function tableRows(host: HTMLElement): string[][] {
  // DOM audit: the table is visually hidden while collapsed, so its rows are read by structure.
  return [...host.querySelectorAll('[data-slot="chart-table-content"] tbody tr')].map((row) =>
    [...row.children].map(
      (cell) => cell.querySelector('[aria-hidden="true"]')?.textContent ?? cell.textContent
    )
  );
}

function bars(host: HTMLElement): Element[] {
  // DOM audit: bars are aria-hidden plot output.
  return [...host.querySelectorAll('[data-slot="chart-bar"]')];
}

function missingTicks(host: HTMLElement): number {
  // DOM audit: the missing marker is aria-hidden plot output.
  return host.querySelectorAll('[data-slot="chart-bar-missing"]').length;
}

let warn = vi.spyOn(console, "warn");

afterEach(() => {
  warn.mockRestore();
});

function spy(): void {
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
}

describe("data rules in production", () => {
  it("counts a NaN value as missing and warns once", () => {
    spy();
    const { host } = renderThemed(
      daily([
        { day: at(1), kwh: 1 },
        { day: at(2), kwh: Number.NaN },
        { day: at(3), kwh: 3 },
      ])
    );
    expect(bars(host)).toHaveLength(2);
    expect(missingTicks(host)).toBe(1);
    expect(tableRows(host).map((row) => row[1])).toEqual(["1", "–", "3"]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("counts a value above 1e15 as missing and warns once", () => {
    spy();
    const { host } = renderThemed(
      daily([
        { day: at(1), kwh: 2e15 },
        { day: at(2), kwh: 2 },
      ])
    );
    expect(tableRows(host).map((row) => row[1])).toEqual(["–", "2"]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("drops a row with an invalid x and warns once", () => {
    spy();
    const { host } = renderThemed(
      daily([
        { day: at(1), kwh: 1 },
        { day: new Date(Number.NaN), kwh: 9 },
        { day: at(2), kwh: 2 },
      ])
    );
    expect(tableRows(host).map((row) => row[1])).toEqual(["1", "2"]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("moves an off-grid row to the slot that holds it and warns once", () => {
    spy();
    // Noon on 2 October lies inside the Oslo day of 2 October.
    const { host } = renderThemed(
      daily([
        { day: at(1), kwh: 1 },
        { day: at(2, 10), kwh: 2 },
      ])
    );
    expect(tableRows(host).map((row) => row[1])).toEqual(["1", "2"]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("moves an hourly value on a :15 row to its hour, warns once, and never sums quarters into hours", async () => {
    spy();
    // Hour 00 of Oslo's 1 October 2025 holds its value on the :15 row, and hour 01 on its :00 row.
    // Each hour's bar spans its 4 quarter cells: 50 px of a 200 px plot.
    type Quarter = { readonly start: Date; readonly price: number; readonly kwh?: number };
    const quarter = (index: number): Quarter => ({
      start: new Date(Date.UTC(2025, 8, 30, 22, index * 15)),
      price: 1,
    });
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 200 }}>
          <Chart.Root
            data={[0, 1, 2, 3, 4, 5, 6, 7].map((index) =>
              index === 1
                ? { ...quarter(index), kwh: 2 }
                : index === 4
                  ? { ...quarter(index), kwh: 4 }
                  : quarter(index)
            )}
            config={{
              price: { label: "Pris", color: "chart-1" },
              kwh: { label: "Forbruk", color: "chart-2", interval: "hour" },
            }}
            xKey="start"
            interval="quarter-hour"
            timeZone={OSLO}
            data-intro="none"
            aria-label="Pris og forbruk">
            <Chart.Panel series={["price"]} />
            <Chart.Panel series={["kwh"]}>
              <Chart.Bar dataKey="kwh" />
            </Chart.Panel>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    await expect.poll(() => bars(host)).toHaveLength(2);
    // DOM audit: the bar series layer covers the Panel's plot box, and bars are aria-hidden output.
    const plot =
      host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect() ?? new DOMRect();
    expect(bars(host).map((bar) => Math.round(barBox(bar, plot).right - barBox(bar, plot).left))).toEqual([
      75, 75,
    ]);
    // The domain reaches 4 alone, so 2 draws half as tall as 4.
    expect(bars(host).map((bar) => Math.round(barBox(bar, plot).bottom - barBox(bar, plot).top))).toEqual([
      100, 200,
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("keeps the first of two rows for one slot and warns once", () => {
    spy();
    const { host } = renderThemed(
      daily([
        { day: at(1), kwh: 1 },
        { day: at(1), kwh: 5 },
      ])
    );
    expect(tableRows(host).map((row) => row[1])).toEqual(["1"]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("drops a row outside the period and warns once", () => {
    spy();
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={asRows([
            { day: at(1), kwh: 1 },
            { day: new Date(Date.UTC(2025, 10, 5, -1)), kwh: 9 },
          ])}
          config={CONFIG}
          xKey="day"
          interval="day"
          timeZone={OSLO}
          period={[at(1), at(3)]}
          aria-label="Forbruk">
          <Chart.Table />
        </Chart.Root>
      </LocaleProvider>
    );
    expect(tableRows(host).map((row) => row[1])).toEqual(["1"]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("counts an estimate with no value as missing and warns once", () => {
    spy();
    const { host } = renderThemed(
      daily([
        { day: at(1), kwh: null, q: "estimated" },
        { day: at(2), kwh: 2 },
      ])
    );
    expect(tableRows(host).map((row) => row[1])).toEqual(["–", "2"]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("draws an unknown quality code as estimated and warns once", () => {
    spy();
    const { host } = renderThemed(
      daily([
        { day: at(1), kwh: 1, q: "E01" },
        { day: at(2), kwh: 2 },
      ])
    );
    expect(bars(host).map((bar) => bar.getAttribute("data-quality"))).toEqual(["estimated", null]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("divides a mixed-sign stack under expand by its absolute sum and warns once", () => {
    spy();
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <Chart.Root
            data={[{ day: at(1), a: 3, b: -1 }]}
            config={{
              a: { label: "A", color: "chart-1", stack: "s" },
              b: { label: "B", color: "chart-2", stack: "s" },
            }}
            xKey="day"
            interval="day"
            timeZone={OSLO}
            stackOffset="expand"
            data-intro="none"
            aria-label="Andel">
            <Chart.Bar dataKey="a" />
            <Chart.Bar dataKey="b" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // a fills 0 to 0.75 and b fills -0.25 to 0. The domain [-0.25, 0.75] nices to [-0.4, 0.8].
    // DOM audit: the bar series box is the plot box the clip-paths resolve against.
    const plot =
      host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect() ?? new DOMRect();
    const [a, b] = bars(host).map((bar) => barBox(bar, plot));
    expect(Math.abs((a?.top ?? 0) - (0.05 / 1.2) * plot.height)).toBeLessThanOrEqual(0.5);
    // a is not its stack's outer segment below zero, so its far end stays where 0.75 lands.
    expect(Math.abs((a?.bottom ?? 0) - (0.8 / 1.2) * plot.height)).toBeLessThanOrEqual(0.5);
    expect(Math.abs((b?.top ?? 0) - (0.8 / 1.2) * plot.height)).toBeLessThanOrEqual(0.5);
    expect(Math.abs((b?.bottom ?? 0) - (1.05 / 1.2) * plot.height)).toBeLessThanOrEqual(0.5);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("prints a mismatched TableColumn through the default number format and warns once", () => {
    spy();
    const rows = asRows([{ day: at(1), kwh: 1, change: 0.25 }]);
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={rows}
          config={CONFIG}
          xKey="day"
          interval="day"
          timeZone={OSLO}
          aria-label="Forbruk">
          <Chart.Table>
            <Chart.TableColumn dataKey="change" header="Endring" format="hour" />
          </Chart.Table>
        </Chart.Root>
      </LocaleProvider>
    );
    expect(tableRows(host)[0]?.at(-1)).toBe("0,25");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("hints and composition errors in production", () => {
  it("raises no hint", () => {
    spy();
    renderThemed(daily([{ day: at(1), kwh: 1 }], <Chart.ReferenceLine y={40} />));
    expect(warn).not.toHaveBeenCalled();
  });

  it("still throws a composition error", () => {
    let rule: unknown;
    try {
      renderToString(
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data={asRows([{ day: at(1), kwh: 1 }])}
            config={CONFIG}
            xKey="day"
            interval="day"
            timeZone={OSLO}
            xScale="point"
            aria-label="Forbruk">
            <Chart.Bar dataKey="kwh" />
          </Chart.Root>
        </LocaleProvider>
      );
    } catch (error) {
      rule = error instanceof Error && "rule" in error ? error.rule : error;
    }
    expect(rule).toBe("bar-needs-band");
  });
});

describe("line and area composition errors in production", () => {
  it.each([
    ["step-curve-needs-cells", <Chart.Line key="line" dataKey="kwh" curve="step-after" />, "point"],
    ["baseline-required", <Chart.Area key="area" dataKey="kwh" />, "band"],
  ] as const)("still throws %s", (expected, part, xScale) => {
    let rule: unknown;
    try {
      renderToString(
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data={asRows([{ day: at(1), kwh: 1 }])}
            config={CONFIG}
            xKey="day"
            interval="day"
            timeZone={OSLO}
            xScale={xScale}
            yBaseline={expected === "baseline-required" ? "none" : "zero"}
            aria-label="Forbruk">
            {part}
          </Chart.Root>
        </LocaleProvider>
      );
    } catch (error) {
      rule = error instanceof Error && "rule" in error ? error.rule : error;
    }
    expect(rule).toBe(expected);
  });
});
