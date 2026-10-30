// Continuity across data updates, in Chromium, after review round 9's Q9-1. Unit under test: every
// motion writer a stacked Bar chart runs, for each segment of each stack, the active overlay and
// the active value line. Oracle: the mark itself a frame earlier. An update starts each tween from
// what the mark drew, so what the update's commit draws, before the tween's first step, must lie
// within a device pixel of what the mark drew just before the update, whatever the update changes:
// a segment's sign, which segment tops its stack, which series stack at all, a custom seam, or a
// tween still running. Rounded ends, the blocks track and the direction of a role list's gradient
// count as drawn too, and so does a slot reference line's width when its band grows.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cdp, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

type MetricsCdp = {
  send: ((
    method: "Emulation.setDeviceMetricsOverride",
    params: { width: number; height: number; deviceScaleFactor: number; mobile: boolean }
  ) => Promise<void>) &
    ((method: "Emulation.clearDeviceMetricsOverride") => Promise<void>);
};

// SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
const session = (): MetricsCdp => cdp() as MetricsCdp;

async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

/** The series that may stack. q always draws, and carries the active value line. */
const SERIES = ["p", "q", "r"] as const;
type Series = (typeof SERIES)[number];

/** One chart state: which series stack, and each one's readings at categories a, b and c. */
type State = {
  readonly present: readonly Series[];
  readonly values: Readonly<Record<Series, readonly number[]>>;
};

type Look = {
  readonly orientation: "vertical" | "horizontal";
  readonly variant: "default" | "blocks" | "striped";
  readonly seam: number;
  /** The value domain `yInclude` keeps, symmetric about 0. */
  readonly reach: number;
  /** Whether q paints a role list, whose gradient runs from each bar's tip to its base. */
  readonly list: boolean;
};

/** One config per set of series, so a chart that keeps its series keeps its config. */
const configs = new Map<string, ChartConfig>();

/** Each series' own colour, whichever series stack with it, and q's role list. */
const COLORS = { p: "chart-1", q: "chart-2", r: "chart-3" } as const;
const LIST = ["chart-2", "chart-4"] as const;

function configOf(present: readonly Series[], list: boolean): ChartConfig {
  const key = `${present.join()}:${String(list)}`;
  const known: ChartConfig =
    configs.get(key) ??
    Object.fromEntries(
      present.map((series) => [
        series,
        { label: series, color: list && series === "q" ? LIST : COLORS[series], stack: "s" },
      ])
    );
  configs.set(key, known);
  return known;
}

function chart(state: State, look: Look) {
  const rows = ["a", "b", "c"].map((name, slot) => ({
    name,
    ...Object.fromEntries(state.present.map((series) => [series, state.values[series][slot] ?? 0])),
  }));
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 400 }}>
        <Chart.Root
          data-intro="none"
          data={rows}
          config={configOf(state.present, look.list)}
          xKey="name"
          orientation={look.orientation}
          yInclude={[-look.reach, look.reach]}
          style={{ "--chart-plot-height": "200px", "--chart-bar-seam": `${String(look.seam)}px` }}
          aria-label="Stabel">
          {state.present.map((series) => (
            <Chart.Bar key={series} dataKey={series} variant={look.variant} />
          ))}
          <Chart.ActiveValueLine dataKey="q" />
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

function numbers(element: Element, names: readonly string[]): number[] {
  return names.map((name) => Number(element.getAttribute(name)));
}

/** Which way a role list's gradient runs: 10 from a negative bar's tip, 0 otherwise. */
function direction(element: Element): number {
  return getComputedStyle(element).fill.includes("list-negative") ? 10 : 0;
}

/** The four corner radii a bar or the overlay clips its rectangle to. */
function radii(element: Element): number[] {
  const clip = getComputedStyle(element).clipPath;
  const round = /round (.*?)\)/u.exec(clip)?.[1] ?? "";
  const lengths = [...round.matchAll(/(-?[\d.]+)px/gu)].map(([, length]) => Number(length));
  return lengths.length === 0 ? [0, 0, 0, 0] : lengths;
}

/**
 * What every surviving mark draws now, by a key that names it across updates: each segment's
 * rectangle, rounded ends, cap and track opacity, each overlay, and the active value line.
 */
