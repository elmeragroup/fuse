import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { bars } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig, ChartQuality } from "./chart-types";
import "./chart.css";

const TWO = {
  a: { label: "A", color: "chart-1" },
  b: { label: "B", color: "chart-2" },
} as const satisfies ChartConfig;

describe("emphasis", () => {
  it("selects every tied maximum and speaks the dictionary word in the option", async () => {
    const rows = [1, 3, 3, 2].map((a, index) => ({ name: `k${String(index + 1)}`, a, b: 0 }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <Chart.Root data-intro="none" data={rows} config={TWO} xKey="name" aria-label="Uthevet">
          <Chart.Bar dataKey="a" emphasis="max" />
        </Chart.Root>
      </LocaleProvider>
    );
    expect(bars(host).map((bar) => bar.hasAttribute("data-emphasis"))).toEqual([false, true, true, false]);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}{ArrowRight}{ArrowDown}");
    // The option moves focus to its new element after the commit, so the check waits for it.
    await expect.poll(() => document.activeElement?.getAttribute("aria-label")).toBe("A 3, uthevet, k2");
  });
});

// Bar options in Chromium. Oracle: the quality and projection words each option speaks after its
// value, written by hand.
describe("quality and projection words", () => {
  it("speaks each reading's quality and projection after its value", async () => {
    const qualities: (ChartQuality | undefined)[] = [undefined, "estimated", "corrected", undefined];
    const rows = [1, 2, 3, 4].map((date, index) => ({
      day: new Date(Date.UTC(2025, 9, date, -2)),
      kwh: date === 4 ? null : 10 + date,
      q: qualities[index] ?? (date === 4 ? "missing" : undefined),
    }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <Chart.Root
          data={rows}
          config={{
            kwh: {
              label: "Forbruk",
              color: "chart-1",
              qualityKey: "q",
              projectedFrom: new Date(Date.UTC(2025, 9, 3, -2)),
              format: { preset: "energy", unit: "kWh" },
            },
          }}
          xKey="day"
          interval="day"
          timeZone="Europe/Oslo"
          aria-label="Forbruk per dag">
          <Chart.Bar dataKey="kwh" />
        </Chart.Root>
      </LocaleProvider>
    );
    host.querySelector("button")?.focus();
    const names: (string | null)[] = [];
    await userEvent.keyboard("{Tab}");
    names.push(document.activeElement?.getAttribute("aria-label") ?? null);
    for (let step = 0; step < 3; step += 1) {
      await userEvent.keyboard("{ArrowRight}");
      names.push(document.activeElement?.getAttribute("aria-label") ?? null);
    }
    expect(names).toEqual([
      "onsdag 1. oktober: Forbruk 11 kilowattimer",
      "torsdag 2. oktober: Forbruk 12 kilowattimer, estimert",
      "fredag 3. oktober: Forbruk 13 kilowattimer, korrigert, prognose",
      "lørdag 4. oktober: Forbruk mangler",
    ]);
  });
});
