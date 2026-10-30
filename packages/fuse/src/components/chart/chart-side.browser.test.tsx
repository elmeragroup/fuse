// The side a bar draws on, in Chromium, after review round 10's B10-1. Unit under test: every
// discrete mark of a bar's side the element form writes, at rest and in every tween frame: the
// body's `data-negative`, the role list's gradient direction, the striped cap, the blocks squares
// and their track, and the active overlay's `data-negative`. Oracle: the sign of the reading, 0
// counting as positive, as the model never calls 0 negative. A reading shorter than a device pixel
// snaps its base and tip onto one pixel, and its side must survive that. During a tween that crosses
// zero, the oracle is the side the drawn tip lies on, wherever it lies a device pixel or more from
// the baseline.
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { cdp, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { installFrameClock } from "../../../test/chart/frame-clock";
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

afterEach(async () => {
  await session().send("Emulation.clearDeviceMetricsOverride");
});

async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

/** A role list, whose gradient runs from each bar's tip to its base on the default look. */
const CONFIG = { v: { label: "V", color: ["chart-1", "chart-3"] } } as const satisfies ChartConfig;

type Look = {
  readonly orientation: "vertical" | "horizontal";
  readonly variant: "default" | "striped" | "blocks";
  readonly dpr: number;
};

/**
 * Category a reads 50 in every chart, so its base marks the baseline. The others take the readings,
 * over [-100, 100] on 200 px down a vertical plot or 400 px across a horizontal one.
 */
function chart(readings: readonly number[], look: Look) {
  const rows = [50, ...readings].map((v, index) => ({ name: `c${String(index)}`, v }));
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 400 }}>
        <Chart.Root
          data-intro="none"
          data={rows}
          config={CONFIG}
          xKey="name"
          orientation={look.orientation}
          yInclude={[-100, 100]}
          style={{ "--chart-plot-height": "200px" }}
          aria-label="Side">
          <Chart.Bar dataKey="v" variant={look.variant} />
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

/** A rectangle's span across the plot, along the value axis. */
function across(
  rect: { x: number; y: number; width: number; height: number },
  vertical: boolean
): [number, number] {
  return vertical ? [rect.y, rect.y + rect.height] : [rect.x, rect.x + rect.width];
}

function attributes(element: Element) {
  const [x = 0, y = 0, width = 0, height = 0] = ["x", "y", "width", "height"].map((name) =>
    Number(element.getAttribute(name))
  );
  return { x, y, width, height };
}

function pathRects(d: string) {
  return [...d.matchAll(/M([-\d.e]+) ([-\d.e]+)H([-\d.e]+)V([-\d.e]+)H[-\d.e]+Z/gu)].map(
    ([, x, y, x2, y2]) => ({
      x: Number(x),
      y: Number(y),
      width: Number(x2) - Number(x),
      height: Number(y2) - Number(y),
    })
  );
}

/**
 * Every side mark of one bar that disagrees with a side. Positive is up a vertical plot and right
 * along a horizontal one, from the baseline.
 */
function wrongSides(body: Element, negative: boolean, baseline: number, look: Look): string[] {
  const vertical = look.orientation === "vertical";
  const failures: string[] = [];
  // Past the baseline on the bar's side: above or right of it when positive.
  const onSide = (span: [number, number]): boolean => {
    const positive = vertical ? span[1] <= baseline + 1e-3 : span[0] >= baseline - 1e-3;
    const below = vertical ? span[0] >= baseline - 1e-3 : span[1] <= baseline + 1e-3;
    return negative ? below : positive;
  };
  if (body.hasAttribute("data-negative") !== negative) failures.push("data-negative");
  if (look.variant === "default") {
    const fill = getComputedStyle(body).fill;
    if (fill.includes("list-negative") !== negative) failures.push(`fill ${fill}`);
  }
  // DOM audit: a bar's details are aria-hidden siblings of its body.
  const group = body.parentElement;
  const cap = group?.querySelector(':scope > [data-part="cap"]');
  if (look.variant === "striped" && cap) {
    const span = across(attributes(cap), vertical);
    if (!onSide(span)) failures.push(`cap ${span.join("–")}`);
  }
  for (const part of ["blocks", "track"] as const) {
    const path = group?.querySelector(`:scope > [data-part="${part}"]`);
    for (const rect of pathRects(path?.getAttribute("d") ?? "")) {
      const span = across(rect, vertical);
      if (!onSide(span)) failures.push(`${part} ${span.join("–")}`);
    }
  }
  return failures;
}

/** The side a bar's drawn body shows, or null while it lies within a device pixel of the baseline. */
function drawnSide(body: Element, baseline: number, look: Look): boolean | null {
  const [start, end] = across(attributes(body), look.orientation === "vertical");
  const device = 1 / look.dpr;
  if (end - start < device - 1e-6) return null;
  const far = Math.abs(start - baseline) > Math.abs(end - baseline) ? start : end;
  if (Math.abs(far - baseline) < device - 1e-6) return null;
  return look.orientation === "vertical" ? far > baseline : far < baseline;
}