function drawn(host: HTMLElement, present: readonly Series[]): Map<string, number[]> {
  const marks = new Map<string, number[]>();
  // DOM audit: each Bar's layer is aria-hidden plot output, one per present series in order.
  const layers = [...host.querySelectorAll('[data-slot="chart-bar-series"]')];
  layers.forEach((layer, index) => {
    const series = present[index] ?? "";
    // DOM audit: the bodies, details and overlay are aria-hidden plot output.
    [...layer.querySelectorAll('[data-slot="chart-bar"]')].forEach((body, slot) => {
      const key = `${series}${String(slot)}`;
      marks.set(key, [...numbers(body, ["x", "y", "width", "height"]), ...radii(body), direction(body)]);
      const group = body.parentElement;
      const cap = group?.querySelector(':scope > [data-part="cap"]');
      if (cap) marks.set(`${key} cap`, numbers(cap, ["x", "y", "width", "height"]));
      const track = group?.querySelector(':scope > [data-part="track"]');
      // Opacity counts in hundredths, so a track that appears at once moves 10 of them.
      if (track) marks.set(`${key} track`, [Math.round(Number(getComputedStyle(track).opacity) * 100)]);
    });
    const overlay = layer.querySelector('[data-slot="chart-bar-active"][visibility="visible"]');
    if (overlay) {
      marks.set(`${series} overlay`, [
        ...numbers(overlay, ["x", "y", "width", "height"]),
        ...radii(overlay),
        direction(overlay),
      ]);
    }
  });
  // DOM audit: the active value line is aria-hidden plot output.
  const wrapper = host.querySelector('[data-slot="chart-active-value-line"][data-value]');
  const rule = wrapper?.querySelector('[data-slot="chart-active-value-rule"]');
  if (rule) marks.set("line", numbers(rule, ["x1", "y1", "x2", "y2"]));
  return marks;
}

/** Every mark both drawings share that moved more than a device pixel between them. */
function jumps(before: Map<string, number[]>, after: Map<string, number[]>): string[] {
  const failures: string[] = [];
  for (const [key, was] of before) {
    const now = after.get(key);
    if (now === undefined || now.length !== was.length) continue;
    if (now.some((value, index) => Math.abs(value - (was[index] ?? 0)) > 1 + 1e-6)) {
      failures.push(`${key}: ${was.join(",")} → ${now.join(",")}`);
    }
  }
  return failures;
}

/** Mount a state, make category a active, then run updates, checking each update's commit. */
async function run(look: Look, states: readonly State[], waits: readonly number[]): Promise<number[]> {
  const [first, ...updates] = states;
  if (first === undefined) return [];
  const { host, rerender, unmount } = renderThemed(chart(first, look));
  const tops: number[] = [];
  try {
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{Home}");
    let present = first.present;
    for (const [index, state] of updates.entries()) {
      const start = performance.now();
      while (performance.now() - start < (waits[index] ?? 0)) await frame();
      const before = drawn(host, present);
      // A series that joins a stack beside one that stays mounts its segments at their targets,
      // on the edges of segments that stay, so the update relays the plot and every mark snaps.
      const relays =
        state.present.some((series) => !present.includes(series)) &&
        state.present.some((series) => present.includes(series));
      rerender(chart(state, look));
      present = state.present;
      if (!relays) expect(jumps(before, drawn(host, present))).toEqual([]);
    }
    // The last update's tween, frame by frame, for a caller that follows one mark through it.
    // DOM audit: bars are aria-hidden plot output, so their slot is the only locator.
    for (let count = 0; count < 60; count += 1) {
      tops.push(Number(host.querySelector('[data-slot="chart-bar"]')?.getAttribute("y")));
      await frame();
    }
    return tops;
  } finally {
    unmount();
  }
}

