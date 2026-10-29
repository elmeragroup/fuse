// Unit under test: Fuse's drawn bars. Oracle: a headless Vega-Lite render of the same rows, after
// the judges of ticket 05 for stacked, expanded, grouped and horizontal bars. Both draw on a
// 400 by 200 px plot with no axes, over the domain written by hand for each fixture, and Fuse's
// band of 25 % maps to Vega's paddingInner 0.25 with paddingOuter 0.125. A stacked segment below
// another ends --chart-bar-seam short of it, which the comparison removes, after L33.
import type { ReactNode } from "react";

import * as vega from "vega";
import * as vl from "vega-lite";
import type { OffsetDef, PositionDef } from "vega-lite/types_unstable/channeldef.js";
import type { Encoding } from "vega-lite/types_unstable/encoding.js";
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { barBox } from "../../../test/chart/bar-box";
import type { BarBox } from "../../../test/chart/bar-box";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";
import groups from "./format/fixtures/elhub/no1-groups-2026-10-16.json" with { type: "json" };

const WIDTH = 400;
const HEIGHT = 200;
const SEAM = 2;
/**
 * The xOffset padding that gives Fuse's 2 px --chart-bar-gap between three sub-bands of a 75 px
 * band, the 100 px slot less its 25 % gap. A band of step s holds 3s minus one inner padding of
 * s × p, so 3s − s·p = 75 and s·p = 2 give s = 77 / 3 and p = 6 / 77.
 */
const GROUP_PADDING = 6 / 77;
const NAMES = ["a", "b", "c", "d"] as const;
const P = [3, 5, 2, 6];
const Q = [2, -1, 4, 1];
const R = [-2, 2, -3, 3];
const ROWS = NAMES.map((name, index) => ({ name, p: P[index] ?? 0, q: Q[index] ?? 0, r: R[index] ?? 0 }));

type Rect = { readonly series: string; readonly name: string; readonly box: BarBox };

/** The scene graph object vega 6 returns, which holds the root mark. */
type SceneGraph = { readonly root: vega.Scene };

/** The root mark of a view's scene graph. */
function rootOf(view: vega.View): vega.Scene {
  const graph: unknown = view.scenegraph();
  // SAFETY: vega-typings types scenegraph() as the root mark, while vega 6 returns the scene graph
  // object that holds the root mark as root.
  return (graph as SceneGraph).root;
}

/** Vega-Lite's bar rectangles for the rows in long form. */
async function vegaBars(options: {
  readonly rows: readonly { readonly name: string; readonly [key: string]: number | string }[];
  readonly keys: readonly string[];
  readonly stack: "zero" | "normalize" | null;
  readonly domain: readonly [number, number];
  readonly horizontal?: boolean;
}): Promise<Rect[]> {
  const values = options.rows.flatMap((row) =>
    options.keys.map((key, order) => ({ name: row.name, series: key, order, v: row[key] }))
  );
  const band: PositionDef<string> = {
    field: "name",
    type: "nominal",
    sort: null,
    axis: null,
    scale: { paddingInner: 0.25, paddingOuter: 0.125 },
  };
  const value: PositionDef<string> = {
    field: "v",
    type: "quantitative",
    axis: null,
    stack: options.stack,
    scale: { domain: [...options.domain], nice: false },
  };
  const offset: OffsetDef<string> = {
    field: "series",
    sort: [...options.keys],
    scale: { paddingInner: GROUP_PADDING },
  };
  const encoding: Encoding<string> = {
    color: { field: "series", legend: null, sort: [...options.keys] },
    order: { field: "order" },
  };
  if (options.horizontal === true) {
    encoding.y = band;
    encoding.x = value;
    if (options.stack === null) encoding.yOffset = offset;
  } else {
    encoding.x = band;
    encoding.y = value;
    if (options.stack === null) encoding.xOffset = offset;
  }
  const spec: vl.TopLevelSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: WIDTH,
    height: HEIGHT,
    padding: 0,
    autosize: "none",
    config: { view: { stroke: null } },
    data: { values },
    mark: "bar",
    encoding,
  };
  const view = new vega.View(vega.parse(vl.compile(spec).spec), { renderer: "none" });
  await view.runAsync();
  const rects: Rect[] = [];
  // A rect mark's items are the bars. Group marks nest more marks, which the walk descends.
  const visit = (scene: vega.Scene): void => {
    for (const item of scene.items) {
      if (scene.marktype === "rect") {
        const datum = item.datum ?? {};
        const series = "series" in datum ? String(datum.series) : "";
        const name = "name" in datum ? String(datum.name) : "";
        const { x1, x2, y1, y2 } = item.bounds;
        rects.push({ series, name, box: { left: x1, right: x2, top: y1, bottom: y2 } });
      } else {
        for (const child of item.items) visit(child);
      }
    }
  };
  visit(rootOf(view));
  view.finalize();
  return rects;
}

