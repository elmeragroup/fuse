// The catalogue-option judges of ticket 05 in Chromium, Firefox and WebKit. Oracles: T138's delay
// list per data-intro value for a 5-bar fixture, from the catalogue's 16 ms step and evilcharts'
// left, right, centre-out and edges-in formulas; section 8.9's diverging bins for a hand-written
// series whose largest magnitude is 6; T137's 3 px dot on each drawn tick's band centre; and
// section 8.7's quality and projection words in the option, all written by hand.
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartIntro, ChartQuality } from "./chart-types";
import "./chart.css";

const FIVE = ["a", "b", "c", "d", "e"].map((name, index) => ({ name, v: index + 1 }));

function bars(host: HTMLElement): HTMLElement[] {
  // DOM audit: bars are aria-hidden plot output, so their slots are the only locator.
  return [...host.querySelectorAll<HTMLElement>('[data-slot="chart-bar"]')];
}

/** The delay of a bar's geometry transition, in milliseconds. */
function geometryDelay(bar: HTMLElement): number {
  const style = getComputedStyle(bar);
  const properties = style.transitionProperty.split(",").map((entry) => entry.trim());
  const delays = style.transitionDelay.split(",").map((entry) => Number.parseFloat(entry) * 1000);
  return delays[properties.indexOf("top") % delays.length] ?? Number.NaN;
}

describe("the entrance wipe origins", () => {
  it.each([
    ["left", [0, 16, 32, 48, 64]],
    ["right", [64, 48, 32, 16, 0]],
    ["center", [32, 16, 0, 16, 32]],
    ["edges", [0, 16, 32, 16, 0]],
  ] as const)("delays a %s wipe by these milliseconds", (intro, delays) => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={FIVE}
          config={{ v: { label: "V", color: "chart-1" } }}
          xKey="name"
          data-intro={intro}
          aria-label="Fem">
          <Chart.Bar dataKey="v" />
        </Chart.Root>
      </LocaleProvider>
    );
    expect(bars(host).map((bar) => Math.round(geometryDelay(bar)))).toEqual(delays);
  });

  it("runs no entrance under none", () => {
    const intro: ChartIntro = "none";
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={FIVE}
          config={{ v: { label: "V", color: "chart-1" } }}
          xKey="name"
          data-intro={intro}
          aria-label="Fem">
          <Chart.Bar dataKey="v" />
        </Chart.Root>
      </LocaleProvider>
    );
    for (const bar of bars(host)) expect(bar.getAnimations()).toEqual([]);
  });
});

describe("diverging colour bins", () => {
  it("paints each bar the step its value bins into", () => {
    // M is 6. |v| / M of 1 and 1/3, 0, 1/6, 2/3 and 1 bin into steps 1, 3, 4, 5, 6 and 7.
    const rows = [-6, -2, 0, 1, 4, 6].map((v, index) => ({ name: `k${String(index)}`, v }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={rows}
          config={{ v: { label: "Pris", color: "chart-diverging" } }}
          xKey="name"
          aria-label="Pris">
          <Chart.Bar dataKey="v" />
        </Chart.Root>
      </LocaleProvider>
    );
    // DOM audit: Root's figure resolves the diverging roles.
    const root = getComputedStyle(host.querySelector('[data-slot="chart"]') ?? document.body);
    const role = (step: number) => root.getPropertyValue(`--chart-diverging-${String(step)}`).trim();
    // The zero bar draws a box of no height, painted the neutral step.
    const painted = bars(host).map((bar) =>
      getComputedStyle(bar).getPropertyValue("--chart-bar-paint").trim()
    );
    expect(painted).toEqual([1, 3, 4, 5, 6, 7].map(role));
  });
});

describe("the tick dot", () => {
  it("draws a 3 px dot at each drawn tick's band centre", () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root
            data={FIVE}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            aria-label="Fem">
            <Chart.XAxis tick="dot" />
            <Chart.Bar dataKey="v" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: x ticks are aria-hidden text, so their slot is the only locator.
    const axis = host.querySelector('[data-slot="chart-x-axis"]')?.getBoundingClientRect() ?? new DOMRect();
    const ticks = [...host.querySelectorAll('[data-slot="chart-x-tick"]')];
    expect(ticks).toHaveLength(5);
    ticks.forEach((tick, index) => {
      const dot = getComputedStyle(tick, "::before");
      expect(dot.width).toBe("3px");
      const box = tick.getBoundingClientRect();
      const centre = box.left + Number.parseFloat(dot.left) - axis.left;
      // Band centres of 5 slots over 400 px sit at 40, 120, 200, 280 and 360 px.
      expect(Math.abs(centre - (index * 80 + 40))).toBeLessThanOrEqual(0.5);
    });
  });
});

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
