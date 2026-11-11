// RadialChart's rings and readouts in Chromium, and the polar quality looks of both families.
// Units under test: RadialChart.Bar, Track, Glow and the Center parts under RadialChart.Root, and
// PieChart.Pie and Track for quality and the gauge's corners. Oracles, written by hand: CONTRACT
// section 8.4's rings, three of them splitting the band from 0.3 to 1, each filling its value over
// its maximum and never lapping; the browser's own stroke test, which the pick must agree with;
// D24's device pixel of arc; Q12's 40 dots and 6° segments; section 8.7's hatched estimate and
// missing reading; the Motion table's hover scales; section 8.13's centre; and S9's category word.
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import {
  activeSlice,
  centreText,
  clientPoint,
  dialPoint,
  hoverAt,
  radialSvg,
  rings,
} from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig, ChartQuality } from "./chart-types";
import "./chart.css";
import { RadialChart } from "./radial-chart-namespace";

/** A budget row, its quality column optional. */
type BudgetRow = {
  readonly budget: string;
  readonly kwh: number;
  readonly limit: number;
  readonly q?: ChartQuality;
};

/** 412 of 500 fills 296.64°, 168 of 200 fills 302.4°, and 233 of 180 passes its maximum: 360°. */
const BUDGETS: readonly BudgetRow[] = [
  { budget: "heating", kwh: 412, limit: 500 },
  { budget: "water", kwh: 168, limit: 200 },
  { budget: "car", kwh: 233, limit: 180 },
];

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 0 } as const;

const BUDGET_CONFIG = {
  heating: { label: "Varme", color: "chart-1", format: energy },
  water: { label: "Varmtvann", color: "chart-2", format: energy },
  car: { label: "Elbil", color: "chart-3", format: energy },
} as const satisfies ChartConfig;

/** The rings' centre lines: three bands of 0.7 / 3 from the rim inward. */
const RADII = [1 - 0.7 / 6, 1 - 0.7 / 2, 1 - (5 * 0.7) / 6];

function Budgets({
  data = BUDGETS,
  config = BUDGET_CONFIG,
  variant,
  children,
}: {
  readonly data?: readonly BudgetRow[];
  readonly config?: ChartConfig;
  readonly variant?: "default" | "dotted";
  readonly children?: React.ReactNode;
}) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 320 }}>
        <RadialChart.Root
          data={data}
          config={config}
          nameKey="budget"
          valueKey="kwh"
          maxKey="limit"
          qualityKey="q"
          data-intro="none"
          aria-label="Budsjett">
          <RadialChart.Bar variant={variant} />
          {children}
        </RadialChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** How far a ring's dash reaches along its sweep, in degrees, its round caps included. */
function extent(path: SVGPathElement): number {
  const length = Number((path.getAttribute("stroke-dasharray") ?? "").split(" ")[0]);
  const start = -Number(path.getAttribute("stroke-dashoffset"));
  const cap = path.getAttribute("stroke-linecap") === "round" ? start : 0;
  return start + length + cap;
}

describe("the rings (section 8.4, Q5, Q8)", () => {
  it("strokes each ring up to its value's angle, the third past its maximum all round, and picks the ring under the pointer", async () => {
    const { host } = renderThemed(<Budgets />);
    await nextFrames(1);
    const drawn = rings(host);
    expect(drawn).toHaveLength(3);
    // Each ring holds the middle of its value on its centre line, and no other ring does.
    [148, 151, 180].forEach((angle, index) => {
      const point = dialPoint(angle, RADII[index] ?? 0);
      expect(drawn.map((path) => path.isPointInStroke(point))).toEqual(
        drawn.map((_, other) => other === index)
      );
    });
    // Each ring's dash ends where its value does: from 0, its start past the round cap, its length
    // and the cap again reach 296.64°, 302.4° and the whole 360°. Chromium's own stroke test stops
    // short of a dash that pathLength scales, so the extent reads from the dash itself.
    expect(drawn.map((path) => Math.round(extent(path) * 100) / 100)).toEqual([296.64, 302.4, 360]);
    // The ring group states data-over-max, which the stylesheet and consumers read.
    expect(
      [...host.querySelectorAll("[data-chart-ring]:not([data-chart-ring-track])")].map((ring) =>
        ring.hasAttribute("data-over-max")
      )
    ).toEqual([false, false, true]);
    // Every point of a 13 × 13 grid inside one ring's stroke picks that ring.
    const svg = radialSvg(host);
    let checked = 0;
    for (let row = 0; row < 13; row += 1) {
      for (let column = 0; column < 13; column += 1) {
        const point = new DOMPoint(
          Math.round((-0.96 + (column * 1.92) / 12) * 1e6) / 1e6,
          Math.round((-0.96 + (row * 1.92) / 12) * 1e6) / 1e6
        );
        const owner = drawn.findIndex((path) => path.isPointInStroke(point));
        if (owner === -1) continue;
        await hoverAt(...clientPoint(svg, point.x, point.y));
        expect(activeSlice(host)).toBe(owner);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
});

describe("the radial centre (section 8.13)", () => {
  it("prints the sum of the values over the sum of the maxima, then the active ring's own", async () => {
    // 412 + 168 + 233 = 813 of 500 + 200 + 180 = 880, 92 %.
    const { host } = renderThemed(
      <Budgets>
        <RadialChart.Center>
          <RadialChart.CenterValue />
          <RadialChart.CenterShare />
          <RadialChart.CenterMax />
        </RadialChart.Center>
      </Budgets>
    );
    expect(centreText(host, "pie-chart-center-value")).toBe("813 kWh");
    expect(centreText(host, "pie-chart-center-share")).toBe("92 %");
    expect(centreText(host, "pie-chart-center-max")).toBe("880 kWh");
    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}");
    expect(centreText(host, "pie-chart-center-value")).toBe("168 kWh");
    expect(centreText(host, "pie-chart-center-share")).toBe("84 %");
    expect(centreText(host, "pie-chart-center-max")).toBe("200 kWh");
  });
});
