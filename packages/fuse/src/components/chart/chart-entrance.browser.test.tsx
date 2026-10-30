// Root's entrance as one event in a Bar's life, and every placed mark through commits that land
// mid-tween, in Chromium, after motion-decision.md rule 1 and review rounds 5 to 7. Oracles: what
// the plot draws after each commit, worked by hand. The bars of 100 categories over 0–4 on a 200 px
// plot draw 50 px per unit, and above 100 categories the series draws as paths that grow from the
// zero line through one transform. After the first drawing commit, no commit leaves a grow
// transform or a bar still waiting at its base, and in every frame each bar, the active overlay,
// the active value line and each missing tick draws inside the plot in the chart's orientation.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

/** Wait for frames until at least a span of time has passed. */
async function waitFor(ms: number): Promise<void> {
  const start = performance.now();
  while (performance.now() - start < ms) await frame();
}

/** A reading, or null for a missing one. */
type Value = number | null;

type Row = { readonly name: string; readonly v: Value; readonly q: "missing" | "measured" };

/** One row array per value array, so a render that only turns the chart hands Root the same data. */
const rows = new WeakMap<readonly Value[], readonly Row[]>();

function rowsOf(values: readonly Value[]): readonly Row[] {
  const known =
    rows.get(values) ??
    values.map((v, index) => ({ name: `c${String(index)}`, v, q: v === null ? "missing" : "measured" }));
  rows.set(values, known);
  return known;
}

const CONFIG = { v: { label: "V", color: "chart-1", qualityKey: "q" } } as const satisfies ChartConfig;

/** A chart of the values with its active value line, Root's entrance on, on a 400 × 200 px plot. */
function chart(values: readonly Value[], orientation: "vertical" | "horizontal") {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 400 }}>
        <Chart.Root
          data={rowsOf(values)}
          config={CONFIG}
          xKey="name"
          orientation={orientation}
          style={{ "--chart-plot-height": "200px" }}
          aria-label="Inngang">
          <Chart.Bar dataKey="v" />
          <Chart.ActiveValueLine dataKey="v" />
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

/** Make the first category active, as a keyboard user does. */
async function activateFirst(host: HTMLElement): Promise<void> {
  // DOM audit: the plot's single tab stop is the listbox's option.
  host.querySelector<HTMLElement>('[role="option"]')?.focus();
  await userEvent.keyboard("{Home}");
}

/** The path form's grow transform, or null while the series draws at full scale. */
function growth(host: HTMLElement): string | null {
  // DOM audit: the series' marks group is aria-hidden plot output, which carries the grow.
  return host.querySelector('[data-slot="chart-bar-marks"]')?.getAttribute("transform") ?? null;
}

/**
 * Whether any bar of a nonzero reading still draws with no width or no height, as one waiting at
 * its base does, in this orientation or in the one before a turn.
 */
function waiting(host: HTMLElement): boolean {
  // DOM audit: bars are aria-hidden plot output, so their slot is the only locator.
  return [...host.querySelectorAll('[data-slot="chart-bar"]')].some(
    (bar) => Number(bar.getAttribute("height")) === 0 || Number(bar.getAttribute("width")) === 0
  );
}

function numbers(mark: Element, names: readonly string[]): number[] {
  return names.map((name) => Number(mark.getAttribute(name)));
}

/** The active value line's endpoints, or null while it shows no value. */
function valueLine(host: HTMLElement): number[] | null {
  // DOM audit: the active value line is aria-hidden plot output.
  const wrapper = host.querySelector('[data-slot="chart-active-value-line"]');
  const rule = wrapper?.querySelector('[data-slot="chart-active-value-rule"]');
  if (rule === null || rule === undefined || wrapper?.hasAttribute("data-value") !== true) return null;
  return numbers(rule, ["x1", "y1", "x2", "y2"]);
}

