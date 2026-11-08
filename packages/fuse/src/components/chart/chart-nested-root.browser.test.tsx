// A chart Root nested inside another chart's part, in Chromium. Unit under test: the nested Root's
// own parts. Oracle: what each part's JSDoc says it does in a Root of its own, outside a polar
// Root, a tooltip, a Headline and a Crosshair, and SPEC S14's cases for each polar family in both
// directions.
import type { ReactNode } from "react";

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { bars, pointerAt, pointerTarget, popup, popupOpen, surfaceBox } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";
import { ScatterChart } from "./scatter-chart-namespace";

const ROWS = ["a", "b", "c"].map((name, index) => ({ name, v: index + 1, w: 4 - index }));

const CONFIG = { v: { label: "Forbruk", color: "chart-1" }, w: { label: "Pris", color: "chart-2" } } as const;

/** A pie's and a radial chart's rows, one per category. */
const POLAR_ROWS = [
  { name: "strom", v: 1240 },
  { name: "nettleie", v: 680 },
];

const POLAR_CONFIG = {
  strom: { label: "Strøm", color: "chart-1" },
  nettleie: { label: "Nettleie", color: "chart-2" },
} as const;

/** A scatter chart's points: outdoor temperature in °C against a household's yearly kWh. */
const SCATTER_ROWS = [
  { t: -2, kwh: 21_000, s: "now" },
  { t: 18, kwh: 9_000, s: "now" },
];

const SCATTER_CONFIG = { now: { label: "Forbruk", color: "chart-1" } } as const;

/** A radar's series over ROWS' categories. */
const RADAR_CONFIG = {
  v: { label: "NO1", color: "chart-1" },
  w: { label: "NO2", color: "chart-2" },
} as const;

/** The nested Root, which the outer chart's part holds. */
function Nested({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: 240 }}>
      <Chart.Root data={ROWS} config={CONFIG} xKey="name" data-intro="none" aria-label="Indre">
        <Chart.Bar dataKey="v" />
        <Chart.Bar dataKey="w" />
        {children}
      </Chart.Root>
    </div>
  );
}

/** The nested Root's figure, which the outer chart's figure holds. */
function nestedFigure(host: HTMLElement): HTMLElement {
  // DOM audit: each Root is a figure on the chart slot, and the nested one sits inside the outer.
  const figure = host.querySelector<HTMLElement>('[data-slot="chart"] [data-slot="chart"]');
  if (figure === null) throw new Error("no nested Root");
  return figure;
}

/** A box's centre in client pixels. */
function centreOf(rect: DOMRect): [number, number] {
  return [rect.left + rect.width / 2, rect.top + rect.height / 2];
}

