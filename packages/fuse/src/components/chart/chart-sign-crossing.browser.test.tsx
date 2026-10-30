// A reading that changes sign on a data update, in Chromium, after review round 8's Q8-1. Unit
// under test: each bar's motion, its active overlay's and its active value line's, in every frame
// of the tween. Oracle: signed interpolation worked by hand. A bar's base and tip each move in a
// straight line between their pixels before and after the update, on one eased progress. The
// value line draws the tip, so its drawn edge gives that frame's progress, and the bar and the
// overlay must then span from the base at that progress to the line: a crossing bar shrinks to
// its base and grows out on the other side. Its far end follows the tip's side of the base: the
// overlay's rounded end, `data-negative`, and a striped bar's cap, which sits past the tip. The
// pixels come from the value domain the chart's `yInclude` fixes, checked at rest before the update.
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

/** One crossing: the stack below q, if any, and q's reading before and after the update. */
type Crossing = {
  readonly orientation: "vertical" | "horizontal";
  /** p's readings before and after, or null for q alone. */
  readonly below: readonly [number, number] | null;
  readonly from: number;
  readonly to: number;
  /** The value domain `yInclude` fixes, symmetric about 0. */
  readonly reach: number;
  /** q's look: plain, or striped with a cap past its tip. */
  readonly variant: "default" | "striped";
};

const LOOSE = { q: { label: "Q", color: "chart-1" } } as const satisfies ChartConfig;
const STACKED = {
  p: { label: "P", color: "chart-1", stack: "s" },
  q: { label: "Q", color: "chart-2", stack: "s" },
} as const satisfies ChartConfig;

/** Category a carries the crossing, and b a fixed reading of 1. */
function chart(crossing: Crossing, phase: 0 | 1) {
  const { orientation, below, reach } = crossing;
  const q = phase === 0 ? crossing.from : crossing.to;
  const rows =
    below === null
      ? [
          { name: "a", q },
          { name: "b", q: 1 },
        ]
      : [
          { name: "a", p: below[phase], q },
          { name: "b", p: 1, q: 1 },
        ];
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 400 }}>
        <Chart.Root
          data-intro="none"
          data={rows}
          config={below === null ? LOOSE : STACKED}
          xKey="name"
          orientation={orientation}
          yInclude={[-reach, reach]}
          style={{ "--chart-plot-height": "200px" }}
          aria-label="Fortegn">
          {below === null ? null : <Chart.Bar dataKey="p" />}
          <Chart.Bar dataKey="q" variant={crossing.variant} />
          <Chart.ActiveValueLine dataKey="q" />
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

/**
 * q's base and tip in value space: a diverging stack puts positive parts upward from 0 and
 * negative parts downward, in series order, so q starts where p ends on q's own side of zero.
 */
function ends(below: number, q: number): [base: number, tip: number] {
  const base = q > 0 ? Math.max(below, 0) : Math.min(below, 0);
  return [base, base + q];
}

/** Where a value lies across the plot: down from the top of 200 px, or right along 400 px. */
function pixel(crossing: Crossing, value: number): number {
  const share = (value + crossing.reach) / (2 * crossing.reach);
  return crossing.orientation === "vertical" ? (1 - share) * 200 : share * 400;
}

/** A rectangle's span across the plot. */
function across(rect: Element, vertical: boolean): [number, number] {
  const [start, size] = (vertical ? ["y", "height"] : ["x", "width"]).map((name) =>
    Number(rect.getAttribute(name))
  );
  return [start ?? 0, (start ?? 0) + (size ?? 0)];
}

/**
 * Run a crossing and check every frame. Returns the progress each frame drew, so a caller can
 * check the tween passed through the crossing.
 */
