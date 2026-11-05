// RadialChart's rings and readouts in Chromium, and the polar quality looks of both families.
// Units under test: RadialChart.Bar, Track, Glow and the Center parts under RadialChart.Root, and
// PieChart.Pie and Track for quality and the gauge's corners. Oracles, written by hand: CONTRACT
// section 8.4's rings, three of them splitting the band from 0.3 to 1, each filling its value over
// its maximum and never lapping; the browser's own stroke test, which the pick must agree with (Q8);
// D24's device pixel of arc; Q12's 40 dots and 6° segments; section 8.7's hatched estimate and
// missing reading; the Motion table's hover scales; section 8.13's centre; and S9's category word.
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  activeSlice,
  centreText,
  clientPoint,
  dialPoint,
  hoverAt,
  radialSvg,
  rings,
  sectors,
} from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig, ChartQuality } from "./chart-types";
import "./chart.css";
import { PieChart } from "./pie-chart-namespace";
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

/** Wait for the frame's microtask paint after a commit. */
async function painted(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

/** Finish every running transition in the host, so styles show their rest. */
function settle(host: HTMLElement): void {
  for (const animation of host.getAnimations({ subtree: true })) animation.finish();
}

describe("the rings (section 8.4, Q5, Q8)", () => {
  it("strokes each ring up to its value's angle, the third past its maximum all round, and picks the ring under the pointer", async () => {
    const { host } = renderThemed(<Budgets />);
    await painted();
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
    // DOM audit: the ring group states data-over-max, which the stylesheet and consumers read.
    expect(
      [...host.querySelectorAll("[data-ring]:not([data-ring-track])")].map((ring) =>
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

  it("keeps a device pixel of arc along the centre line of a ring a hundred-thousandth full (D24)", async () => {
    const { host } = renderThemed(
      <Budgets
        data={[
          { budget: "heating", kwh: 0.002, limit: 200 },
          { budget: "water", kwh: 100, limit: 200 },
        ]}
      />
    );
    await painted();
    const [tiny] = rings(host);
    const radius = (radialSvg(host).getBoundingClientRect().width / 2) * (1 - 0.7 / 4);
    const length = Number((tiny?.getAttribute("stroke-dasharray") ?? "").split(" ")[0]);
    // The arc's extent is its dash in degrees, plus a stroke's width for round caps, which a ring
    // this short never takes.
    expect(tiny?.getAttribute("stroke-linecap")).toBe("butt");
    expect(((length * Math.PI) / 180) * radius).toBeGreaterThanOrEqual(1 / window.devicePixelRatio - 0.01);
  });

  it("fills whole dots of 40, its value's share of them, in the dotted look (Q12)", async () => {
    // 40 × 412 / 500 = 32.96, so 33 dots fill.
    const { host } = renderThemed(<Budgets variant="dotted" />);
    await painted();
    // DOM audit: the dotted ring's mask carries its value as a dash over the dots, read by its part.
    const mask = host.querySelector('[data-slot="radial-chart-ring"][data-part="mask"]');
    expect(Number((mask?.getAttribute("stroke-dasharray") ?? "").split(" ")[0]) / (360 / 40)).toBeCloseTo(
      33,
      6
    );
    expect(host.querySelectorAll('[data-slot="radial-chart-ring"][data-part="dots"]')).toHaveLength(6);
  });

  it("paints a role list along the sweep in 6° segments behind a mask that carries the value (Q12)", () => {
    const { host } = renderThemed(
      <Budgets
        config={{
          ...BUDGET_CONFIG,
          heating: { label: "Varme", color: ["chart-1", "chart-2"], format: energy },
        }}
      />
    );
    // DOM audit: the segments are the ring's paint, read by their part.
    expect(host.querySelectorAll('[data-slot="radial-chart-ring"][data-part="segment"]')).toHaveLength(60);
  });

  it("scales the active ring to 1.03 and the rings outside it to 1.02, and dims the rest", async () => {
    const { host } = renderThemed(<Budgets />);
    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}");
    settle(host);
    const groups = [...host.querySelectorAll("[data-ring]:not([data-ring-track])")];
    expect(groups.map((group) => getComputedStyle(group).scale)).toEqual(["1.02", "1.03", "1"]);
    expect(groups.map((group) => getComputedStyle(group).opacity)).toEqual(["0.45", "1", "0.45"]);
  });

  it("draws a whole track behind each ring, and haloes the named ring's own dash", async () => {
    const { host } = renderThemed(
      <Budgets>
        <RadialChart.Track />
        <RadialChart.Glow dataKey="water" />
        <RadialChart.LegendToggleGroup />
      </Budgets>
    );
    await painted();
    // DOM audit: tracks and the halo are aria-hidden plot output, read by their slots.
    const tracks = [...host.querySelectorAll('[data-slot="pie-chart-track"]')];
    expect(tracks).toHaveLength(3);
    expect(
      tracks.map((track) => (track instanceof SVGPathElement ? Math.round(extent(track) * 100) / 100 : 0))
    ).toEqual([360, 360, 360]);
    const halo = host.querySelector('[data-slot="pie-chart-glow"]');
    expect(halo?.getAttribute("stroke-dasharray")).toBe(rings(host)[1]?.getAttribute("stroke-dasharray"));
    expect(page.getByRole("group", { name: "Kategorier" }).elements()).toHaveLength(1);
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

describe("quality (section 8.7)", () => {
  it("hatches an estimated ring and draws nothing for a missing one", async () => {
    const { host } = renderThemed(
      <Budgets
        data={[
          { budget: "heating", kwh: 412, limit: 500, q: "estimated" },
          { budget: "water", kwh: 168, limit: 200, q: "missing" },
        ]}
      />
    );
    await painted();
    const [estimated, missing] = rings(host);
    const stroke = getComputedStyle(estimated ?? host).stroke;
    expect(stroke).toMatch(/^url\("#.+-hatch-0"\)$/u);
    expect(missing?.getAttribute("stroke-dasharray")?.split(" ")[0]).toBe("0");
  });

  it("hatches an estimated slice and draws no arc for a missing one", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 320 }}>
          <PieChart.Root
            data={[
              { part: "strom", kr: 50, q: "estimated" },
              { part: "nettleie", kr: 30, q: "missing" },
              { part: "avgifter", kr: 20 },
            ]}
            config={{
              strom: { label: "Strøm", color: "chart-1" },
              nettleie: { label: "Nettleie", color: "chart-2" },
              avgifter: { label: "Avgifter", color: "chart-3" },
            }}
            nameKey="part"
            valueKey="kr"
            qualityKey="q"
            data-intro="none"
            aria-label="Regning">
            <PieChart.Pie />
          </PieChart.Root>
        </div>
      </LocaleProvider>
    );
    await painted();
    const [estimated, missing] = sectors(host);
    // DOM audit: the hatch is the slice's paint server, read by its tag.
    const hatch = host.querySelector("linearGradient");
    expect(hatch?.getAttribute("gradientUnits")).toBe("userSpaceOnUse");
    expect(getComputedStyle(estimated ?? host).fill).toBe(`url("#${hatch?.id ?? ""}")`);
    expect(missing?.getAttribute("d")).toBe("");
  });
});

describe("the gauge's Track (L5's corner fix)", () => {
  it("rounds the Track's ends with the Pie's corner, so a full gauge covers its track exactly", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 320 }}>
          <PieChart.Root
            data={[{ measure: "peak", kwh: 6 }]}
            config={{ peak: { label: "Topp", color: "chart-1" } }}
            nameKey="measure"
            valueKey="kwh"
            max={5}
            startAngle={-135}
            endAngle={135}
            innerRadius={0.78}
            data-intro="none"
            aria-label="Effekttrinn">
            <PieChart.Track />
            <PieChart.Pie cornerRadius={0.5} />
          </PieChart.Root>
        </div>
      </LocaleProvider>
    );
    await painted();
    // DOM audit: the track is aria-hidden plot output, read by its slot.
    const track = host.querySelector('[data-slot="pie-chart-track"]')?.getAttribute("d");
    expect(sectors(host)[0]?.getAttribute("d")).toBe(track);
    expect(track).toMatch(/A0\.11/u);
  });
});
