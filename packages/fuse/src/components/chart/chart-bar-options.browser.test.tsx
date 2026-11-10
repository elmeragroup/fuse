// The catalogue-option judges of ticket 05 in Chromium. Oracles: the entrance of
// motion-decision.md rule 1, where every bar starts on its own base when Root first mounts in the
// browser and data-intro="none" starts none (layout/bar-geometry.zones.test.ts pins each origin's
// 16 ms steps); section 8.9's diverging bins for a hand-written
// series whose largest magnitude is 6; T137's 3 px dot on each drawn tick's band centre; and
// section 8.7's quality and projection words in the option, all written by hand.
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartQuality } from "./chart-types";
import "./chart.css";

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