/**
 * Every placed mark that draws in the wrong orientation or outside the plot. Readings are all
 * positive, so the zero line is the plot's bottom edge on a vertical chart and its left edge on a
 * horizontal one, and every bar and the active overlay stand on it. The active value line runs
 * across the whole plot along the slot axis, its near edge inside the plot or on its far edge, as a
 * CSS border starts at its coordinate, and each missing tick lies on the zero line along it.
 */
function misplaced(host: HTMLElement, orientation: "vertical" | "horizontal"): string[] {
  const vertical = orientation === "vertical";
  // DOM audit: the bar series box is the plot box every mark draws in.
  const plot = host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect() ?? new DOMRect();
  const [width, height] = [plot.width, plot.height];
  const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
  const within = (at: number, end: number) => at > -0.01 && at < end + 0.01;
  const failures: string[] = [];
  // DOM audit: bars and the active overlay are aria-hidden plot output.
  const bodies = [
    ...host.querySelectorAll('[data-slot="chart-bar"], [data-slot="chart-bar-active"][visibility="visible"]'),
  ];
  for (const body of bodies) {
    const [x = 0, y = 0, w = 0, h = 0] = numbers(body, ["x", "y", "width", "height"]);
    const what = body.getAttribute("data-slot") ?? "";
    if (!within(x, width) || !within(x + w, width) || !within(y, height) || !within(y + h, height)) {
      failures.push(`${what} ${String([x, y, w, h])} outside ${String([width, height])}`);
    }
    if (vertical ? !near(y + h, height) : !near(x, 0))
      failures.push(`${what} ${String([x, y, w, h])} off its base`);
  }
  const line = valueLine(host);
  if (line !== null) {
    const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = line;
    // DOM audit: the rule is aria-hidden plot output.
    const rule = host.querySelector('[data-slot="chart-active-value-rule"]');
    const half = rule === null ? 0 : Number.parseFloat(getComputedStyle(rule).strokeWidth) / 2;
    const across = vertical
      ? near(x1, 0) && near(x2, width) && near(y1, y2) && within(y1 - half, height)
      : near(y1, 0) && near(y2, height) && near(x1, x2) && within(x1 - half, width);
    if (!across) failures.push(`value line ${String(line)} in ${String([width, height])}`);
  }
  // DOM audit: missing ticks are aria-hidden plot output.
  for (const tick of host.querySelectorAll('[data-slot="chart-bar-missing"]')) {
    const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = numbers(tick, ["x1", "y1", "x2", "y2"]);
    const along = vertical
      ? near(y1, y2) && near(y1, height) && within(x1, width) && within(x2, width)
      : near(x1, x2) && near(x1, 0) && within(y1, height) && within(y2, height);
    if (!along) failures.push(`tick ${String([x1, y1, x2, y2])} in ${String([width, height])}`);
  }
  return failures;
}

/** 101 categories: a 4 first, which reaches the plot's top, and 2 everywhere else. */
const MANY = Array.from({ length: 101 }, (_, index) => (index === 0 ? 4 : 2));

