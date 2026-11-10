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
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, wait } from "../../../test/animation-frames";
import { labelInk } from "../../../test/chart/clock";
import { clientPoint, hoverAt, polarFigure } from "../../../test/chart/pie";
import { layerPath, pathPoints, radarLayer, radarLayers, subpaths } from "../../../test/chart/radar";
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

/** A point at an angle and a radius in the dial's units, x right and y down. */
function at(angle: number, radius: number): DOMPoint {
  const radians = (angle * Math.PI) / 180;
  return new DOMPoint(
    Math.round(radius * Math.sin(radians) * 1e9) / 1e9,
    Math.round(-radius * Math.cos(radians) * 1e9) / 1e9
  );
}

/** Finish every running transition in the host, so styles show their rest. */
function settle(host: HTMLElement): void {
  for (const animation of host.getAnimations({ subtree: true })) animation.finish();
}

describe("the spoke frame and the negatives of section 8.4", () => {
  it("places values 1 to 4 at (0, −R/4), (R/2, 0), (0, 3R/4) and (−R, 0)", async () => {
    const { host } = renderThemed(
      <Radar data={rows([1, 2, 3, 4])}>
        <RadarChart.Line dataKey="a" />
      </Radar>
    );
    await nextFrames(1);
    const line = radarLayer(host, "radar-chart-line");
    const points = pathPoints(layerPath(line, "solid").getAttribute("d") ?? "");
    expect(points).toEqual([
      { x: 0, y: -0.25 },
      { x: 0.5, y: 0 },
      { x: 0, y: 0.75 },
      { x: -1, y: 0 },
    ]);
    // In client pixels the second vertex lies half the drawn radius right of the centre, within 0.5 px.
    const box = line.getBoundingClientRect();
    const [x, y] = clientPoint(line, 0.5, 0);
    expect(Math.abs(x - (box.left + box.width * 0.75))).toBeLessThan(0.5);
    expect(Math.abs(y - (box.top + box.height / 2))).toBeLessThan(0.5);
  });

  it("fills spoke 0 inside the zero ring only and spoke 1 between 2/5 and 3/5 only, and draws the zero ring solid", async () => {
    const { host } = renderThemed(
      <Radar data={rows([-2, 1, 3])}>
        <RadarChart.Grid />
        <RadarChart.Area dataKey="a" />
      </Radar>
    );
    await nextFrames(1);
    const [area] = radarLayers(host, "radar-chart-area");
    const fill = layerPath(area, "solid");
    // Points 3° past each spoke, inside the edge that leaves it, so none sits on a shared boundary.
    expect([0.2, 0.5].map((radius) => fill.isPointInFill(at(3, radius)))).toEqual([true, false]);
    expect([0.3, 0.5, 0.7].map((radius) => fill.isPointInFill(at(123, radius)))).toEqual([
      false,
      true,
      false,
    ]);
    // DOM audit: the zero ring carries data-zero, which the stylesheet paints and consumers read.
    const zeros = [...host.querySelectorAll('[data-slot="radar-chart-grid-ring"][data-zero]')];
    expect(zeros).toHaveLength(1);
    const [zero = host] = zeros;
    expect(pathPoints(zero.getAttribute("d") ?? "")[0]).toEqual({ x: 0, y: -0.4 });
    // DOM audit: the polar frame sets the muted foreground the zero line paints with.
    const frame = host.querySelector('[data-slot="chart-polar-frame"]') ?? host;
    expect(getComputedStyle(zero).stroke).toBe(getComputedStyle(frame).color);
    expect(getComputedStyle(zero).strokeDasharray).toBe("none");
  });
});

