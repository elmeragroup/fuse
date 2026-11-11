// A screen reader's key sequence through each polar family, in Chromium. Units under test:
// PieChart.Root, RadialChart.Root, RadarChart.Root and ClockChart.Root. Oracle: CONTRACT section
// 9.4's option grammar in Norwegian Bokmål, written by hand in vsr's phrase grammar: role, name,
// state, position and set size joined by ", ".
import { virtual } from "@guidepup/virtual-screen-reader";
import { afterEach, describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { BILL, BILL_CONFIG, SPOKE_CONFIG, SPOKES } from "../../../test/chart/polar-fixtures";
import { phrasesAfter, startReader as start } from "../../../test/chart/spoken";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";

afterEach(async () => {
  await virtual.stop();
});

describe("a screen reader's key sequence through each family", () => {
  /** Midnight in Oslo on 25 October 2025, a 24-hour day. */
  const day = Date.parse("2025-10-24T22:00:00Z");
  const families = [
    {
      family: "pie",
      chart: (
        <PieChart.Root data={BILL} config={BILL_CONFIG} nameKey="name" valueKey="v" aria-label="Regning" />
      ),
      keys: [
        ["Tab", 1],
        ["ArrowRight", 1],
        ["End", 1],
        ["Home", 1],
        ["Escape", 1],
      ] as const,
      first:
        /^option, Strøm: 50, 50\sprosent, Kakediagram med 4\sdeler, .*, not selected, position 1, set size 4$/u,
      then: [
        "option, Nettleie: 30, 30\u00a0prosent, not selected, position 2, set size 4",
        "option, Mva: 5, 5\u00a0prosent, not selected, position 4, set size 4",
        "option, Strøm: 50, 50\u00a0prosent, not selected, position 1, set size 4",
        "option, Strøm: 50, 50\u00a0prosent, not selected, position 1, set size 4",
      ],
    },
    {
      family: "radial",
      chart: (
        <RadialChart.Root
          data={BILL}
          config={BILL_CONFIG}
          nameKey="name"
          valueKey="v"
          max={50}
          aria-label="Ringer"
        />
      ),
      keys: [
        ["Tab", 1],
        ["ArrowDown", 1],
        ["End", 1],
        ["Home", 1],
        ["Escape", 1],
      ] as const,
      first:
        /^option, Strøm: 50 av 50, Ringdiagram med 4\sringer\. .*, not selected, position 1, set size 4$/u,
      then: [
        "option, Nettleie: 30 av 50, not selected, position 2, set size 4",
        "option, Mva: 5 av 50, not selected, position 4, set size 4",
        "option, Strøm: 50 av 50, not selected, position 1, set size 4",
        "option, Strøm: 50 av 50, not selected, position 1, set size 4",
      ],
    },
    {
      family: "radar",
      chart: <RadarChart.Root data={SPOKES} config={SPOKE_CONFIG} nameKey="area" aria-label="Områder" />,
      keys: [
        ["Tab", 1],
        ["ArrowRight", 1],
        ["End", 1],
        ["Home", 1],
        ["Escape", 1],
      ] as const,
      first:
        /^option, NO1: Forbruk 1, Pris 3, Radardiagram med 2\sserier over 3\skategorier\. .*, not selected, position 1, set size 3$/u,
      then: [
        "option, NO2: Forbruk 2, Pris 2, not selected, position 2, set size 3",
        "option, NO3: Forbruk 3, Pris 1, not selected, position 3, set size 3",
        "option, NO1: Forbruk 1, Pris 3, not selected, position 1, set size 3",
        "option, NO1: Forbruk 1, Pris 3, not selected, position 1, set size 3",
      ],
    },
    {
      family: "clock",
      chart: (
        <ClockChart.Root
          data={Array.from({ length: 24 }, (_, hour) => ({ start: day + hour * 3_600_000, kwh: hour }))}
          config={{ kwh: { label: "kWh", color: "chart-1" } }}
          xKey="start"
          cycle="day"
          interval="hour"
          aria-label="Døgn"
        />
      ),
      keys: [
        ["Tab", 1],
        ["ArrowRight", 1],
        ["PageDown", 1],
        ["PageUp", 1],
        ["End", 1],
        ["Home", 1],
        ["Escape", 1],
      ] as const,
      first:
        /^option, kl\.\s00\stil\s01: kWh 0, Klokkediagram med 1\sserie\. .*, not selected, position 1, set size 24$/u,
      then: [
        "option, kl.\u00a001\u00a0til\u00a002: kWh 1, not selected, position 2, set size 24",
        "option, kl.\u00a007\u00a0til\u00a008: kWh 7, not selected, position 8, set size 24",
        "option, kl.\u00a001\u00a0til\u00a002: kWh 1, not selected, position 2, set size 24",
        "option, kl.\u00a023\u00a0til\u00a024: kWh 23, not selected, position 24, set size 24",
        "option, kl.\u00a000\u00a0til\u00a001: kWh 0, not selected, position 1, set size 24",
        "option, kl.\u00a000\u00a0til\u00a001: kWh 0, not selected, position 1, set size 24",
      ],
    },
  ];

  it.each(families)(
    "speaks the $family chart's options through Tab, arrows, Home, End and Escape",
    async ({ chart, keys, first, then }) => {
      const { host } = renderThemed(
        <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
          <button type="button">før</button>
          {chart}
        </LocaleProvider>
      );
      await start(host);
      const heard = await phrasesAfter(keys);
      // Tab enters on the first option with the chart's description, each key moves the option, and
      // Escape leaves focus on it with nothing new to say.
      expect(heard[0]).toMatch(first);
      expect(heard.slice(1)).toEqual(then);
    }
  );
});