/** Fuse's bar boxes by series and category, read at rest. */
function fuseBars(
  host: HTMLElement,
  keys: readonly string[],
  names: readonly string[] = NAMES
): (Rect & { readonly stackTop: boolean })[] {
  // DOM audit: Root's figure holds every animation of the chart.
  for (const animation of host.querySelector('[data-slot="chart"]')?.getAnimations({ subtree: true }) ?? []) {
    if (Number.isFinite(animation.effect?.getComputedTiming().endTime ?? Infinity)) animation.finish();
  }
  // DOM audit: the bar series box is the plot box the clip-paths resolve against.
  const plot = host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect() ?? new DOMRect();
  return keys.flatMap((series, seriesIndex) =>
    // DOM audit: bars are aria-hidden plot output, so their slots are the only locator.
    [
      ...host.querySelectorAll(
        `[data-slot="chart-bar-series"][data-series="${String(seriesIndex)}"] [data-slot="chart-bar"]`
      ),
    ].map((bar, index) => ({
      series,
      name: names[index] ?? "",
      box: barBox(bar, plot),
      stackTop: bar.hasAttribute("data-stack-top"),
    }))
  );
}

/** Compare each Fuse bar with Vega's, with the seam of a lower segment removed. */
function expectSame(
  fuse: ReturnType<typeof fuseBars>,
  expected: readonly Rect[],
  seamEdge: "top" | "bottom" | "right" | "left" | null
): void {
  expect(fuse).toHaveLength(expected.length);
  for (const bar of fuse) {
    const other = expected.find((rect) => rect.series === bar.series && rect.name === bar.name);
    if (other === undefined) throw new Error(`no Vega bar for ${bar.series} ${bar.name}`);
    const box = { ...bar.box };
    if (!bar.stackTop && seamEdge !== null)
      box[seamEdge] += seamEdge === "top" || seamEdge === "left" ? -SEAM : SEAM;
    for (const edge of ["left", "right", "top", "bottom"] as const) {
      const [low, high] = [Math.min(box.top, box.bottom), Math.max(box.top, box.bottom)];
      const value = edge === "top" ? low : edge === "bottom" ? high : box[edge];
      const [otherLow, otherHigh] = [
        Math.min(other.box.top, other.box.bottom),
        Math.max(other.box.top, other.box.bottom),
      ];
      const wanted = edge === "top" ? otherLow : edge === "bottom" ? otherHigh : other.box[edge];
      expect(Math.abs(value - wanted), `${bar.series} ${bar.name} ${edge}`).toBeLessThanOrEqual(0.5);
    }
  }
}

function chart(
  children: ReactNode,
  options: { readonly expand?: boolean; readonly horizontal?: boolean; readonly stacked: boolean }
) {
  const config = options.stacked
    ? ({
        p: { label: "P", color: "chart-1", stack: "s" },
        q: { label: "Q", color: "chart-2", stack: "s" },
        r: { label: "R", color: "chart-3", stack: "s" },
      } as const)
    : ({
        p: { label: "P", color: "chart-1" },
        q: { label: "Q", color: "chart-2" },
        r: { label: "R", color: "chart-3" },
      } as const);
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: WIDTH }}>
        <Chart.Root
          data={
            options.expand === true
              ? ROWS.map((row) => ({ ...row, q: Math.abs(row.q), r: Math.abs(row.r) }))
              : ROWS
          }
          config={config}
          xKey="name"
          stackOffset={options.expand === true ? "expand" : "diverging"}
          orientation={options.horizontal === true ? "horizontal" : "vertical"}
          style={{ "--chart-plot-height": `${String(HEIGHT)}px` }}
          aria-label="Vega">
          {children}
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