describe("ring dots", () => {
  it("moves a ring dot's halo with its dot when the readings change, and drops it where one goes missing", async () => {
    // Four spokes on [0, 4]: 4, 4, 4, 4 rest on the rim; 2, 4, null, 4 put spoke 0 at (0, −0.5), keep
    // spokes 1 and 3 on the rim at (1, 0) and (−1, 0), and draw no dot at spoke 2.
    const { host, rerender } = renderThemed(
      <Radar data={rows([4, 4, 4, 4])} max={4}>
        <RadarChart.Dots dataKey="a" variant="ring" />
      </Radar>
    );
    await nextFrames(1);
    rerender(
      <Radar data={rows([2, 4, null, 4])} max={4}>
        <RadarChart.Dots dataKey="a" variant="ring" />
      </Radar>
    );
    const layer = radarLayer(host, "radar-chart-dots");
    const points = (part: string) =>
      pathPoints(layerPath(layer, part).getAttribute("d") ?? "").map(({ x, y }) => [
        Math.round(x * 1000) / 1000,
        Math.round(y * 1000) / 1000,
      ]);
    const expected = [
      [0, -0.5],
      [1, 0],
      [-1, 0],
    ];
    // The update tweens over 480 ms, so the dots reach their new places once it ends.
    await expect.poll(() => points("dots")).toEqual(expected);
    expect(points("halo")).toEqual(expected);
  });
});

describe("quality (R5)", () => {
  it("dashes the two edges beside an estimated spoke, hatches its two quadrilaterals, and drops a missing spoke's edges and dot", async () => {
    const data = rows([4, 4, 4, 4, null, 4]).map((row, index) =>
      index === 1 ? { ...row, q: "estimated" as const } : row
    );
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 320 }}>
          <RadarChart.Root
            data={data}
            config={{ a: { label: "A", color: "chart-1", qualityKey: "q" } }}
            nameKey="spoke"
            max={4}
            data-intro="none"
            aria-label="Radar">
            <RadarChart.Area dataKey="a" />
            <RadarChart.Line dataKey="a" />
            <RadarChart.Dots dataKey="a" />
          </RadarChart.Root>
        </div>
      </LocaleProvider>
    );
    await nextFrames(1);
    const [line] = radarLayers(host, "radar-chart-line");
    const marked = layerPath(line, "marked");
    // Spokes at 60° steps on the rim: the dashed run visits spokes 0, 1 and 2, two edges.
    expect(marked.getAttribute("d")).toBe("M0,-1L0.866,-0.5L0.866,0.5");
    expect(getComputedStyle(marked).strokeDasharray).toBe("3px, 3px");
    // The solid runs are spokes 2 to 3 and 5 to 0, two edges, and none touches spoke 4.
    expect(layerPath(line, "solid").getAttribute("d")).toBe("M0.866,0.5L0,1M-0.866,-0.5L0,-1");
    const [area] = radarLayers(host, "radar-chart-area");
    expect(subpaths(layerPath(area, "marked").getAttribute("d") ?? "")).toBe(2);
    expect(subpaths(layerPath(area, "solid").getAttribute("d") ?? "")).toBe(2);
    expect(getComputedStyle(layerPath(area, "marked")).fill).toMatch(/^url\("?#/u);
    const [dots] = radarLayers(host, "radar-chart-dots");
    expect(subpaths(layerPath(dots, "dots").getAttribute("d") ?? "")).toBe(5);
  });

  it("draws a reading between two missing spokes as the Line's lone dot", async () => {
    const { host } = renderThemed(
      <Radar data={rows([4, null, 4, null])} max={4}>
        <RadarChart.Line dataKey="a" />
      </Radar>
    );
    await nextFrames(1);
    const [line] = radarLayers(host, "radar-chart-line");
    expect(layerPath(line, "lone").getAttribute("d")).toBe("M0,-1h0M0,1h0");
    expect(layerPath(line, "solid").getAttribute("d")).toBe("");
  });
});

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
        // A near series holds for 150 ms after it changes, so each probe waits that out.
        await wait(160);
        await hoverAt(...clientPoint(radarLayer(host, "radar-chart-line"), point.x, point.y));
        expect(figure.style.getPropertyValue("--chart-active")).toBe(String(spoke));
        expect(figure.getAttribute("data-near")).toBe(String(held));
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(30);
  });

  it("dims the series other than the nearest and doubles the nearest's fill", async () => {
    const { host } = renderThemed(
      <Radar data={rows([4, 4, 4, 4], [2, 2, 2, 2])} config={TWO} max={4}>
        <RadarChart.Area dataKey="a" />
        <RadarChart.Area dataKey="b" />
      </Radar>
    );
    await nextFrames(1);
    const areas = radarLayers(host, "radar-chart-area");
    // Near series b's vertex on spoke 0, at half the radius.
    await hoverAt(...clientPoint(radarLayer(host, "radar-chart-area"), 0.02, -0.5));
    settle(host);
    expect(areas.map((area) => getComputedStyle(area).opacity)).toEqual(["0.45", "1"]);
    expect(areas.map((area) => Number(getComputedStyle(layerPath(area, "solid")).fillOpacity))).toEqual([
      0.1, 0.2,
    ]);
  });
});