describe("marks across a data update", () => {
  it("opens p's seam with the motion when q turns positive above it", async () => {
    // Q9-1: on 200 px over [-4, 4], p = 2 spans 50 to 100 px as the stack's only positive segment,
    // with no seam. q turning from -2 to 2 makes p inner, so p's 2 px seam opens with the motion,
    // from 50 through 51 to 52 px, while p's ends never move.
    const look: Look = { orientation: "vertical", variant: "default", seam: 2, reach: 4, list: false };
    const before: State = { present: ["p", "q"], values: { p: [2, 1, 1], q: [-2, 1, 1], r: [0, 0, 0] } };
    const after: State = { present: ["p", "q"], values: { p: [2, 1, 1], q: [2, 1, 1], r: [0, 0, 0] } };
    const tops = await run(look, [before, after], [0]);
    expect(tops[0]).toBe(50);
    expect(tops.every((top, index) => top >= (tops[index - 1] ?? 50) && [50, 51, 52].includes(top))).toBe(
      true
    );
    expect(tops).toContain(51);
    expect(tops.at(-1)).toBe(52);
  });

  it("draws every surviving mark within a device pixel of its last frame, through any updates", async () => {
    const reading = fc.integer({ min: -3, max: 3 });
    const readings = fc.array(reading, { minLength: 3, maxLength: 3 });
    const state = fc.record({
      // q always draws. p below it and r above it come and go.
      present: fc
        .record({ p: fc.boolean(), r: fc.boolean() })
        .map(({ p, r }): Series[] => SERIES.filter((series) => series === "q" || (series === "p" ? p : r))),
      values: fc.record({ p: readings, q: readings, r: readings }),
    });
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          orientation: fc.constantFrom("vertical" as const, "horizontal" as const),
          variant: fc.constantFrom("default" as const, "blocks" as const, "striped" as const),
          seam: fc.constantFrom(2, 6),
          reach: fc.constant(10),
          list: fc.boolean(),
        }),
        fc.array(state, { minLength: 2, maxLength: 5 }),
        // Waits that land early, midway and after a tween.
        fc.array(fc.oneof(fc.constant(0), fc.integer({ min: 30, max: 250 }), fc.constant(700)), {
          minLength: 4,
          maxLength: 4,
        }),
        async (look, states, waits) => {
          await run(look, states, waits);
        }
      ),
      {
        numRuns: 16,
        // Every run checks Q9-1's stack with a wide seam in each orientation, r arriving on top of
        // q mid-tween in blocks, which relays the plot, a striped q crossing zero, and q's role list
        // crossing zero, whose gradient turns over only as its tip passes p's.
        examples: [
          [
            { orientation: "vertical", variant: "default", seam: 6, reach: 10, list: false },
            [
              { present: ["p", "q"], values: { p: [2, 1, 1], q: [-2, 1, 1], r: [0, 0, 0] } },
              { present: ["p", "q"], values: { p: [2, 1, 1], q: [2, 1, 1], r: [0, 0, 0] } },
            ],
            [0, 0, 0, 0],
          ],
          [
            { orientation: "horizontal", variant: "default", seam: 6, reach: 10, list: false },
            [
              { present: ["p", "q"], values: { p: [2, 1, 1], q: [-2, 1, 1], r: [0, 0, 0] } },
              { present: ["p", "q"], values: { p: [2, 1, 1], q: [2, 1, 1], r: [0, 0, 0] } },
            ],
            [0, 0, 0, 0],
          ],
          [
            { orientation: "vertical", variant: "blocks", seam: 2, reach: 10, list: false },
            [
              { present: ["q"], values: { p: [0, 0, 0], q: [3, 2, 1], r: [0, 0, 0] } },
              { present: ["q"], values: { p: [0, 0, 0], q: [2, 2, 1], r: [0, 0, 0] } },
              { present: ["q", "r"], values: { p: [0, 0, 0], q: [2, 2, 1], r: [2, 1, 1] } },
            ],
            [0, 100, 0, 0],
          ],
          [
            { orientation: "vertical", variant: "striped", seam: 2, reach: 10, list: false },
            [
              { present: ["p", "q"], values: { p: [2, 1, 1], q: [2, 1, 1], r: [0, 0, 0] } },
              { present: ["p", "q"], values: { p: [2, 1, 1], q: [-2, 1, 1], r: [0, 0, 0] } },
            ],
            [0, 0, 0, 0],
          ],
          [
            { orientation: "vertical", variant: "default", seam: 2, reach: 10, list: true },
            [
              { present: ["p", "q"], values: { p: [2, 1, 1], q: [2, 1, 1], r: [0, 0, 0] } },
              { present: ["p", "q"], values: { p: [2, 1, 1], q: [-2, 1, 1], r: [0, 0, 0] } },
            ],
            [0, 0, 0, 0],
          ],
        ],
      }
    );
  }, 180_000);

  it("keeps a slot reference line's width through the commit that widens its band, at 3x", async () => {
    // 100 categories on 50 px give c0 a band of 1.5 device pixels, which snaps to one, so its line
    // draws one device pixel, 1/3 px, wide. 25 categories give the band 6 device pixels, and the
    // line a whole hairline, 1 px. Both draw one element per bar, so the update moves rather than
    // relaying the plot: its commit still draws 1/3 px, and the width grows with the motion.
    await session().send("Emulation.setDeviceMetricsOverride", {
      width: 1024,
      height: 768,
      deviceScaleFactor: 3,
      mobile: false,
    });
    await frame();
    const dense = Array.from({ length: 100 }, (_, index) => ({ name: `c${String(index)}`, v: 1 }));
    const view = (rows: readonly { name: string; v: number }[]) => (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 50 }}>
          <Chart.Root
            data-intro="none"
            data={rows}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            aria-label="Tett">
            <Chart.Bar dataKey="v" />
            <Chart.ReferenceLine x="c0" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const { host, rerender, unmount } = renderThemed(view(dense));
    try {
      // DOM audit: the reference rule is aria-hidden plot output.
      const width = () =>
        Number.parseFloat(
          getComputedStyle(host.querySelector('[data-slot="chart-reference-rule"]') ?? host).strokeWidth
        );
      expect(width()).toBeCloseTo(1 / 3, 4);
      rerender(view(dense.slice(0, 25)));
      expect(width()).toBeCloseTo(1 / 3, 4);
      await expect.poll(width, { timeout: 5000 }).toBeCloseTo(1, 4);
    } finally {
      unmount();
      await session().send("Emulation.clearDeviceMetricsOverride");
    }
  });

  it("draws a reference that changes axis mid-tween on its new axis at its new target", async () => {
    // Q10-1: on a 400 × 200 px plot of a and b, the domain grows from [0, 4] to [0, 8], so a line
    // at y = 2 moves from 100 to 150 px and a band from 1 to 2 from 150–175 toward 175–187.5. Part
    // way, they turn to b, whose band runs from 200 to 400 px with its centre at 300: the line's
    // 1 px rule centres at 300.5 down the whole plot, and the band covers 200–400, at once.
    const view = (max: number, axis: "value" | "slot") => (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root
            data-intro="none"
            data={[
              { name: "a", v: 1 },
              { name: "b", v: max },
            ]}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Akse">
            <Chart.Bar dataKey="v" />
            {axis === "value" ? <Chart.ReferenceLine y={2} /> : <Chart.ReferenceLine x="b" />}
            {axis === "value" ? <Chart.ReferenceArea y1={1} y2={2} /> : <Chart.ReferenceArea x1="b" x2="b" />}
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const { host, rerender, unmount } = renderThemed(view(4, "value"));
    try {
      // DOM audit: the reference rule and band are aria-hidden plot output.
      const rule = () => host.querySelector('[data-slot="chart-reference-rule"]');
      const band = () => host.querySelector('[data-slot="chart-reference-band"]');
      expect(numbers(rule() ?? host, ["y1"])).toEqual([100.5]);
      rerender(view(8, "value"));
      const start = performance.now();
      while (performance.now() - start < 120) await frame();
      // The turn lands mid-tween, the line on its way from 100 to 150 px.
      const [y = 0] = numbers(rule() ?? host, ["y1"]);
      expect(y).toBeGreaterThan(100.5);
      expect(y).toBeLessThan(150.5);
      rerender(view(8, "slot"));
      expect(numbers(rule() ?? host, ["x1", "y1", "x2", "y2"])).toEqual([300.5, 0, 300.5, 200]);
      expect(numbers(band() ?? host, ["x", "y", "width", "height"])).toEqual([200, 0, 200, 200]);
    } finally {
      unmount();
    }
  });
});
