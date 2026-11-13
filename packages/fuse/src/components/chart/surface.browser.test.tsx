// Unit under test: the colour a chart's cut-outs paint in each host a chart rests on, through
// `--surface` in chart.css and the hosts' recipes. Oracle: the host's own computed
// `background-color`, which the browser resolves from the host's fill class and never from the
// chart CSS, and in light themes the white every Card, `Frame.Panel`, framed Table cell, default
// Alert, bordered VerticalTable box and outline Item promises through the `panel` and `card` roles.
// A translucent host keeps the surface beneath it, so its oracle is the fill of the element around it.
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { SURFACE_HOSTS } from "../../../test/surface-hosts";
import {
  THEMED,
  renderIn,
  restoreDocumentThemeAroundEach,
  srgb,
  surfaceAt,
} from "../../../test/surface-paint";
import { computedContrast, stampDensity } from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { Chart } from "./chart-namespace";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";

restoreDocumentThemeAroundEach();

const rows = [
  { month: "Jan", kwh: 1200 },
  { month: "Feb", kwh: 1400 },
  { month: "Mar", kwh: 1000 },
];

const shares = [
  { part: "energy", kr: 60 },
  { part: "grid", kr: 40 },
];

/** A line chart with default dots, whose rings are cut-outs, and a pie, whose seams are. */
function Charts(): ReactElement {
  return (
    <div style={{ width: 320 }}>
      <Chart.Root
        data={rows}
        config={{ kwh: { label: "Usage", color: "chart-1" } }}
        xKey="month"
        data-intro="none"
        aria-label="Usage per month">
        <Chart.Line dataKey="kwh" />
        <Chart.Dots dataKey="kwh" />
      </Chart.Root>
      <PieChart.Root
        data={shares}
        config={{ energy: { label: "Energy", color: "chart-1" }, grid: { label: "Grid", color: "chart-2" } }}
        nameKey="part"
        valueKey="kr"
        data-intro="none"
        aria-label="Bill">
        <PieChart.Pie />
      </PieChart.Root>
    </div>
  );
}

/** The stroke of the first default dot's ring and of the first pie seam in the host, once drawn. */
async function cutOutStrokes(host: HTMLElement): Promise<{ ring: string; seam: string }> {
  // DOM audit: dots and slices are aria-hidden plot output, so their slots are the only locators.
  await expect.poll(() => host.querySelector('[data-slot="chart-dot"]')).not.toBeNull();
  await expect.poll(() => host.querySelector('[data-slot="pie-chart-sector"]')).not.toBeNull();
  const dot = host.querySelector('[data-slot="chart-dot"]');
  const sector = host.querySelector('[data-slot="pie-chart-sector"]');
  if (dot === null || sector === null) throw new Error("expected a dot and a pie slice");
  return { ring: getComputedStyle(dot).stroke, seam: getComputedStyle(sector).stroke };
}

describe("chart cut-outs", () => {
  for (const { theme, scheme, name } of THEMED) {
    it.each(SURFACE_HOSTS)(
      `paint the fill of $label in ${name}`,
      async ({ node, element, whiteInLight, beneath }) => {
        renderIn(theme, scheme, node(<Charts />));
        const host = await element();
        const fill = getComputedStyle(beneath === undefined ? host : await beneath()).backgroundColor;
        const { ring, seam } = await cutOutStrokes(host);
        expect(srgb(ring)).toEqual(srgb(fill));
        expect(srgb(seam)).toEqual(srgb(fill));
        if (whiteInLight && scheme === "light") expect(srgb(fill)).toEqual([1, 1, 1, 1]);
      }
    );
  }
});

// Unit under test: the text a chart writes on a chip or halo of its surface, the clock's and
// radar's ring values, the clock's Now label in the default and the muted tone, the value pill,
// and a reference label, in each host at both densities. Oracle: WCAG 1.4.3, 4.5:1 for these
// small labels, measured between the text colour and the colour of the chip or halo it sits on,
// as the browser computes them.
const CHIP_START = Date.parse("2025-10-26T23:00:00Z");
const CHIP_HOURS = Array.from({ length: 24 }, (_, hour) => ({
  start: CHIP_START + hour * 3_600_000,
  kwh: 1 + (hour % 4),
}));

const SPOKES = [
  { spoke: "North", kwh: 1 },
  { spoke: "East", kwh: 2 },
  { spoke: "South", kwh: 3 },
  { spoke: "West", kwh: 4 },
];

const TONES = ["default", "muted"] as const;

/** A clock with ring values, a labelled Now and a value pill, a radar with ring values, and a line with a reference label. */
function Chips({ tone }: { tone: (typeof TONES)[number] }): ReactElement {
  return (
    <div style={{ width: 320 }}>
      <ClockChart.Root
        data={CHIP_HOURS}
        config={{ kwh: { label: "kWh", color: "chart-1" } }}
        xKey="start"
        cycle="day"
        interval="hour"
        now={CHIP_START + 9.5 * 3_600_000}
        data-intro="none"
        aria-label="Usage per hour">
        <ClockChart.Column dataKey="kwh" />
        <ClockChart.RadiusAxis />
        <ClockChart.Now label="Now" tone={tone} />
        <ClockChart.Marker dataKey="kwh" at="now">
          <ClockChart.ValueLabel />
        </ClockChart.Marker>
      </ClockChart.Root>
      <RadarChart.Root
        data={SPOKES}
        config={{ kwh: { label: "kWh", color: "chart-1" } }}
        nameKey="spoke"
        data-intro="none"
        aria-label="Usage per direction">
        <RadarChart.Line dataKey="kwh" />
        <RadarChart.RadiusAxis />
      </RadarChart.Root>
      <Chart.Root
        data={rows}
        config={{ kwh: { label: "Usage", color: "chart-1" } }}
        xKey="month"
        data-intro="none"
        aria-label="Usage per month">
        <Chart.Line dataKey="kwh" />
        <Chart.ReferenceLine y={1300} label="Target" />
      </Chart.Root>
    </div>
  );
}

/** The chips and the halo label, with what each one's text sits on. */
const CHIPS = [
  { slot: '[data-slot="clock-chart-radius-label"]', backdrop: "chip" },
  { slot: '[data-slot="radar-chart-radius-label"]', backdrop: "chip" },
  { slot: '[data-slot="clock-chart-now"] > [data-part="label"]', backdrop: "chip" },
  { slot: '[data-slot="clock-chart-value-label"]', backdrop: "chip" },
  { slot: '[data-slot="chart-reference-label"]', backdrop: "halo" },
] as const;

describe("chart chips", () => {
  for (const density of DENSITIES) {
    for (const tone of TONES) {
      for (const { theme, scheme, name } of THEMED) {
        it.each(SURFACE_HOSTS)(
          `hold their text to 4.5:1 on $label with a ${tone} Now in ${name} at ${density} density`,
          async ({ node, element }) => {
            stampDensity(density);
            renderIn(theme, scheme, node(<Chips tone={tone} />));
            const host = await element();
            for (const { slot, backdrop } of CHIPS) {
              // DOM audit: the chips are aria-hidden plot output, so their slots are the only locators.
              await expect.poll(() => host.querySelector(slot), { message: slot }).not.toBeNull();
              const chip = host.querySelector(slot);
              if (chip === null) throw new Error(`expected ${slot}`);
              const style = getComputedStyle(chip);
              const behind = backdrop === "chip" ? style.backgroundColor : surfaceAt(chip);
              expect(computedContrast(style.color, behind), slot).toBeGreaterThanOrEqual(4.5);
            }
          }
        );
      }
    }
  }
});