async function cross(crossing: Crossing): Promise<number[]> {
  const vertical = crossing.orientation === "vertical";
  const [below0, below1] = crossing.below ?? [0, 0];
  const [base0, tip0] = ends(below0, crossing.from).map((value) => pixel(crossing, value));
  const [base1, tip1] = ends(below1, crossing.to).map((value) => pixel(crossing, value));
  const { host, rerender, unmount } = renderThemed(chart(crossing, 0));
  try {
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{Home}");
    // DOM audit: q's bars, its active overlay and the active value line are aria-hidden plot output.
    const layer = host.querySelectorAll('[data-slot="chart-bar-series"]')[crossing.below === null ? 0 : 1];
    const bar = () => layer?.querySelector('[data-slot="chart-bar"]');
    const overlay = layer?.querySelector('[data-slot="chart-bar-active"]');
    const rule = host.querySelector('[data-slot="chart-active-value-rule"]');
    if (layer === undefined || overlay == null || rule === null) throw new Error("no marks");
    // The line's drawn near edge, where its stroke starts.
    const tip = () =>
      Number(rule.getAttribute(vertical ? "y1" : "x1")) -
      Number.parseFloat(getComputedStyle(rule).strokeWidth) / 2;
    // At rest the line sits on the tip the domain puts it at, give or take a pixel's snapping.
    expect(Math.abs(tip() - (tip0 ?? 0))).toBeLessThanOrEqual(1);
    rerender(chart(crossing, 1));
    const progress: number[] = [];
    for (let count = 0; count < 90; count += 1) {
      const line = tip();
      const eased = (line - (tip0 ?? 0)) / ((tip1 ?? 0) - (tip0 ?? 0));
      const base = (base0 ?? 0) + ((base1 ?? 0) - (base0 ?? 0)) * eased;
      const wanted = [Math.min(base, line), Math.max(base, line)];
      for (const [what, rect] of [
        ["bar", bar()],
        ["overlay", overlay],
      ] as const) {
        const drawn = rect === null || rect === undefined ? [Number.NaN, Number.NaN] : across(rect, vertical);
        // The line's snapped edge gives the progress to within half a pixel of the tip's travel,
        // which the base's own travel scales, and the base snaps on its own, half a pixel more.
        const slack = 1 + 0.5 * Math.abs(((base1 ?? 0) - (base0 ?? 0)) / ((tip1 ?? 0) - (tip0 ?? 0)));
        const off = Math.max(...drawn.map((edge, index) => Math.abs(edge - (wanted[index] ?? 0))));
        expect(
          off,
          `${what} ${drawn.join("–")} at ${String(eased)}, wanted ${wanted.join("–")}`
        ).toBeLessThanOrEqual(slack);
        // The bar and the line snap the same tweened tip, so the bar's tip edge is the line's.
        const tipEdge = line < base ? drawn[0] : drawn[1];
        expect(tipEdge, `${what} tip ${drawn.join("–")} against the line at ${String(line)}`).toBeCloseTo(
          line,
          6
        );
      }
      // The tip's side of the base: the reading's own side in every frame of an update that keeps
      // it, even one ending under a pixel, and during a crossing the side the tip lies on, once the
      // two lie a pixel apart. A vertical bar hangs below its base, and a horizontal one left of it.
      const kept = crossing.from < 0 === crossing.to < 0;
      if (kept || Math.abs(line - base) >= 1) {
        const hangs = kept ? crossing.to < 0 : vertical ? line > base : line < base;
        expect(bar()?.hasAttribute("data-negative"), `bar side at ${String(eased)}`).toBe(hangs);
        expect(overlay.hasAttribute("data-negative"), `overlay side at ${String(eased)}`).toBe(hangs);
        // DOM audit: a striped bar's cap is an aria-hidden detail beside its body.
        const cap = layer.querySelector('[data-slot="chart-bar-detail"][data-part="cap"]');
        const body = bar();
        if (cap !== null && body !== null && body !== undefined) {
          const [capStart, capEnd] = across(cap, vertical);
          const [bodyStart, bodyEnd] = across(body, vertical);
          // The cap lies past the tip: toward the start of the axis for an upward vertical bar
          // or a negative horizontal one.
          const atStart = vertical ? !hangs : hangs;
          const past = atStart ? capEnd <= bodyStart : capStart >= bodyEnd;
          expect(past, `cap ${String(capStart)}–${String(capEnd)} at ${String(eased)}`).toBe(true);
        }
      }
      progress.push(eased);
      if (Math.abs(line - (tip1 ?? 0)) <= 1 && count > 0) break;
      await frame();
    }
    return progress;
  } finally {
    unmount();
  }
}

