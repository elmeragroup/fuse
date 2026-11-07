// The chart surfaces' option through a window switch, in Chromium, Firefox and WebKit. Units under
// test: the polar, cartesian and scatter surfaces' blur handling, through RadarChart.Root,
// Chart.Root and ScatterChart.Root. Oracle: a reader who switches to another window and back
// returns to the element they left, so the option keeps its node, its place and the keys. The
// switch is the events Firefox fires for it, which `switchWindowAndBack` plays in every engine.
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { switchWindowAndBack } from "../../../test/window-focus";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";
import { RadarChart } from "./radar-chart-namespace";
import { ScatterChart } from "./scatter-chart-namespace";

/** Midnight in Oslo on 1 October 2025. */
const OCTOBER = Date.parse("2025-09-30T22:00:00Z");

const surfaces = [
  {
    surface: "polar",
    chart: (
      <RadarChart.Root
        data={[
          { area: "NO1", v: 1, w: 3 },
          { area: "NO2", v: 2, w: 2 },
          { area: "NO3", v: 3, w: 1 },
        ]}
        config={{ v: { label: "Forbruk", color: "chart-1" }, w: { label: "Pris", color: "chart-2" } }}
        nameKey="area"
        aria-label="Områder"
      />
    ),
  },
  {
    surface: "cartesian",
    chart: (
      <Chart.Root
        data={[0, 1, 2].map((day) => ({ day: new Date(OCTOBER + day * 86_400_000), p: day + 1 }))}
        config={{ p: { label: "Forbruk", color: "chart-1" } }}
        xKey="day"
        interval="day"
        timeZone="Europe/Oslo"
        aria-label="Forbruk per dag">
        <Chart.Bar dataKey="p" />
      </Chart.Root>
    ),
  },
  {
    surface: "scatter",
    chart: (
      <ScatterChart.Root
        data={[
          { t: -2, kwh: 20_000, s: "now" },
          { t: 2, kwh: 90_000, s: "now" },
          { t: 18, kwh: 160_000, s: "now" },
        ]}
        config={{ now: { label: "Forbruk 2026", color: "chart-1" } }}
        xKey="t"
        yKey="kwh"
        seriesKey="s"
        aria-label="Forbruk mot temperatur">
        <ScatterChart.Points dataKey="now" />
      </ScatterChart.Root>
    ),
  },
];

describe("an option through a window switch", () => {
  it.each(surfaces)(
    "keeps the $surface surface's focused option, its place and its keys when the window leaves and returns",
    async ({ chart }) => {
      const { host } = renderThemed(
        <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
          <button type="button">før</button>
          {chart}
        </LocaleProvider>
      );
      host.querySelector("button")?.focus();
      await userEvent.keyboard("{Tab}{ArrowRight}");
      const left = document.activeElement;
      expect(left?.getAttribute("role")).toBe("option");
      expect(left?.getAttribute("aria-posinset")).toBe("2");
      if (left === null) throw new Error("no focused option");
      switchWindowAndBack(left);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(document.activeElement).toBe(left);
      expect(left.isConnected).toBe(true);
      await userEvent.keyboard("{ArrowRight}");
      expect(document.activeElement?.getAttribute("aria-posinset")).toBe("3");
    }
  );
});