describe("the grid and the axes (S12)", () => {
  it("draws a ring per tick past the centre, as polygons or circles, and a spoke per row", () => {
    const { host, rerender } = renderThemed(
      <Radar data={rows([1, 2, 3, 4, 2])} max={4}>
        <RadarChart.Grid />
      </Radar>
    );
    const ringPaths = () =>
      // DOM audit: rings and spokes are aria-hidden plot output, read by their slots.
      [...host.querySelectorAll('[data-slot="radar-chart-grid-ring"]')].map(
        (ring) => ring.getAttribute("d") ?? ""
      );
    // Ticks 0 to 4 on [0, 4], so four rings past the centre, each a pentagon.
    expect(ringPaths().map((d) => pathPoints(d).length)).toEqual([5, 5, 5, 5]);
    expect(host.querySelectorAll('[data-slot="radar-chart-spoke"]:not([data-part])')).toHaveLength(5);
    rerender(
      <Radar data={rows([1, 2, 3, 4, 2])} max={4}>
        <RadarChart.Grid variant="circle" />
      </Radar>
    );
    expect(ringPaths().every((d) => d.includes("A"))).toBe(true);
  });

  it("places the ring values beside spoke 0 at the ring radii and each spoke label centred past the rim", async () => {
    const { host } = renderThemed(
      <Radar data={rows([4, 4, 3, 4])} max={4}>
        <RadarChart.Grid />
        <RadarChart.AngleAxis />
        <RadarChart.RadiusAxis />
      </Radar>
    );
    await nextFrames(1);
    const grid = radarLayers(host, "radar-chart-grid")[0]?.getBoundingClientRect();
    const radius = (grid?.width ?? 0) / 2;
    const centre = { x: (grid?.left ?? 0) + radius, y: (grid?.top ?? 0) + radius };
    // DOM audit: axis labels are aria-hidden plot text, read by their slots.
    // The spoke labels' gutter leaves a dial 176 px across in the 320 px frame, so the 160 px bucket's
    // stride holds: R = 80 there, the values sit 20 px apart, 0 sits on the centre, and the rim's 4
    // would end at 90 px, past the spoke label's edge at 88. The series' edge from the rim at spoke 0
    // to the rim at spoke 1 passes (10, −70), through the chip of 3, which sits 60 ± 8 px up and
    // from 4 px right of the spoke, so 3 hides; 1 and 2 sit well left of that edge.
    expect(radius * 2).toBeCloseTo(176, 0);
    const values = [...host.querySelectorAll('[data-slot="radar-chart-radius-label"]')].filter(
      (label) => label.getClientRects().length > 0
    );
    expect(values.map((label) => label.textContent)).toEqual(["1", "2"]);
    values.forEach((label, index) => {
      const box = label.getBoundingClientRect();
      expect(Math.abs(box.top + box.height / 2 - (centre.y - ((index + 1) / 4) * radius))).toBeLessThan(0.5);
      expect(Math.abs(box.left - (centre.x + 4))).toBeLessThan(0.5);
    });
    const spokes = [...host.querySelectorAll('[data-slot="radar-chart-angle-label"]')];
    expect(spokes.map((label) => label.textContent)).toEqual(["s0", "s1", "s2", "s3"]);
    // Each label's ink, read from the font's metrics, sits with its middle on its spoke and its
    // nearest edge 6 px past the rim: spoke 1 points to 3 o'clock, so its ink's left edge
    // sits R + 6 px right of the centre, centred on y.
    const [s0, s1] = spokes;
    if (!(s0 instanceof HTMLElement) || !(s1 instanceof HTMLElement)) throw new Error("no spoke labels");
    const east = labelInk(s1);
    expect(Math.abs(east.left - (centre.x + radius + 6))).toBeLessThan(0.5);
    expect(Math.abs((east.top + east.bottom) / 2 - centre.y)).toBeLessThan(0.5);
    // Spoke 0's label sits above the rim, its ink's bottom R + 6 px up, centred on x.
    const north = labelInk(s0);
    expect(Math.abs(north.bottom - (centre.y - radius - 6))).toBeLessThan(0.5);
    expect(Math.abs((north.left + north.right) / 2 - centre.x)).toBeLessThan(0.5);
  });
});

