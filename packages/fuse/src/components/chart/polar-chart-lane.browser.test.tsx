// The polar tooltip's side lanes, in Chromium with motion on. Units under test: the polar tooltip's
// lane anchor over PieChart, RadialChart, RadarChart and ClockChart (MOTION-REVIEW Fix R2, R2.10,
// R2.11, R2.14). Oracles: the rendered boxes of every label past the rim, of the Root's figure and
// of a title above it, which the popup may never overlap or leave, with the active ray every 15°
// round the dial; and the lane rule, which keeps a lane until the ray is 20° into the other half, so
// a pointer that turns from 9 o'clock through 12 to 3 o'clock switches lanes once, and one that
// wiggles 15° either side of 12 o'clock switches none.
import type { ReactElement } from "react";

import { beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { clientPoint, dialPoint, hoverAt, polarFigure } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";

beforeEach(async () => {
  await page.viewport(1024, 900);
});

const DAY = Date.parse("2025-10-24T22:00:00Z");
const KEYS = Array.from({ length: 24 }, (_, index) => `k${String(index)}`);
const CONFIG: ChartConfig = Object.fromEntries(
  KEYS.map((key) => [key, { label: `Del ${key}`, color: "chart-1" as const }])
);

/** Each family with 24 options, whose active rays lie 15° apart round the dial. */
const FAMILIES: readonly (readonly [string, ReactElement])[] = [
  [
    "a pie of 24 equal slices",
    <PieChart.Root
      key="pie"
      data={KEYS.map((part) => ({ part, kr: 10 }))}
      config={CONFIG}
      nameKey="part"
      valueKey="kr"
      maxSlices={24}
      data-intro="none"
      aria-label="Regning">
      <PieChart.Pie />
      <PieChart.Labels position="outside" />
      <PieChart.Tooltip />
    </PieChart.Root>,
  ],
  [
    "a radial chart of 24 rings ending 15° apart",
    <RadialChart.Root
      key="radial"
      data={KEYS.map((budget, index) => ({ budget, kwh: 15 * (index + 1) }))}
      config={CONFIG}
      nameKey="budget"
      valueKey="kwh"
      max={360}
      data-intro="none"
      aria-label="Budsjett">
      <RadialChart.Track />
      <RadialChart.Bar />
      <RadialChart.Tooltip />
    </RadialChart.Root>,
  ],
  [
    "a radar of 24 spokes",
    <RadarChart.Root
      key="radar"
      data={KEYS.map((spoke, index) => ({ spoke: `T${String(index)}`, NO1: 2 + (index % 3) }))}
      config={{ NO1: { label: "NO1", color: "chart-1" } }}
      nameKey="spoke"
      data-intro="none"
      aria-label="Radar">
      <RadarChart.Grid />
      <RadarChart.AngleAxis />
      <RadarChart.Line dataKey="NO1" />
      <RadarChart.Tooltip />
    </RadarChart.Root>,
  ],
  [
    "a clock of 24 hours",
    <ClockChart.Root
      key="clock"
      data={Array.from({ length: 24 }, (_, hour) => ({ start: DAY + hour * 3_600_000, kwh: 1 + (hour % 4) }))}
      config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
      xKey="start"
      cycle="day"
      interval="hour"
      data-intro="none"
      aria-label="Døgn">
      <ClockChart.Grid />
      <ClockChart.AngleAxis />
      <ClockChart.Line dataKey="kwh" />
      <ClockChart.Tooltip />
    </ClockChart.Root>,
  ],
];

type Box = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

function overlap(a: Box, b: Box): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

/** The open popup and its positioner. */
function popup(): { readonly box: DOMRect; readonly side: string | null } | null {
  // DOM audit: the tooltip is aria-hidden and portalled, read by its slot.
  const node = document.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
  if (node === null || Number(getComputedStyle(node).opacity) < 0.5) return null;
  const box = node.getBoundingClientRect();
  if (box.width === 0) return null;
  return {
    box,
    side: node.closest('[data-slot="chart-tooltip-positioner"]')?.getAttribute("data-side") ?? null,
  };
}

async function frames(count: number): Promise<void> {
  for (let frame = 0; frame < count; frame += 1)
    await new Promise((resolve) => requestAnimationFrame(resolve));
}

function Card({ children }: { readonly children: ReactElement }): ReactElement {
  return (
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <section style={{ width: 728, padding: 24 }}>
        <h2 style={{ margin: 0 }}>Forbruk per time</h2>
        {children}
      </section>
    </LocaleProvider>
  );
}

describe("the polar tooltip's side lanes (R2.10)", () => {
  it.each(FAMILIES)(
    "keeps the popup of %s off every label and the title, inside the figure, at every ray",
    async (_, chart) => {
      const { host } = renderThemed(<Card>{chart}</Card>);
      await userEvent.tab();
      const figure = polarFigure(host);
      const title = host.querySelector("h2");
      if (title === null) throw new Error("no title");
      const labels = [
        ...figure.querySelectorAll(
          '[data-slot$="angle-label"], [data-slot="pie-chart-label"], [data-slot$="value-label"], [data-slot$="radius-label"]'
        ),
      ]
        .map((label) => label.getBoundingClientRect())
        .filter((box) => box.width > 0);
      const bounds = figure.getBoundingClientRect();
      const faults: string[] = [];
      for (let step = 0; step < 24; step += 1) {
        await frames(14);
        const shown = popup();
        if (shown === null) {
          faults.push(`step ${String(step)}: no popup`);
        } else {
          const { box } = shown;
          if (labels.some((label) => overlap(box, label) > 0))
            faults.push(`step ${String(step)}: over a label`);
          if (overlap(box, title.getBoundingClientRect()) > 0)
            faults.push(`step ${String(step)}: over the title`);
          if (
            box.left < bounds.left - 0.5 ||
            box.right > bounds.right + 0.5 ||
            box.top < bounds.top - 0.5 ||
            box.bottom > bounds.bottom + 0.5
          )
            faults.push(`step ${String(step)}: outside the figure`);
        }
        await userEvent.keyboard("{ArrowRight}");
      }
      expect(faults).toEqual([]);
    }
  );
});

describe("the polar tooltip's lane switches (R2.11)", () => {
  /** Turn the pointer round the clock at 0.8 R through the angles given, and count lane changes. */
  async function switches(host: HTMLElement, angles: readonly number[]): Promise<number> {
    // DOM audit: the line layer is aria-hidden plot output, read by its slot, for its screen CTM.
    const layer = host.querySelector<SVGSVGElement>('[data-slot="clock-chart-line"]');
    if (layer === null) throw new Error("no layer");
    const sides: (string | null)[] = [];
    for (const angle of angles) {
      const point = dialPoint(angle, 0.8);
      await hoverAt(...clientPoint(layer, point.x, point.y));
      await frames(1);
      const shown = popup();
      if (shown !== null) sides.push(shown.side);
    }
    return sides.filter((side, index) => index > 0 && side !== sides[index - 1]).length;
  }

  const clock = (FAMILIES[3] ?? FAMILIES[0])?.[1];

  it("switches once on a turn from 9 o'clock through 12 to 3 o'clock", async () => {
    const { host } = renderThemed(<Card>{clock ?? <span />}</Card>);
    expect(
      await switches(
        host,
        Array.from({ length: 37 }, (_, step) => 270 + 5 * step)
      )
    ).toBe(1);
  });

  it("switches none on a wiggle 15° either side of 12 o'clock", async () => {
    const { host } = renderThemed(<Card>{clock ?? <span />}</Card>);
    const wiggle = Array.from({ length: 24 }, (_, step) => 15 * Math.sin((step * Math.PI) / 4));
    expect(await switches(host, wiggle)).toBe(0);
  });
});
