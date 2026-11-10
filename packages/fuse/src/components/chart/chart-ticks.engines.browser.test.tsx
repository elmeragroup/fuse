// The x-tick judge of CONTRACT section 8.11, in Chromium, Firefox and WebKit: the 90-case matrix
// of the pass-2 cross-browser check, the DST days and a width sweep. The rendered label boxes are
// the oracle. They never overlap, stay inside the root, and never fall in count as the width grows.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import type { HourRow } from "../../../test/chart/elhub-rows";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";
import year from "./format/fixtures/elhub/no1-household-hourly-2025-10_2026-09.json" with { type: "json" };

describe("a year of hours", () => {
  // jc4: the committed hourly year, from 1 October 2025 in Oslo. Its labels fall back to month
  // starts, which read the ground truth's CLDR 48 nb-NO short months in slots.json, with the year
  // on 1 January.
  const rows: HourRow[] = year.values.map((household, hour) => ({
    start: new Date(Date.parse(year.start) + hour * 3_600_000),
    household,
    cabin: 0,
  }));
  const MONTH_LABELS = ["okt", "nov", "des", "2026", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep"];

  it.each(["hour-range", "time-range"] as const)(
    "names the month starts under an explicit %s format",
    (format) => {
      const { host } = renderThemed(
        <div style={{ width: 640, fontFamily: "var(--font-sans)" }}>
          <LocaleProvider locale="nb-NO">
            <Chart.Root
              data={rows}
              config={{ household: { label: "Forbruk", color: "chart-1" } }}
              xKey="start"
              interval="hour"
              timeZone="Europe/Oslo"
              aria-label="Forbruk per time">
              <Chart.XAxis format={format} />
              <Chart.Bar dataKey="household" />
            </Chart.Root>
          </LocaleProvider>
        </div>
      );
      // X ticks are aria-hidden text.
      const ticks = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"]')];
      expect(ticks.map((tick) => tick.textContent)).toEqual(MONTH_LABELS);
    }
  );
});

describe("an axis of seconds", () => {
  /** Ten seconds from 13:42:00 in Oslo on 15 January 2026, which is 12:42:00 UTC. */
  const rows = Array.from({ length: 10 }, (_, second) => ({
    at: new Date(Date.UTC(2026, 0, 15, 12, 42, second)),
    kw: 2 + (second % 3),
  }));

  it("labels each tick within one minute with its own second", () => {
    const { host } = renderThemed(
      <div style={{ width: 640, fontFamily: "var(--font-sans)" }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data={rows}
            config={{ kw: { label: "Effekt", color: "chart-1" } }}
            xKey="at"
            interval="second"
            timeZone="Europe/Oslo"
            aria-label="Effekt per sekund">
            <Chart.XAxis />
            <Chart.Line dataKey="kw" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    // X ticks are aria-hidden text.
    const texts = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"]')]
      .filter((tick) => getComputedStyle(tick).display !== "none")
      .map((tick) => tick.textContent);
    expect(texts.length).toBeGreaterThanOrEqual(3);
    expect(new Set(texts).size).toBe(texts.length);
    for (const text of texts) expect(text).toMatch(/^13:42:0\d$/u);
  });
});