/** Mount, check at rest, update, check every tween frame, then check at rest again. */
async function sides(look: Look, before: readonly number[], after: readonly number[]): Promise<void> {
  await session().send("Emulation.setDeviceMetricsOverride", {
    width: 1024,
    height: 768,
    deviceScaleFactor: look.dpr,
    mobile: false,
  });
  await frame();
  // The tweens run on a hand-driven clock, so every frame lands at a known instant at any refresh rate.
  const clock = installFrameClock();
  const { host, rerender, unmount } = renderThemed(chart(before, look));
  try {
    const vertical = look.orientation === "vertical";
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{End}");
    // DOM audit: bars and the overlay are aria-hidden plot output.
    const bodies = () => [...host.querySelectorAll('[data-slot="chart-bar"]')];
    const overlay = () => host.querySelector('[data-slot="chart-bar-active"]');
    const anchor = bodies()[0];
    if (anchor === undefined) throw new Error("no bars");
    // Category a stands on the baseline: its bottom edge, or its left one.
    const [start, end] = across(attributes(anchor), vertical);
    const baseline = vertical ? end : start;
    const atRest = (readings: readonly number[], when: string): void => {
      const failures = readings.flatMap((reading, index) => {
        const body = bodies()[index + 1];
        if (body === undefined) return [`${when} ${String(index)}: no bar`];
        return wrongSides(body, reading < 0, baseline, look).map(
          (what) => `${when} ${String(reading)}: ${what}`
        );
      });
      const last = readings.at(-1) ?? 0;
      if (overlay()?.hasAttribute("data-negative") !== last < 0)
        failures.push(`${when} overlay ${String(last)}`);
      expect(failures).toEqual([]);
    };
    atRest(before, "before");
    const updated = clock.now();
    rerender(chart(after, look));
    // The commit, then a frame every 16 ms through the update token's 480 ms tween.
    for (let count = 0; count <= 30; count += 1) {
      const failures = after.flatMap((reading, index) => {
        const was = before[index] ?? 0;
        const body = bodies()[index + 1];
        if (body === undefined) return [];
        // A bar that keeps its side keeps it in every frame. One that crosses takes its drawn tip's.
        const side = was < 0 === reading < 0 ? reading < 0 : drawnSide(body, baseline, look);
        if (side === null) return [];
        return wrongSides(body, side, baseline, look).map(
          (what) => `frame ${String(count)} ${String(was)}→${String(reading)}: ${what}`
        );
      });
      expect(failures).toEqual([]);
      clock.frameAt(updated + (count + 1) * 16);
    }
    // 600 ms is past the 480 ms tween, so every mark rests.
    clock.frameAt(updated + 600);
    atRest(after, "after");
  } finally {
    unmount();
    clock.restore();
  }
}

/** Readings of every magnitude: 0, under a device pixel at any of the ratios, and whole bars. */
const reading = fc.oneof(
  fc.constant(0),
  fc.double({ min: 0.01, max: 0.2, noNaN: true }).chain((size) => fc.constantFrom(size, -size)),
  fc.integer({ min: -60, max: 60 })
);

describe("the side a bar draws on", () => {
  it("keeps a negative reading shorter than a pixel below zero, cap, squares and track", async () => {
    // B10-1: at 1x on 200 px over [-100, 100], -0.1 lies a tenth of a pixel below the baseline,
    // so its base and tip snap to one pixel. Its cap, squares and track stay below the baseline.
    for (const variant of ["striped", "blocks", "default"] as const) {
      await sides({ orientation: "vertical", variant, dpr: 1 }, [-2], [-0.1]);
    }
  });

  it("matches every side mark to the reading's sign, at rest and in every frame, at any magnitude", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          orientation: fc.constantFrom("vertical" as const, "horizontal" as const),
          variant: fc.constantFrom("default" as const, "striped" as const, "blocks" as const),
          dpr: fc.constantFrom(1, 1.5, 2),
        }),
        fc.array(reading, { minLength: 3, maxLength: 3 }),
        fc.array(reading, { minLength: 3, maxLength: 3 }),
        async (look, before, after) => {
          await sides(look, before, after);
        }
      ),
      {
        numRuns: 16,
        // Every run checks B10-1 horizontally at 1.5x, a reading of 0 joining from below, and a
        // sub-pixel crossing at 2x.
        examples: [
          [{ orientation: "horizontal", variant: "striped", dpr: 1.5 }, [-2, 5, 0], [-0.1, -0.05, 0]],
          [{ orientation: "vertical", variant: "blocks", dpr: 1 }, [-30, 0, 0.1], [0, -0.1, -0.15]],
          [{ orientation: "vertical", variant: "default", dpr: 2 }, [0.1, -0.1, 40], [-0.1, 0.1, -40]],
        ],
      }
    );
  }, 240_000);
});