describe("the entrance", () => {
  it("ends the path form's growth at full scale when data arrives 120 ms into it", async () => {
    // B6-2: the update lands while the paths grow. The grow ends at once, and the columns draw
    // their new data at 200 and 100 px, not at the 0.70 scale the growth had reached.
    const { host, rerender } = renderThemed(chart(MANY, "vertical"));
    expect(growth(host)).not.toBeNull();
    await waitFor(120);
    rerender(chart([...MANY], "vertical"));
    expect(growth(host)).toBeNull();
    for (let count = 0; count < 30; count += 1) await frame();
    expect(growth(host)).toBeNull();
    // DOM audit: the path form's columns are aria-hidden plot output.
    const paths = [...host.querySelectorAll('[data-slot="chart-bar-path"]')];
    const heights = paths.flatMap((path) =>
      [...(path.getAttribute("d") ?? "").matchAll(/M[\d.]+ ([\d.]+)H[\d.]+V([\d.]+)/gu)].map(
        ([, top = "0", bottom = "0"]) => Number(bottom) - Number(top)
      )
    );
    expect(heights.slice(0, 2)).toEqual([200, 100]);
    expect(paths.map((path) => Math.round(path.getBoundingClientRect().height))).toEqual([200]);
  });

  it("draws a settled 101-category chart at once when its orientation turns, with no second entrance", async () => {
    // Q6-1: vertical, the series draws as paths and grows once. Turned horizontal, it draws as
    // bars, every one at its full length in the commit that turns it.
    const { host, rerender } = renderThemed(chart(MANY, "vertical"));
    await expect.poll(() => growth(host), { timeout: 5000 }).toBeNull();
    rerender(chart(MANY, "horizontal"));
    expect(waiting(host)).toBe(false);
    // DOM audit: bars are aria-hidden plot output, so their slot is the only locator.
    const widths = () =>
      [...host.querySelectorAll('[data-slot="chart-bar"]')].map((bar) => bar.getAttribute("width"));
    const first = widths();
    expect(first).toHaveLength(101);
    await frame();
    await frame();
    expect(widths()).toEqual(first);
  });

  it("runs at most once, and draws every placed mark inside the plot in its orientation, through any sequence of waits, data updates, turns and form swaps", async () => {
    // Expectation: after every commit but the first drawing one, the paths carry no grow transform,
    // at once and two frames on, and two frames on no bar still waits at its base. At every
    // sampled frame, `misplaced` finds nothing.
    const step = fc.oneof(
      // Most waits end inside the entrance or a data update's tween, which last about half a
      // second, and some outlast them.
      fc.record({
        kind: fc.constant("wait" as const),
        ms: fc.oneof(fc.integer({ min: 0, max: 150 }), fc.integer({ min: 150, max: 700 })),
      }),
      fc.record({ kind: fc.constant("update" as const), seed: fc.integer({ min: 1, max: 3 }) }),
      fc.record({ kind: fc.constant("swap" as const) }),
      fc.record({ kind: fc.constant("turn" as const) })
    );
    await fc.assert(
      fc.asyncProperty(
        fc.array(step, { minLength: 1, maxLength: 6 }),
        fc.constantFrom(100, 101),
        fc.constantFrom("vertical" as const, "horizontal" as const),
        async (steps, mounted, turned) => {
          let count = mounted;
          let seed = 1;
          let orientation: "vertical" | "horizontal" = turned;
          // Readings of 1 to 4, so every bar is at least 50 px long, and a missing reading every
          // seventh slot from a place each seed moves. One array per data set, so a turn alone
          // changes no data.
          const sets = new Map<string, readonly Value[]>();
          const values = () => {
            const key = `${String(count)}:${String(seed)}`;
            const known =
              sets.get(key) ??
              Array.from({ length: count }, (_, index) =>
                index % 7 === seed % 7 ? null : 1 + ((index * seed) % 4)
              );
            sets.set(key, known);
            return known;
          };
          const { host, rerender, unmount } = renderThemed(chart(values(), orientation));
          try {
            await activateFirst(host);
            expect(misplaced(host, orientation)).toEqual([]);
            for (const action of steps) {
              if (action.kind === "wait") {
                const start = performance.now();
                while (performance.now() - start < action.ms) {
                  await frame();
                  expect(misplaced(host, orientation)).toEqual([]);
                }
                continue;
              }
              if (action.kind === "update") seed = action.seed + 1;
              if (action.kind === "swap") count = count === 100 ? 101 : 100;
              if (action.kind === "turn")
                orientation = orientation === "vertical" ? "horizontal" : "vertical";
              rerender(chart(values(), orientation));
              expect(growth(host)).toBeNull();
              expect(misplaced(host, orientation)).toEqual([]);
              await frame();
              expect(misplaced(host, orientation)).toEqual([]);
              await frame();
              expect(growth(host)).toBeNull();
              expect(waiting(host)).toBe(false);
              expect(misplaced(host, orientation)).toEqual([]);
            }
          } finally {
            unmount();
          }
        }
      ),
      {
        numRuns: 12,
        // Every run checks the commits that met the entrance in review, data and a turn right
        // after a mount in each form, and a turn that lands 120 ms into a data update's tween.
        examples: [
          [[{ kind: "update", seed: 2 }], 101, "vertical"],
          [[{ kind: "turn" }], 100, "vertical"],
          [[{ kind: "turn" }, { kind: "turn" }], 101, "vertical"],
          [[{ kind: "swap" }], 100, "vertical"],
          // Every reading 1, so the active value line turns onto the plot's far edge.
          [[{ kind: "update", seed: 3 }, { kind: "turn" }], 100, "vertical"],
          [
            [
              { kind: "wait", ms: 700 },
              { kind: "update", seed: 2 },
              { kind: "wait", ms: 120 },
              { kind: "turn" },
              { kind: "wait", ms: 300 },
            ],
            100,
            "vertical",
          ],
        ],
      }
    );
    // Each run waits through tweens up to 700 ms a step, so the runs outlast the default timeout,
    // and a property still running after its test ends would press keys in the next test's chart.
  }, 120_000);
});

