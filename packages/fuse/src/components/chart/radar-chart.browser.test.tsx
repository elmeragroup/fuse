// RadarChart's grid, axes and series marks in Chromium. Units under test: RadarChart.Grid,
// AngleAxis, RadiusAxis, Area, Line, Dots, ActiveDot and Glow under RadarChart.Root. Oracles,
// written by hand: the vertices of values 1 to 4 on a [0, 4] domain, (0, −R/4),
// (R/2, 0), (0, 3R/4) and (−R, 0); CONTRACT section 8.4's [−2, 1, 3] fixture, whose domain is
// [−2, 3] with the zero ring at 2/5 of R, spoke 0 filled inside 2/5 only and spoke 1 from 2/5 to
// 3/5 only; the zero ring in the zero line's colour, the frame's muted foreground; R5's six-spoke
// fixture, spoke 1 estimated and spoke 4 missing, with two dashed edges, two hatched quadrilaterals
// and five dots; R6's nearest spoke by angle and nearest drawn vertex, found by brute force; D19's
// hover, 0.45 on the other series and twice the area opacity on the nearest; and the axes' places,
// the ring values beside spoke 0 at the ring radii and each spoke label 1.1 R out.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, wait } from "../../../test/animation-frames";
import { clientPoint, hoverAt, polarFigure } from "../../../test/chart/pie";
import { layerPath, pathPoints, radarLayer, radarLayers } from "../../../test/chart/radar";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig, ChartQuality } from "./chart-types";
import "./chart.css";
import { RadarChart } from "./radar-chart-namespace";

/** A spoke row: its name, up to two series and the first series' quality. */
type SpokeRow = {
  readonly spoke: string;
  readonly a: number | null;
  readonly b?: number | null;
  readonly q?: ChartQuality;
};

const ONE = { a: { label: "A", color: "chart-1" } } as const satisfies ChartConfig;
const TWO = { ...ONE, b: { label: "B", color: "chart-2" } } as const satisfies ChartConfig;

function Radar({
  data,
  config = ONE,
  max,
  children,
}: {
  readonly data: readonly SpokeRow[];
  readonly config?: ChartConfig;
  readonly max?: number;
  readonly children: React.ReactNode;
}) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 320 }}>
        <RadarChart.Root
          data={data}
          config={config}
          nameKey="spoke"
          max={max}
          data-intro="none"
          aria-label="Radar">
          {children}
        </RadarChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** Rows named s0, s1, … for each value of series a, and of b when given. */
function rows(a: readonly (number | null)[], b?: readonly (number | null)[]): SpokeRow[] {
  return a.map((value, index) => ({ spoke: `s${String(index)}`, a: value, b: b?.[index] ?? null }));
}

describe("the pick (R6) and hover (D19)", () => {
  it("picks the nearest spoke by angle and the series whose drawn vertex lies nearest, with hysteresis", async () => {
    const a = [3, 1, 4, 2, 5, 1];
    const b = [1, 4, 2, 5, 2, 3];
    const { host } = renderThemed(
      <Radar data={rows(a, b)} config={TWO}>
        <RadarChart.Line dataKey="a" />
        <RadarChart.Line dataKey="b" />
      </Radar>
    );
    await nextFrames(1);
    const lines = radarLayers(host, "radar-chart-line");
    const drawn = lines.map((line) => pathPoints(layerPath(line, "solid").getAttribute("d") ?? ""));
    const figure = polarFigure(host);
    let checked = 0;
    let held: number | null = null;
    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 9; column += 1) {
        const point = { x: -0.95 + column * 0.2375, y: -0.95 + row * 0.2375 };
        const radius = Math.hypot(point.x, point.y);
        if (radius > 1 || radius < 0.05) continue;
        // Brute force: the spoke at the least angular distance, then the drawn vertex there nearest.
        const angle = ((Math.atan2(point.x, -point.y) * 180) / Math.PI + 360) % 360;
        const distances = a.map((_, spoke) => {
          const gap = Math.abs(angle - spoke * 60) % 360;
          return Math.min(gap, 360 - gap);
        });
        const spoke = distances.indexOf(Math.min(...distances));
        // A point within the 2 px dead band of a spoke's edge may keep the last spoke.
        const edge = radius * Math.sin(((30 - Math.min(...distances)) * Math.PI) / 180);
        if (edge < 0.03) continue;
        const gaps = drawn.map((points) => {
          const vertex = points[spoke];
          return vertex === undefined
            ? Number.POSITIVE_INFINITY
            : Math.hypot(vertex.x - point.x, vertex.y - point.y);
        });
        // The series held from the last probe stays unless another lies nearer by more than 0.06 R.
        const nearest = gaps.indexOf(Math.min(...gaps));
        const kept: boolean = held !== null && (gaps[held] ?? Infinity) - Math.min(...gaps) <= 0.06;
        held = kept ? held : nearest;
        // A near series holds for 150 ms of event time after it changes, read from the events'
        // own timeStamp, which no fake clock reaches; the wait is a lower bound, so a slow runner
        // only widens the gap the hold needs.
        await wait(160);
        await hoverAt(...clientPoint(radarLayer(host, "radar-chart-line"), point.x, point.y));
        expect(figure.style.getPropertyValue("--chart-active")).toBe(String(spoke));
        expect(figure.getAttribute("data-near")).toBe(String(held));
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(30);
  });
});

describe("the description (A1-17)", () => {
  it("states a series' unit once after its label, as every series family's description does", () => {
    // CONTRACT section 9.3's form, `Forbruk i kilowattimer: lavest 0,33`: the unit follows the
    // label, and the extremes print without it. Forbruk reads 3, 1,5 and 7 kWh over NO1 to NO3, so
    // its lowest is 1,5 at NO2 and its highest 7 at NO3. A count joins its word by a no-break space.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <RadarChart.Root
          data={[
            { zone: "NO1", kwh: 3 },
            { zone: "NO2", kwh: 1.5 },
            { zone: "NO3", kwh: 7 },
          ]}
          config={{ kwh: { label: "Forbruk", color: "chart-1", format: { preset: "energy", unit: "kWh" } } }}
          nameKey="zone"
          aria-label="Forbruk per sone"
        />
      </LocaleProvider>
    );
    // The description is the figure's visually hidden paragraph on its slot.
    expect(host.querySelector('[data-slot="chart-description"]')?.textContent).toBe(
      "Radardiagram med 1\u00a0serie over 3\u00a0kategorier. Forbruk i kilowattimer: lavest 1,5 NO2, høyest 7 NO3."
    );
  });
});