describe("a Root nested in another chart's part", () => {
  // #453's repro and SPEC S14, in each polar family: a Chart.Root inside a polar Root lists its own
  // config keys, and none of the polar Root's categories.
  it.each([
    [
      "PieChart",
      (nested: ReactNode) => (
        <PieChart.Root data={POLAR_ROWS} config={POLAR_CONFIG} nameKey="name" valueKey="v" aria-label="Kake">
          {nested}
        </PieChart.Root>
      ),
    ],
    [
      "RadialChart",
      (nested: ReactNode) => (
        <RadialChart.Root
          data={POLAR_ROWS}
          config={POLAR_CONFIG}
          nameKey="name"
          valueKey="v"
          aria-label="Ringer">
          {nested}
        </RadialChart.Root>
      ),
    ],
    [
      "RadarChart",
      (nested: ReactNode) => (
        <RadarChart.Root data={ROWS} config={CONFIG} nameKey="name" aria-label="Radar">
          {nested}
        </RadarChart.Root>
      ),
    ],
  ])("renders its own legend inside a %s Root", (_, outer) => {
    renderThemed(
      <LocaleProvider locale="nb-NO">
        {outer(
          <Nested>
            <Chart.Legend />
          </Nested>
        )}
      </LocaleProvider>
    );
    // Chart.Legend lists one entry per config key of its own Root, by the key's label.
    expect(
      page
        .getByRole("listitem")
        .elements()
        .map((item) => item.textContent)
    ).toEqual(["Forbruk", "Pris"]);
  });

  // SPEC S14 the other way: a polar Root inside Chart.Tooltip reads its own model, not Chart's.
  it.each([
    [
      "PieChart",
      <PieChart.Root
        key="pie"
        data={POLAR_ROWS}
        config={POLAR_CONFIG}
        nameKey="name"
        valueKey="v"
        aria-label="Kake">
        <PieChart.Legend />
      </PieChart.Root>,
      ["Strøm", "Nettleie"],
    ],
    [
      "RadialChart",
      <RadialChart.Root
        key="radial"
        data={POLAR_ROWS}
        config={POLAR_CONFIG}
        nameKey="name"
        valueKey="v"
        aria-label="Ringer">
        <RadialChart.Legend />
      </RadialChart.Root>,
      ["Strøm", "Nettleie"],
    ],
    [
      "RadarChart",
      <RadarChart.Root key="radar" data={ROWS} config={RADAR_CONFIG} nameKey="name" aria-label="Radar">
        <RadarChart.Legend />
      </RadarChart.Root>,
      ["NO1", "NO2"],
    ],
  ])("lists its own legend as a %s Root inside a pinned Chart.Tooltip", async (_, nested, expected) => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ padding: "320px 24px 24px", width: 600, boxSizing: "border-box" }}>
          <Chart.Root data={ROWS} config={CONFIG} xKey="name" data-intro="none" aria-label="Ytre">
            <Chart.Bar dataKey="v" />
            <Chart.Tooltip>{nested}</Chart.Tooltip>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const [first] = bars(host);
    if (first === undefined) throw new Error("no bars");
    const [x, y] = centreOf(first.getBoundingClientRect());
    await pointerAt(x, y);
    await userEvent.click(...pointerTarget(x, y));
    await expect.poll(popupOpen).toBe(true);
    // DOM audit: the popup is aria-hidden, so the polar Legend's items inside it are read by their
    // slot, and they list their own Root's items by their labels.
    expect(
      [...(popup()?.querySelectorAll('[data-slot="chart-legend-item"]') ?? [])].map(
        (item) => item.textContent
      )
    ).toEqual(expected);
  });

  it("leaves its SeriesLabel resting inside a pinned tooltip while its own plot is active", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ padding: "320px 24px 24px", width: 600, boxSizing: "border-box" }}>
          <Chart.Root data={ROWS} config={CONFIG} xKey="name" data-intro="none" aria-label="Ytre">
            <Chart.Bar dataKey="v" />
            <Chart.Tooltip>
              <Nested>
                <Chart.SeriesLabel />
              </Nested>
            </Chart.Tooltip>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const [first] = bars(host);
    if (first === undefined) throw new Error("no bars");
    const [x, y] = centreOf(first.getBoundingClientRect());
    await pointerAt(x, y);
    await userEvent.click(...pointerTarget(x, y));
    await expect.poll(popupOpen).toBe(true);
    // DOM audit: the popup portals out of the host, and the nested Root is a figure inside it.
    const figure = popup()?.querySelector<HTMLElement>('[data-slot="chart"]');
    if (figure === null || figure === undefined) throw new Error("no nested Root in the popup");
    await pointerAt(...centreOf(surfaceBox(figure)));
    // DOM audit: Root states its active slot on data-active.
    await expect.poll(() => figure.hasAttribute("data-active")).toBe(true);
    // A SeriesLabel with no dataKey and no row prints the active point's key only in a live scope,
    // such as its own Root's tooltip, so here it prints nothing.
    expect(figure.querySelector('[data-slot="chart-series-label"]')?.textContent).toBe("");
  });

  it("prints its own fallback LegendValue inside an outer Tooltip that has closed (A1-01)", async () => {
    // The outer chart's first slot is active, then the pointer leaves, and the closed popup keeps
    // its content mounted. The nested Root's own slots are never active, so its LegendValue prints
    // its fallback, the last reading of v in ROWS: 3, never v at the outer active slot, 1.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ padding: "320px 24px 24px", width: 600, boxSizing: "border-box" }}>
          <Chart.Root data={ROWS} config={CONFIG} xKey="name" data-intro="none" aria-label="Ytre">
            <Chart.Bar dataKey="v" />
            <Chart.Tooltip>
              <Nested>
                <Chart.LegendValue dataKey="v" />
              </Nested>
            </Chart.Tooltip>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const [first] = bars(host);
    if (first === undefined) throw new Error("no bars");
    await pointerAt(...centreOf(first.getBoundingClientRect()));
    await expect.poll(popupOpen).toBe(true);
    const shell = host.getBoundingClientRect();
    await pointerAt(shell.left + 4, shell.top + 4);
    await expect.poll(popupOpen).toBe(false);
    // DOM audit: the closed popup stays mounted under its slot, aria-hidden, so the value's slot is
    // the only locator.
    const value = document.querySelector('[data-slot="chart-tooltip"] [data-slot="chart-legend-value"]');
    expect(value?.textContent).toBe("3");
  });

  it("draws its ActiveValue as plot output inside an outer Headline", () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root data={ROWS} config={CONFIG} xKey="name" data-intro="none" aria-label="Ytre">
          <Chart.Bar dataKey="v" />
          <Chart.Headline>
            <Nested>
              <Chart.ActiveValue dataKey="v" />
            </Nested>
          </Chart.Headline>
        </Chart.Root>
      </LocaleProvider>
    );
    // Outside a Headline, an ActiveValue is plot output that readers skip.
    // DOM audit: the plot form hides its slot from the accessibility tree.
    const value = nestedFigure(host).querySelector('[data-slot="chart-active-value"]');
    expect(value?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders no SlotLabel outside its own Crosshair, inside an outer Crosshair's children", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 600 }}>
          <Chart.Root data={ROWS} config={CONFIG} xKey="name" data-intro="none" aria-label="Ytre">
            <Chart.Bar dataKey="v" />
            <Chart.Crosshair>
              <Nested>
                <Chart.SlotLabel />
              </Nested>
            </Chart.Crosshair>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const figure = nestedFigure(host);
    // The nested plot has drawn its frame once its bars show, so a SlotLabel that would show has.
    await expect.poll(() => bars(figure).length).toBe(ROWS.length * 2);
    // A SlotLabel shows only inside a Crosshair of its own Root, and renders nothing elsewhere.
    // DOM audit: the pill is aria-hidden plot output, so its slot is the only locator.
    expect(figure.querySelector('[data-slot="chart-slot-label"]')).toBeNull();
  });

  it("prints no ValueLabel outside its own Marker, inside an outer Marker's children", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 600 }}>
          <Chart.Root data={ROWS} config={CONFIG} xKey="name" data-intro="none" aria-label="Ytre">
            <Chart.Bar dataKey="v" />
            <Chart.Marker dataKey="v" at="last">
              <Nested>
                <Chart.ValueLabel />
              </Nested>
            </Chart.Marker>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // The outer Marker renders its children once the outer plot has drawn.
    await expect.poll(() => nestedFigure(host)).toBeInstanceOf(HTMLElement);
    // A ValueLabel prints the datum of its own Root's Marker or ActiveValueLine, and nothing
    // without one, though the nested v has a reading, 3, at the outer Marker's last slot.
    // DOM audit: the pill is aria-hidden plot output, so its slot is the only locator.
    expect(nestedFigure(host).querySelector('[data-slot="chart-value-label"]')?.textContent).toBe("");
  });

  it("gives a clock ValueLabel no outer clock Marker's datum (Q2)", () => {
    // An outer dial of 99s with a Marker on its first hour holds an inner dial of 2s whose ValueLabel
    // has no Marker of its own. In a chart of its own that ValueLabel throws part-outside-root, as
    // its JSDoc says, and nested it must do the same rather than print the outer 99.
    const day = (value: number) =>
      Array.from({ length: 24 }, (_, hour) => ({
        start: Date.parse("2025-10-24T22:00:00Z") + hour * 3_600_000,
        kwh: value,
      }));
    const dial = {
      config: { kwh: { label: "kWh", color: "chart-1" } },
      xKey: "start",
      cycle: "day",
      interval: "hour",
    } as const;
    const render = () =>
      renderToString(
        <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
          <ClockChart.Root data={day(99)} {...dial} aria-label="Ytre">
            <ClockChart.Marker dataKey="kwh" at="first">
              <ClockChart.Root data={day(2)} {...dial} aria-label="Indre">
                <ClockChart.ValueLabel />
              </ClockChart.Root>
            </ClockChart.Marker>
          </ClockChart.Root>
        </LocaleProvider>
      );
    expect(render).toThrow(expect.objectContaining({ rule: "part-outside-root" }));
  });

  it("gives a polar part inside a nested cartesian Root no outer polar Root (Q2's class)", () => {
    // A pie's CenterValue belongs to a PieChart.Root. Placed under a Chart.Root that sits in an outer
    // pie's Center, it has no pie of its own, so it throws part-outside-root, as it does under a
    // lone Chart.Root, rather than print the outer pie's total.
    const render = () =>
      renderToString(
        <LocaleProvider locale="nb-NO">
          <PieChart.Root
            data={POLAR_ROWS}
            config={POLAR_CONFIG}
            nameKey="name"
            valueKey="v"
            aria-label="Ytre">
            <PieChart.Center>
              <Chart.Root data={ROWS} config={CONFIG} xKey="name" aria-label="Indre">
                <PieChart.CenterValue />
              </Chart.Root>
            </PieChart.Center>
          </PieChart.Root>
        </LocaleProvider>
      );
    expect(render).toThrow(expect.objectContaining({ rule: "part-outside-root" }));
  });

  // Each family's part, under another family's Root nested in a Root of its own family: alone under
  // the inner Root it throws part-outside-root, as its JSDoc says, so nested it must throw the same
  // rather than draw into, or read from, the outer chart (Q2's class: every context that crosses a
  // Root). The outer Root holds the inner one where the server renders its children.
  it.each([
    [
      "a pie's CenterValue under a ScatterChart in a pie's Center",
      () => (
        <PieChart.Root data={POLAR_ROWS} config={POLAR_CONFIG} nameKey="name" valueKey="v" aria-label="Ytre">
          <PieChart.Center>
            <ScatterChart.Root
              data={SCATTER_ROWS}
              config={SCATTER_CONFIG}
              xKey="t"
              yKey="kwh"
              seriesKey="s"
              aria-label="Indre">
              <PieChart.CenterValue />
            </ScatterChart.Root>
          </PieChart.Center>
        </PieChart.Root>
      ),
    ],
    [
      "a pie's Legend, which reads its Root's readout, under a ScatterChart in a pie's Center",
      () => (
        <PieChart.Root data={POLAR_ROWS} config={POLAR_CONFIG} nameKey="name" valueKey="v" aria-label="Ytre">
          <PieChart.Center>
            <ScatterChart.Root
              data={SCATTER_ROWS}
              config={SCATTER_CONFIG}
              xKey="t"
              yKey="kwh"
              seriesKey="s"
              aria-label="Indre">
              <PieChart.Legend />
            </ScatterChart.Root>
          </PieChart.Center>
        </PieChart.Root>
      ),
    ],
    [
      "a cartesian XAxis under a pie in a Chart.Root",
      () => (
        <Chart.Root data={ROWS} config={CONFIG} xKey="name" aria-label="Ytre">
          <PieChart.Root
            data={POLAR_ROWS}
            config={POLAR_CONFIG}
            nameKey="name"
            valueKey="v"
            aria-label="Indre">
            <Chart.XAxis />
          </PieChart.Root>
        </Chart.Root>
      ),
    ],
    [
      "a scatter's Points under a pie in a ScatterChart.Root",
      () => (
        <ScatterChart.Root
          data={SCATTER_ROWS}
          config={SCATTER_CONFIG}
          xKey="t"
          yKey="kwh"
          seriesKey="s"
          aria-label="Ytre">
          <PieChart.Root
            data={POLAR_ROWS}
            config={POLAR_CONFIG}
            nameKey="name"
            valueKey="v"
            aria-label="Indre">
            <ScatterChart.Points dataKey="now" />
          </PieChart.Root>
        </ScatterChart.Root>
      ),
    ],
  ] as const)("gives %s no outer Root (Q2's class)", (_, chart) => {
    const render = () => renderToString(<LocaleProvider locale="nb-NO">{chart()}</LocaleProvider>);
    expect(render).toThrow(expect.objectContaining({ rule: "part-outside-root" }));
  });
});
