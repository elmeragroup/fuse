// RadarChart's grid, axes and series marks in Chromium. Units under test: RadarChart.Grid, AngleAxis,
// RadiusAxis, Area, Line, Dots, ActiveDot and Glow under RadarChart.Root. Oracles, written by hand: the
// vertices of values 1 to 4 on a [0, 4] domain, (0, −R/4), (R/2, 0), (0, 3R/4) and (−R, 0); the [−2, 1, 3]
// fixture, whose domain is [−2, 3] with the zero ring at 2/5 of R, spoke 0 filled inside 2/5 only and spoke 1
// from 2/5 to 3/5 only; the zero ring in the zero line's color, the frame's muted foreground; the six-spoke
// fixture, spoke 1 estimated and spoke 4 missing, with two dashed edges, two hatched quadrilaterals and five
// dots; the nearest spoke by angle and nearest drawn vertex, found by brute force; the hover, 0.45 on the
// other series and twice the area opacity on the nearest; and the axes' places, the ring values beside spoke
// 0 at the ring radii and each spoke label 1.1 R out; and `defaultActiveName`'s spoke, named at
// mount, active by its row's name once rows that name it arrive, kept on that row while rows
// arrive before it, and named by the option in the same commit, so the first Tab or a focus in that
// commit lands on it.
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, wait } from "../../../test/animation-frames";
import { FocusOnLoad, LoadInTransition, PointProbe, preloadsSheet } from "../../../test/chart/default-active";
import { clientPoint, hoverAt, polarFigure } from "../../../test/chart/pie";
import { layerPath, pathPoints, radarLayer, radarLayers } from "../../../test/chart/radar";
import { holdRequest } from "../../../test/request-hold";
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
  defaultActiveName,
  children,
}: {
  readonly data: readonly SpokeRow[];
  readonly config?: ChartConfig;
  readonly max?: number;
  readonly defaultActiveName?: string;
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
          defaultActiveName={defaultActiveName}
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

describe("the pick and hover", () => {
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
        // oxlint-disable-next-line tests/no-fixed-delay -- the hold reads event timeStamps, not a fake clock
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

function pointOf(host: HTMLElement): string | null {
  return host.querySelector("[data-point]")?.textContent ?? null;
}

/** One row per spoke name, each reading 1 to 3 on series a. */
function named(names: readonly string[]): SpokeRow[] {
  return names.map((spoke, index) => ({ spoke, a: (index % 3) + 1 }));
}

/** A radar of series a whose default spoke is `name`, with the point probe inside it. */
function Spokes({ data, name }: { readonly data: readonly SpokeRow[]; readonly name: string }) {
  return (
    <Radar data={data} defaultActiveName={name}>
      <RadarChart.Line dataKey="a" />
      <PointProbe />
    </Radar>
  );
}

describe("a default active spoke that the first data lacks", () => {
  it("becomes active once the rows name it, and the first Tab lands on it", async () => {
    // A loading page mounts the radar with no rows, then hands it spokes s0 to s3. The rerender
    // also names s1, which Root ignores, since it reads the name at mount alone.
    const { host, rerender } = renderThemed(
      <>
        <button type="button">før</button>
        <Spokes data={[]} name="s2" />
      </>
    );
    rerender(
      <>
        <button type="button">før</button>
        <Spokes data={rows([3, 1, 4, 2])} name="s1" />
      </>
    );
    // Root writes the active source on data-active, "default" for the default spoke.
    expect(polarFigure(host).getAttribute("data-active")).toBe("default");
    expect(pointOf(host)).toBe("s2");
    // The option and Root name one spoke, so focus enters on s2, the third option, named for s2.
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement?.getAttribute("aria-posinset")).toBe("3");
    expect(document.activeElement?.getAttribute("aria-label")?.startsWith("s2")).toBe(true);
    expect(pointOf(host)).toBe("s2");
  });

  it("keeps the default active when a parent focuses the plot in the commit that brings its rows", () => {
    // The parent's layout effect runs after Root's in the commit that hands Root s0 to s3, and
    // focuses the option. The option already names s2, so focus keeps s2 active.
    const { host, rerender } = renderThemed(
      <FocusOnLoad loaded={false}>
        <Spokes data={[]} name="s2" />
      </FocusOnLoad>
    );
    rerender(
      <FocusOnLoad loaded>
        <Spokes data={rows([3, 1, 4, 2])} name="s2" />
      </FocusOnLoad>
    );
    expect(document.activeElement?.getAttribute("aria-label")?.startsWith("s2")).toBe(true);
    expect(pointOf(host)).toBe("s2");
  });

  it("keeps the spoke a reader focuses while a transition that brings the default waits to commit", async () => {
    // The rows hold s0, and a transition brings s0 to s3, then waits on a stylesheet before it
    // commits. Focus that enters the plot meanwhile activates s0, a reader's move, so the default
    // s2 stays inactive once the rows land, and the option and the probe both name s0. Nothing
    // that renders before the commit reads the active point, so the focus re-renders nothing and
    // React commits the render it held.
    const href = new URL(`./chart.css?late-spokes=${crypto.randomUUID()}`, import.meta.url).href;
    const release = await holdRequest(href);
    let load: (() => void) | undefined;
    const { host } = renderThemed(
      <LoadInTransition
        href={href}
        bind={(next) => {
          load = next;
        }}>
        {(loaded) => (
          <>
            <button type="button">før</button>
            <Radar data={loaded ? rows([3, 1, 4, 2]) : rows([3])} defaultActiveName="s2">
              <RadarChart.Line dataKey="a" />
              {loaded ? <PointProbe /> : null}
            </Radar>
          </>
        )}
      </LoadInTransition>
    );
    load?.();
    await expect.poll(() => preloadsSheet(href)).toBe(true);
    // React finishes the render in the task that preloads, and the commit waits on the sheet.
    await nextFrames(2);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement?.getAttribute("aria-label")?.startsWith("s0")).toBe(true);
    await release();
    await expect.poll(() => pointOf(host)).toBe("s0");
    expect(document.activeElement?.getAttribute("aria-posinset")).toBe("1");
    expect(document.activeElement?.getAttribute("aria-label")?.startsWith("s0")).toBe(true);
  });

  it.each([
    ["arrive after mount", []],
    ["are there at mount", named(["a", "c"])],
  ] as const)(
    "keeps the default on its row when a row is inserted before it, where its rows %s",
    async (_, first) => {
      // The default names c. Rows a and c make c the second spoke, and b inserted before c makes c
      // the third. c stays the active spoke, and the first Tab lands on its option.
      const { host, rerender } = renderThemed(
        <>
          <button type="button">før</button>
          <Spokes data={first} name="c" />
        </>
      );
      rerender(
        <>
          <button type="button">før</button>
          <Spokes data={named(["a", "c"])} name="c" />
        </>
      );
      expect(pointOf(host)).toBe("c");
      rerender(
        <>
          <button type="button">før</button>
          <Spokes data={named(["a", "b", "c"])} name="c" />
        </>
      );
      expect(polarFigure(host).getAttribute("data-active")).toBe("default");
      expect(pointOf(host)).toBe("c");
      host.querySelector("button")?.focus();
      await userEvent.keyboard("{Tab}");
      expect(document.activeElement?.getAttribute("aria-posinset")).toBe("3");
      expect(pointOf(host)).toBe("c");
    }
  );
});

describe("the description", () => {
  it("states a series' unit once after its label, as every series family's description does", () => {
    // The description's form, `Forbruk i kilowattimer: lavest 0,33`: the unit follows the
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
