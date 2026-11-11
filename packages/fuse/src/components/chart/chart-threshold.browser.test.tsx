// Threshold colours in Chromium. Units under test: the marks, the legend and the readouts of a
// series whose config colour is a ChartThresholdColor. Oracles: the theme's own sentiment roles,
// resolved through a probe outside every chart rule; the rule ChartThresholdColor documents, a
// value above the threshold paints `above` and a value at it or below paints `below`; the
// threshold's y, where a ReferenceLine at the same number draws; and labels written by hand.
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { computedColor } from "../../../test/assert-invalid-ring";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig, ChartSeriesConfig, ChartThresholdColor } from "./chart-types";
import "./chart.css";

/** Four categories whose values sit below, above, below and above 50. */
const ROWS = [
  { name: "a", v: 20 },
  { name: "b", v: 80 },
  { name: "c", v: 30 },
  { name: "d", v: 70 },
];

/** A split at 50: positive at or below it, negative above it. */
const SPLIT: ChartThresholdColor = {
  threshold: 50,
  below: { color: "chart-sentiment-positive", label: "Under snittet" },
  above: { color: "chart-sentiment-negative", label: "Over snittet" },
};

function config(threshold: number, projectedFrom?: string): ChartConfig {
  const series: ChartSeriesConfig = { label: "Spotpris", color: { ...SPLIT, threshold } };
  if (projectedFrom !== undefined) series.projectedFrom = projectedFrom;
  return { v: series };
}

