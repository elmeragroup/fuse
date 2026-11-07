// A pointer that heads for a polar tooltip, in Chromium. Units under test: the polar surface's pick
// and the tooltip's popup in its side lane, on a RadialChart, a PieChart and a ClockChart. Oracle:
// CONTRACT section 9.5's hoverable tooltip and its safe triangle, past the rim only: a
// pointer that moves straight from the active part to its popup keeps
// that part over the label band and the gap between the rim and the popup, so the popup keeps the
// part's label until the pointer rests on it; and inside the dial the pick always wins, so a point
// on the triangle's own median that lies over another part takes that part. Each start is worked by
// hand: the outer ring's centre line sits 0.7 / 12 in from the rim and its 75 of 100 ends at 270°;
// the pie's Strøm of 50, 30 and 20 spans 0° to 180°; hour 6 of 24 spans 90° to 105°.
import type { ReactNode } from "react";

import { beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { label, pointerAt, popup } from "../../../test/chart/marks";
import { clientPoint, dialPoint } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";

beforeEach(async () => {
  await page.viewport(1024, 768);
});

/** Midnight in Oslo on 25 October 2025, a 24-hour day. */
const DAY = Date.parse("2025-10-24T22:00:00Z");

type Case = {
  readonly chart: ReactNode;
  /** Where the pointer starts, as an angle and a radius on the dial. */
  readonly start: readonly [number, number];
  /** The popup's label for the part at the start. */
  readonly label: string;
};

const CASES: readonly (readonly [string, Case])[] = [
  [
    "the outer ring of a radial chart",
    {
      chart: (
        <RadialChart.Root
          data={[
            { budget: "varme", kwh: 75 },
            { budget: "varmtvann", kwh: 50 },
            { budget: "elbil", kwh: 25 },
          ]}
          config={{
            varme: { label: "Varme", color: "chart-1" },
            varmtvann: { label: "Varmtvann", color: "chart-2" },
            elbil: { label: "Elbil", color: "chart-3" },
          }}
          nameKey="budget"
          valueKey="kwh"
          max={100}
          data-intro="none"
          aria-label="Budsjett">
          <RadialChart.Track />
          <RadialChart.Bar />
          <RadialChart.Tooltip />
        </RadialChart.Root>
      ),
      start: [260, 1 - 0.7 / 12],
      label: "Varme",
    },
  ],
  [
    "a slice of a pie",
    {
      chart: (
        <PieChart.Root
          data={[
            { part: "strom", kr: 50 },
            { part: "nettleie", kr: 30 },
            { part: "avgift", kr: 20 },
          ]}
          config={{
            strom: { label: "Strøm", color: "chart-1" },
            nettleie: { label: "Nettleie", color: "chart-2" },
            avgift: { label: "Avgift", color: "chart-3" },
          }}
          nameKey="part"
          valueKey="kr"
          data-intro="none"
          aria-label="Regning">
          <PieChart.Pie />
          <PieChart.Tooltip />
        </PieChart.Root>
      ),
      start: [90, 0.9],
      label: "Strøm",
    },
  ],
  [
    "an hour of a clock dial",
    {
      chart: (
        <ClockChart.Root
          data={Array.from({ length: 24 }, (_, hour) => ({
            start: DAY + hour * 3_600_000,
            kwh: 1 + (hour % 4),
          }))}
          config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
          xKey="start"
          cycle="day"
          interval="hour"
          data-intro="none"
          aria-label="Døgn">
          <ClockChart.Column dataKey="kwh" />
          <ClockChart.Tooltip />
        </ClockChart.Root>
      ),
      start: [97.5, 0.95],
      label: "06–07",
    },
  ],
];

/** The polar plot's SVG, whose screen transform maps the dial's units to client pixels. */
function plotSvg(host: HTMLElement): SVGSVGElement {
  // DOM audit: the plot's SVG is aria-hidden plot output, read by its slot.
  const svg = host.querySelector<SVGSVGElement>('[data-slot="chart-polar-plot"]');
  if (svg === null) throw new Error("no plot");
  return svg;
}

describe("a pointer heading for a polar tooltip keeps its part past the rim", () => {
  it.each(CASES)(
    "keeps the popup of %s while the pointer crosses to it",
    async (_, { chart, start, label: name }) => {
      const { host } = renderThemed(
        <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
          <div style={{ width: 600, margin: 48 }}>{chart}</div>
        </LocaleProvider>
      );
      const point = dialPoint(...start);
      const [x, y] = clientPoint(plotSvg(host), point.x, point.y);
      await pointerAt(x, y);
      await expect.poll(label).toBe(name);
      const box = popup()?.getBoundingClientRect();
      if (box === undefined) throw new Error("no popup");
      // The popup's middle, reached in steps of a few pixels along a straight line.
      const end = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      const steps = Math.ceil(Math.hypot(end.x - x, end.y - y) / 4);
      const seen: (string | null)[] = [];
      for (let step = 1; step <= steps; step += 1) {
        await pointerAt(x + ((end.x - x) * step) / steps, y + ((end.y - y) * step) / steps);
        seen.push(label());
      }
      expect(seen.filter((shown) => shown !== name)).toEqual([]);
    }
  );

  it("takes another hour inside the dial, even inside the triangle to the popup", async () => {
    const clock = CASES[2];
    if (clock === undefined) throw new Error("no clock case");
    const [, { chart }] = clock;
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <div style={{ width: 600, margin: 48 }}>{chart}</div>
      </LocaleProvider>
    );
    // Hour 6 near the hole: its popup rests in the right lane.
    const start = dialPoint(97.5, 0.3);
    const [x, y] = clientPoint(plotSvg(host), start.x, start.y);
    await pointerAt(x, y);
    await expect.poll(label).toBe("06–07");
    const box = popup()?.getBoundingClientRect();
    if (box === undefined) throw new Error("no popup");
    // The triangle from the start to the popup's near edge, by the signs of its corners' cross products.
    const corners = [
      { x, y },
      { x: box.left, y: box.top },
      { x: box.left, y: box.bottom },
    ] as const;
    const side = (a: { x: number; y: number }, b: { x: number; y: number }, p: { x: number; y: number }) =>
      (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const inside = (p: { x: number; y: number }) => {
      const [a, b, c] = corners;
      const signs = [side(a, b, p), side(b, c, p), side(c, a, p)];
      return signs.every((value) => value >= 0) || signs.every((value) => value <= 0);
    };
    // A point on the dial at 0.9 R over hour 5, from 75° to 90°, that lies inside the triangle.
    const candidate = [88, 86, 84, 82, 80, 78, 76]
      .map((angle) => clientPoint(plotSvg(host), dialPoint(angle, 0.9).x, dialPoint(angle, 0.9).y))
      .find(([px, py]) => inside({ x: px, y: py }));
    if (candidate === undefined) throw new Error("no point over hour 5 inside the triangle");
    await pointerAt(...candidate);
    await expect.poll(label).toBe("05–06");
  });
});