const STACK = (
  <>
    <Chart.Bar dataKey="p" />
    <Chart.Bar dataKey="q" />
    <Chart.Bar dataKey="r" />
  </>
);

describe("Vega-Lite renders of the same rows", () => {
  it("matches stacked bars under the diverging offset", async () => {
    // Positive totals reach 10 on d and negatives -3 on c, which the 1-2-5 rule nices to [-4, 10].
    const { host } = renderThemed(chart(STACK, { stacked: true }));
    const expected = await vegaBars({ rows: ROWS, keys: ["p", "q", "r"], stack: "zero", domain: [-4, 10] });
    expectSame(fuseBars(host, ["p", "q", "r"]), expected, "top");
  });

  it("matches S06's five consumption groups stacked over 24 hours", async () => {
    // The scenario rows themselves: each hour's five groups in MWh from the committed Elhub file.
    // The highest total, 3,897.232 MWh at 19:00, nices to [0, 4000] under the 1-2-5 rule, since a
    // fifth of the span, 779, rounds up to a step of 1,000.
    const keys = ["household", "cabin", "primary", "secondary", "tertiary"] as const;
    const rows = groups.rows.map((row, index) => ({
      name: `h${String(index)}`,
      household: row.household,
      cabin: row.cabin,
      primary: row.primary,
      secondary: row.secondary,
      tertiary: row.tertiary,
    }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: WIDTH }}>
          <Chart.Root
            data={rows}
            config={{
              household: { label: "Husholdning", color: "chart-1", stack: "s" },
              cabin: { label: "Hytte", color: "chart-2", stack: "s" },
              primary: { label: "Primær", color: "chart-3", stack: "s" },
              secondary: { label: "Sekundær", color: "chart-4", stack: "s" },
              tertiary: { label: "Tjenester", color: "chart-5", stack: "s" },
            }}
            xKey="name"
            style={{ "--chart-plot-height": `${String(HEIGHT)}px` }}
            aria-label="S06">
            {keys.map((key) => (
              <Chart.Bar key={key} dataKey={key} />
            ))}
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const expected = await vegaBars({ rows, keys, stack: "zero", domain: [0, 4000] });
    expectSame(
      fuseBars(
        host,
        keys,
        rows.map((row) => row.name)
      ),
      expected,
      "top"
    );
  });

  it("matches expanded bars", async () => {
    const { host } = renderThemed(chart(STACK, { stacked: true, expand: true }));
    const rows = ROWS.map((row) => ({ ...row, q: Math.abs(row.q), r: Math.abs(row.r) }));
    const expected = await vegaBars({ rows, keys: ["p", "q", "r"], stack: "normalize", domain: [0, 1] });
    expectSame(fuseBars(host, ["p", "q", "r"]), expected, "top");
  });

  it("matches grouped bars, which Vega offsets by xOffset", async () => {
    const group = <Chart.BarGroup series={["p", "q", "r"]}>{STACK}</Chart.BarGroup>;
    const { host } = renderThemed(chart(group, { stacked: false }));
    // The values span -3 to 6, which the 1-2-5 rule nices to [-4, 6].
    const expected = await vegaBars({ rows: ROWS, keys: ["p", "q", "r"], stack: null, domain: [-4, 6] });
    expectSame(fuseBars(host, ["p", "q", "r"]), expected, null);
  });

  it("matches horizontal bars, whose lengths follow their values", async () => {
    const { host } = renderThemed(chart(<Chart.Bar dataKey="p" />, { stacked: false, horizontal: true }));
    // p alone spans 2 to 6, so the zero rule and the 1-2-5 rule give [0, 6], but the layout covers
    // every config key, whose values reach -3, so the domain is [-4, 6].
    const expected = await vegaBars({
      rows: ROWS,
      keys: ["p"],
      stack: "zero",
      domain: [-4, 6],
      horizontal: true,
    });
    expectSame(fuseBars(host, ["p"]), expected, null);
  });
});