describe("placed marks through a commit mid-tween", () => {
  it("draws the active value line at 320 px from the commit that turns the chart 120 ms into an update", async () => {
    // B7-2: the first category reads 2, then 8, on a [0, 10] domain. Turned horizontal 120 ms into
    // the update's tween, the line snaps to 8 of 10 on the 400 px value axis, 320 px, its 1 px
    // rule centred at 320.5, from that commit on.
    const before: readonly Value[] = [2, 10];
    const after: readonly Value[] = [8, 10];
    const { host, rerender } = renderThemed(chart(before, "vertical"));
    await waitFor(700);
    await activateFirst(host);
    expect(valueLine(host)).toEqual([0, 160.5, 400, 160.5]);
    rerender(chart(after, "vertical"));
    await waitFor(120);
    // The turn lands mid-tween, the line on its way from 160 to 40 px.
    const [, y = 0] = valueLine(host) ?? [];
    expect(y).toBeGreaterThan(40.5);
    expect(y).toBeLessThan(160.5);
    rerender(chart(after, "horizontal"));
    expect(valueLine(host)).toEqual([320.5, 0, 320.5, 200]);
    for (let count = 0; count < 30; count += 1) {
      await frame();
      expect(valueLine(host)).toEqual([320.5, 0, 320.5, 200]);
    }
  });

  it("moves a missing tick with the zero line as the domain takes in a negative reading", async () => {
    // B7-3: [2, missing, 4] draws over [0, 4] with the zero line at the plot's bottom, 200 px.
    // [-4, missing, 4] draws over [-4, 4] with it at 100 px. The tick's 2 px rule centres on the
    // zero line, where the third bar, 4 in both, has its base, in every frame of the tween.
    const { host, rerender } = renderThemed(chart([2, null, 4], "vertical"));
    await waitFor(700);
    // DOM audit: bars and missing ticks are aria-hidden plot output.
    const tick = () => host.querySelector('[data-slot="chart-bar-missing"]');
    const base = () => {
      const bar = host.querySelectorAll('[data-slot="chart-bar"]')[1];
      return bar === undefined
        ? Number.NaN
        : Number(bar.getAttribute("y")) + Number(bar.getAttribute("height"));
    };
    expect(numbers(tick() ?? document.body, ["y1", "y2"])).toEqual([200, 200]);
    rerender(chart([-4, null, 4], "vertical"));
    const drawn: number[] = [];
    for (let count = 0; count < 40; count += 1) {
      await frame();
      const [y1 = 0, y2 = 0] = numbers(tick() ?? document.body, ["y1", "y2"]);
      expect(y2).toBe(y1);
      expect(y1).toBe(base());
      drawn.push(y1);
    }
    // The tick passes through the tween's frames rather than jumping to its end.
    expect(drawn.some((at) => at > 100 && at < 200)).toBe(true);
    expect(drawn.at(-1)).toBe(100);
  });
});