describe("the active dot and the glow", () => {
  it("sits on the active spoke's vertex and hides at a missing reading", async () => {
    const { host } = renderThemed(
      <Radar data={rows([4, 2, null, 4])} max={4}>
        <RadarChart.ActiveDot dataKey="a" />
      </Radar>
    );
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    const [dot] = radarLayers(host, "radar-chart-active-dot");
    // DOM audit: the dot's group carries data-value while it shows, which the stylesheet reads.
    const group = dot?.querySelector("[data-follow]");
    expect(group?.hasAttribute("data-value")).toBe(true);
    // The dot glides there on the Root's follower and rests on the vertex.
    await expect.poll(() => layerPath(dot, "dots").getAttribute("d")).toBe("M0.5,0h0");
    await userEvent.keyboard("{ArrowRight}");
    expect(group?.hasAttribute("data-value")).toBe(false);
    expect(page.getByRole("listbox").element()).toBeTruthy();
  });

  it("haloes the series it wraps in their own colour", async () => {
    const { host } = renderThemed(
      <Radar data={rows([1, 2, 3])}>
        <RadarChart.Glow>
          <RadarChart.Line dataKey="a" />
        </RadarChart.Glow>
      </Radar>
    );
    await nextFrames(1);
    const line = radarLayer(host, "radar-chart-line");
    expect(getComputedStyle(line).filter).toMatch(/^drop-shadow\(.+ 0px 0px 9\.5px\)$/u);
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
    // DOM audit: the description is the figure's visually hidden paragraph on its slot.
    expect(host.querySelector('[data-slot="chart-description"]')?.textContent).toBe(
      "Radardiagram med 1\u00a0serie over 3\u00a0kategorier. Forbruk i kilowattimer: lavest 1,5 NO2, høyest 7 NO3."
    );
  });
});

describe("a role list that names a role twice", () => {
  it("keeps every stop of its Area's and its Line's gradients, with no duplicate-key warning", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { host } = renderThemed(
        <Radar
          data={rows([1, 2, 3])}
          config={{ a: { label: "A", color: ["chart-1", "chart-2", "chart-1"] } }}>
          <RadarChart.Area dataKey="a" />
          <RadarChart.Line dataKey="a" />
        </Radar>
      );
      // DOM audit: the gradients are the series' paint servers, read by their tags.
      expect(host.querySelectorAll('radialGradient[id$="-paint"] stop')).toHaveLength(3);
      expect(host.querySelectorAll('linearGradient[id$="-paint"] stop')).toHaveLength(3);
      expect(errors.mock.calls.filter((call) => String(call[0]).includes("same key"))).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });
});