describe("a reading that changes sign", () => {
  it("shrinks the bar to the baseline and grows it out below, with its value line on its tip", async () => {
    // Q8-1: on 200 px over [-4, 4], 2 draws from the baseline at 100 px up to 50 px, and -2 down
    // to 150 px. At half the eased progress the tip reaches the baseline, so the bar spans 100 to
    // its drawn tip, never 50 px tall across zero, and the line draws on that tip.
    const progress = await cross({
      orientation: "vertical",
      below: null,
      from: 2,
      to: -2,
      reach: 4,
      variant: "default",
    });
    expect(progress.some((eased) => eased > 0.3 && eased < 0.7)).toBe(true);
  });

  it("moves bar, overlay and value line as one through crossings either way and updates that keep the sign, to under a pixel, either orientation, alone or stacked", async () => {
    // Expectation: in every frame, `cross`'s signed interpolation.
    const reading = fc.integer({ min: 1, max: 4 });
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("vertical" as const, "horizontal" as const),
        fc.option(fc.tuple(fc.constantFrom(-2, -1, 1, 2), fc.constantFrom(-2, -1, 1, 2)), { nil: null }),
        reading,
        reading,
        fc.boolean(),
        fc.constantFrom("default" as const, "striped" as const),
        // A crossing, an update that keeps the sign, or one that keeps it and ends under a pixel:
        // 0.04 of 10 units on 200 or 400 px.
        fc.constantFrom("cross" as const, "keep" as const, "shrink" as const),
        async (orientation, below, from, to, upward, variant, ending) => {
          // An upward crossing runs from below zero to above it.
          const start = upward ? -from : from;
          const size = ending === "shrink" ? 0.04 : to === from ? to + 1 : to;
          const crossing: Crossing = {
            orientation,
            below,
            from: start,
            to: ending === "cross" ? (upward ? size : -size) : Math.sign(start) * size,
            reach: 10,
            variant,
          };
          // The line gives each frame's progress, so the tip must move a unit, 10 px or more: a
          // stack whose base rises as q shrinks can leave q's tip almost where it was.
          const [below0, below1] = below ?? [0, 0];
          fc.pre(Math.abs(ends(below0, crossing.from)[1] - ends(below1, crossing.to)[1]) >= 1);
          const progress = await cross(crossing);
          // The line's last edge snaps within a pixel of the tip, 10 px a unit or more from it, so
          // the last frame lies at 0.9 of the way or later. A frame at exactly 0.9 reads it back
          // through float arithmetic, which a millionth of slack absorbs.
          expect(Math.abs((progress.at(-1) ?? 0) - 1)).toBeLessThanOrEqual(0.1 + 1e-6);
        }
      ),
      {
        numRuns: 12,
        // Every run checks a stacked crossing whose base moves with p, in each orientation, a
        // striped one alone, and a negative reading shrinking under a pixel in each orientation.
        examples: [
          ["vertical", [2, -1], 3, 2, false, "default", "cross"],
          ["horizontal", [-2, 1], 1, 4, true, "default", "cross"],
          ["vertical", null, 3, 3, true, "striped", "cross"],
          ["horizontal", null, 2, 3, false, "striped", "cross"],
          ["vertical", null, 2, 1, true, "striped", "shrink"],
          ["horizontal", [1, 2], 3, 1, true, "striped", "shrink"],
        ],
      }
    );
  }, 120_000);
});