function chart(
  marks: ReactNode,
  options: {
    readonly threshold?: number;
    readonly projectedFrom?: string;
    readonly rows?: typeof ROWS;
    readonly config?: ChartConfig;
  } = {}
) {
  return renderThemed(
    <div style={{ width: 400, padding: 16 }}>
      <button type="button">Før</button>
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={options.rows ?? ROWS}
          config={options.config ?? config(options.threshold ?? 50, options.projectedFrom)}
          xKey="name"
          yInclude={[0, 100]}
          data-intro="none"
          style={{ "--chart-plot-height": "200px" }}
          aria-label="Spotpris">
          {/* The rule locates the threshold's y, where the paint must split. */}
          <Chart.ReferenceLine y={50} />
          {marks}
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

/**
 * The two sides' roles as the browser computes them in this theme, through a probe outside every
 * chart rule, so they compare exactly with a mark's computed paint.
 */
function roles(host: HTMLElement) {
  return {
    below: computedColor(host, "var(--chart-sentiment-positive)"),
    above: computedColor(host, "var(--chart-sentiment-negative)"),
  };
}

describe("the legend of a threshold series", () => {
  it("lists one entry per side, above first, each with its own label and swatch", () => {
    const { host } = chart(
      <>
        <Chart.Bar dataKey="v" />
        <Chart.Legend />
      </>
    );
    const items = page.getByRole("listitem").elements();
    expect(items.map((item) => item.textContent)).toEqual(["Over snittet", "Under snittet"]);
    // The swatch is aria-hidden decoration inside each item.
    const swatches = items.map((item) => item.querySelector('[data-slot="chart-swatch"]'));
    const { below, above } = roles(host);
    expect(
      swatches.map((swatch) => (swatch === null ? "" : getComputedStyle(swatch).backgroundColor))
    ).toEqual([above, below]);
  });

  it("keeps the series' own label and value beside a side in a template", () => {
    chart(
      <>
        <Chart.Bar dataKey="v" />
        <Chart.Legend>
          <Chart.LegendItem>
            <Chart.SeriesLabel />
            <Chart.SeriesLabel dataKey="v" />
            <Chart.LegendValue />
          </Chart.LegendItem>
        </Chart.Legend>
      </>
    );
    // Each side's item names its side through the series' parts; the value is the series' last, 70.
    expect(
      page
        .getByRole("listitem")
        .elements()
        .map((item) => item.textContent)
    ).toEqual(["Over snittetOver snittet70", "Under snittetUnder snittet70"]);
  });

  it("leaves another series' parts nested in a side's entry their own label and paint", () => {
    const { host } = chart(
      <>
        <Chart.Bar dataKey="v" />
        <Chart.Line dataKey="w" />
        <Chart.Legend>
          <Chart.LegendItem dataKey="v">
            <Chart.SeriesLabel />
            <Chart.LegendToggleGroup>
              <Chart.LegendToggle dataKey="w">
                <Chart.Swatch />
                <Chart.SeriesLabel />
              </Chart.LegendToggle>
            </Chart.LegendToggleGroup>
          </Chart.LegendItem>
        </Chart.Legend>
      </>,
      {
        rows: ROWS.map((row) => ({ ...row, w: 50 })),
        config: {
          v: { label: "Spotpris", color: SPLIT },
          w: { label: "Snitt", color: "chart-sentiment-positive" },
        },
      }
    );
    // Each side's entry nests one toggle for w, which names w and wears w's own role. The first
    // button is the page's "Før".
    const toggles = page.getByRole("button").elements().slice(1);
    expect(toggles.map((toggle) => toggle.textContent)).toEqual(["Snitt", "Snitt"]);
    // The swatch is aria-hidden decoration inside each toggle.
    const swatches = toggles.map((toggle) => toggle.querySelector('[data-slot="chart-swatch"]'));
    const own = computedColor(host, "var(--chart-sentiment-positive)");
    expect(
      swatches.map((swatch) => (swatch === null ? "" : getComputedStyle(swatch).backgroundColor))
    ).toEqual([own, own]);
  });

  it("leaves a Root nested in a side's entry its own series' label and paint", () => {
    const { host } = chart(
      <>
        <Chart.Bar dataKey="v" />
        <Chart.Legend>
          <Chart.LegendItem dataKey="v">
            <Chart.Root
              data={ROWS}
              config={{ v: { label: "Snitt", color: "chart-3" } }}
              xKey="name"
              data-intro="none"
              aria-label="Snitt">
              <Chart.Line dataKey="v" />
              <Chart.Swatch dataKey="v" />
              <Chart.SeriesLabel dataKey="v" />
            </Chart.Root>
          </Chart.LegendItem>
        </Chart.Legend>
      </>
    );
    // Each side's entry nests a Root whose own v is plain, so its parts name and paint that v.
    // The nested Root's label and swatch are its own slots inside each legend item.
    const items = page.getByRole("listitem").elements();
    const labels = items.map((item) => item.querySelector('[data-slot="chart-series-label"]')?.textContent);
    expect(labels).toEqual(["Snitt", "Snitt"]);
    const swatches = items.map((item) => item.querySelector('[data-slot="chart-swatch"]'));
    const own = computedColor(host, "var(--chart-3)");
    expect(
      swatches.map((swatch) => (swatch === null ? "" : getComputedStyle(swatch).backgroundColor))
    ).toEqual([own, own]);
  });

  it("leaves a Root nested in another series' entry its own keys", () => {
    const { host } = chart(
      <>
        <Chart.Bar dataKey="v" />
        <Chart.Legend>
          <Chart.LegendItem dataKey="v">
            <Chart.Root
              data={ROWS.map(({ name, v }) => ({ name, w: v }))}
              config={{ w: { label: "Snitt", color: "chart-3" } }}
              xKey="name"
              data-intro="none"
              aria-label="Snitt">
              <Chart.Line dataKey="w" />
              <Chart.Swatch />
              <Chart.SeriesLabel />
            </Chart.Root>
          </Chart.LegendItem>
        </Chart.Legend>
      </>,
      { config: { v: { label: "Spotpris", color: "chart-sentiment-negative" } } }
    );
    // The nested parts have no dataKey, no row of their own Root and no active point, so the label
    // prints nothing and the swatch falls back to the nested Root's first series, w.
    // The nested Root's label and swatch are its own slots inside the legend item.
    const [item] = page.getByRole("listitem").elements();
    expect(item?.querySelector('[data-slot="chart-series-label"]')?.textContent).toBe("");
    const swatch = item?.querySelector('[data-slot="chart-swatch"]');
    expect(swatch === null || swatch === undefined ? "" : getComputedStyle(swatch).backgroundColor).toBe(
      computedColor(host, "var(--chart-3)")
    );
  });

  it("keeps one toggle per series, named by the series' label", () => {
    chart(
      <>
        <Chart.Bar dataKey="v" />
        <Chart.LegendToggleGroup />
      </>
    );
    expect(
      page
        .getByRole("button")
        .elements()
        .map((button) => button.textContent)
    ).toEqual(["Før", "Spotpris"]);
  });
});
