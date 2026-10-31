// Lines, areas and the marks on them, in Chromium, after ticket svg-2's checks. Unit under test:
// the whole path from Root's model to the drawn `d`, `cx` and `cy`. Oracles: vertex pixels worked
// out by hand from the fixture values on a 300 by 200 px plot, the device pixel grid, and the eased
// progress of motion-frames.json, which .scratch/charts-v1/tools/l05-oracles/motion_fixture.py
// writes by hand from cubic-bezier(0, 0.7, 0.5, 1). Every frame here runs on a hand-driven clock.
import { Profiler, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { flushSync } from "react-dom";
import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { installFrameClock } from "../../../test/chart/frame-clock";
import type { FrameClock } from "../../../test/chart/frame-clock";
import frames from "../../../test/chart/motion-frames.json" with { type: "json" };
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

/** The oracle's eased progress at a time, from its hand-written line positions. */
function easedAt(ms: 120 | 240 | 360): number {
  const { from, to, at } = frames.references.line;
  return (at[ms] - from) / (to - from);
}

const EASED = { 120: easedAt(120), 240: easedAt(240), 360: easedAt(360) } as const;

const WIDTH = 300;
const HEIGHT = 200;

let clock: FrameClock | null = null;

afterEach(() => {
  clock?.restore();
  clock = null;
});

type Row = { readonly name: string; readonly v: number | null; readonly w?: number };

const CONFIG = {
  v: { label: "Verdi", color: "chart-1" },
} as const satisfies ChartConfig;

const STACKED = {
  v: { label: "Under", color: "chart-1", stack: "s" },
  w: { label: "Over", color: "chart-2", stack: "s" },
} as const satisfies ChartConfig;

/** Rows named by their position, so two lists of the same length share every slot. */
function named(values: readonly (number | null)[], prefix = "c"): Row[] {
  return values.map((v, index) => ({ name: `${prefix}${String(index)}`, v }));
}

/** A line chart with no axes, so the plot is the whole 300 px frame, and no entrance. */
function LineChart({
  data,
  config = CONFIG,
  width = WIDTH,
  children,
}: {
  readonly data: readonly Row[];
  readonly config?: ChartConfig;
  readonly width?: number;
  readonly children?: ReactNode;
}): ReactNode {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width }}>
        <Chart.Root
          data={data}
          config={config}
          xKey="name"
          xScale="point"
          data-intro="none"
          aria-label="Verdier">
          {children ?? <Chart.Line dataKey="v" curve="linear" />}
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

/** The vertices of a path's data, each command's end point in order. */
function vertices(d: string | null): (readonly [number, number])[] {
  const numbers = (d ?? "").match(/-?\d+(?:\.\d+)?/gu)?.map(Number) ?? [];
  return Array.from(
    { length: numbers.length / 2 },
    (_, index) => [numbers[index * 2] ?? 0, numbers[index * 2 + 1] ?? 0] as const
  );
}

/** The solid path of the first Line. */
function linePath(host: HTMLElement): string | null {
  // DOM audit: the line is aria-hidden plot output, so its slot is the only locator.
  return (
    host
      .querySelector('[data-slot="chart-line"][data-part="solid"]:not([data-outgoing] *)')
      ?.getAttribute("d") ?? null
  );
}

/**
 * Where a point mark draws an unsnapped place along the slot axis: on the centre of the 1 px column
 * the crosshair draws, moved inside the plot's last pixel, while a place past the plot stays put.
 */
function columnOf(along: number): number {
  const whole = Math.round(along);
  return (whole > WIDTH - 1 && whole <= WIDTH ? WIDTH - 1 : whole) + 0.5;
}

/** A point on the 300 by 200 plot: its slot's place among `count` point slots, and its value of 0 to 100. */
function pixel(position: number, count: number, value: number): readonly [number, number] {
  return [columnOf((position * WIDTH) / (count - 1)), Math.round(HEIGHT - (HEIGHT * value) / 100)];
}

/** The pixel of a point moving between two unsnapped places and values at an eased progress. */
function moving(
  from: readonly [along: number, value: number],
  to: readonly [along: number, value: number],
  eased: number
): readonly [number, number] {
  const along = from[0] + (to[0] - from[0]) * eased;
  const value = from[1] + (to[1] - from[1]) * eased;
  return [columnOf(along), Math.round(HEIGHT - (HEIGHT * value) / 100)];
}

/** A point slot's unsnapped place along the slot axis. */
function place(position: number, count: number): number {
  return (position * WIDTH) / (count - 1);
}

/** An element's opacity at a time into its first animation, or NaN without one. */
function opacityAt(element: Element | null | undefined, ms: number): number {
  if (element === null || element === undefined) return Number.NaN;
  const [animation] = element.getAnimations();
  if (animation === undefined) return Number.NaN;
  animation.pause();
  animation.currentTime = ms;
  return Number(getComputedStyle(element).opacity);
}

/**
 * An element's effective opacity at a time into the page's animations: its own opacity times every
 * ancestor's, as the browser composites it, with each animation paused at that time.
 */
function effectiveOpacityAt(element: Element | null | undefined, ms: number): number {
  for (const animation of document.getAnimations()) {
    animation.pause();
    animation.currentTime = ms;
  }
  let opacity = 1;
  for (let node = element ?? null; node !== null; node = node.parentElement) {
    opacity *= Number(getComputedStyle(node).opacity);
  }
  return element === null || element === undefined ? Number.NaN : opacity;
}

/** A point mark's drawn centre. */
function centreOf(dot: Element | null | undefined): readonly [number, number] {
  return [Number(dot?.getAttribute("cx")), Number(dot?.getAttribute("cy"))];
}

/** Assert the drawn origin is a whole pixel, so a snapped coordinate is a rounded one. */
function expectWholeOrigin(host: HTMLElement): void {
  // DOM audit: the plot box is Root's measured element.
  const plot = host.querySelector('[data-slot="chart-plot"]')?.getBoundingClientRect();
  expect([plot?.width, plot?.height]).toEqual([WIDTH, HEIGHT]);
  expect(Number.isInteger(plot?.left) && Number.isInteger(plot?.top)).toBe(true);
}

// Values chosen so the zero-based domain is 0 to 100 and every resting pixel is whole.
const A = [10, 40, 25, 100, 60, 35, 80];
const B = [30, 20, 50, 90, 100, 15, 45];

describe("Line and Area geometry", () => {
  it("draws a line's vertices at the hand-computed pixels, and again after a resize", async () => {
    const { host, rerender } = renderThemed(<LineChart data={named(A)} />);
    expectWholeOrigin(host);
    expect(vertices(linePath(host))).toEqual(A.map((value, index) => pixel(index, A.length, value)));
    rerender(<LineChart data={named(A)} width={600} />);
    // The resize reaches Root through its ResizeObserver. At 600 px the slots sit 100 px apart, and
    // the last one moves inside the plot's last pixel.
    await expect
      .poll(() => vertices(linePath(host)).map(([x]) => x))
      .toEqual([0.5, 100.5, 200.5, 300.5, 400.5, 500.5, 599.5]);
  });

  it("stacks an area on the series below it, and draws its line on the stack's top", () => {
    const data = named([10, 20, 30]).map((row, index) => ({ ...row, w: [40, 30, 70][index] ?? 0 }));
    const { host } = renderThemed(
      <LineChart data={data} config={STACKED}>
        <Chart.Area dataKey="v" curve="linear" />
        <Chart.Area dataKey="w" curve="linear" />
        <Chart.Line dataKey="w" curve="linear" />
      </LineChart>
    );
    // DOM audit: areas are aria-hidden plot output.
    const [under, over] = [...host.querySelectorAll('[data-slot="chart-area"][data-part="solid"]')];
    // The stack's tallest total is 100, so the domain is 0 to 100 and each value is 2 px.
    expect(vertices(under?.getAttribute("d") ?? null)).toEqual([
      [0.5, 180],
      [150.5, 160],
      [299.5, 140],
      [299.5, 200],
      [150.5, 200],
      [0.5, 200],
    ]);
    expect(vertices(over?.getAttribute("d") ?? null)).toEqual([
      [0.5, 100],
      [150.5, 100],
      [299.5, 0],
      [299.5, 140],
      [150.5, 160],
      [0.5, 180],
    ]);
    expect(vertices(linePath(host))).toEqual([
      [0.5, 100],
      [150.5, 100],
      [299.5, 0],
    ]);
  });

  it("leaves a gap at a missing reading and draws a reading between two gaps as a dot", () => {
    const { host } = renderThemed(<LineChart data={named([20, 40, null, 100, null, 60, 80])} />);
    const d = linePath(host) ?? "";
    // Three subpaths: the first run, the lone reading's dot, and the last run.
    expect(d.match(/M/gu)).toHaveLength(3);
    // The dot is two arcs of 2.5 px around the lone reading at slot 3.
    expect(d).toContain("M148,0a2.5,2.5 0 1,0 5,0a2.5,2.5 0 1,0 -5,0");
  });

  it("bridges a missing reading under missing: connect, dashed", () => {
    const config = {
      v: { label: "Verdi", color: "chart-1", missing: "connect" },
    } as const satisfies ChartConfig;
    const { host } = renderThemed(<LineChart data={named([20, 40, null, 100])} config={config} />);
    expect(vertices(linePath(host))).toEqual([pixel(0, 4, 20), pixel(1, 4, 40), pixel(3, 4, 100)]);
    // DOM audit: the dashed twin and its clip are aria-hidden plot output.
    const twin = host.querySelector('[data-slot="chart-line"][data-part="marked"]');
    expect(twin?.getAttribute("d")).toBe(linePath(host));
    const clip = host.querySelector('[data-part="marked-clip"] > rect');
    // The bridge runs from slot 1 to slot 3.
    expect([Number(clip?.getAttribute("x")), Number(clip?.getAttribute("width"))]).toEqual([100.5, 199]);
  });
});

describe("a hatched Area's marked spans (F6)", () => {
  /** The period of the pattern a mask's rect paints with, by the pattern's own width. */
  function maskPeriod(host: HTMLElement, mask: string): number {
    // DOM audit: an area's masks and patterns are aria-hidden paint servers.
    const fill = host.querySelector(`mask[id$="-${mask}"] > rect`)?.getAttribute("fill") ?? "";
    const id = /^url\(#(.+)\)$/u.exec(fill)?.[1] ?? "";
    return Number(host.querySelector(`pattern[id="${id}"]`)?.getAttribute("width"));
  }

  it("hatches an estimated span at half the period of the hatched fill", () => {
    const config = {
      v: { label: "Verdi", color: "chart-1", qualityKey: "q" },
    } as const satisfies ChartConfig;
    const data = named([20, 40, 60]).map((row, index) => ({
      ...row,
      q: index === 2 ? "estimated" : "measured",
    }));
    const { host } = renderThemed(
      <LineChart data={data} config={config}>
        <Chart.Area dataKey="v" curve="linear" variant="hatched" />
      </LineChart>
    );
    // The fill's hatch repeats every 6 px across its stripes, the marked twin's every 3 px.
    expect([maskPeriod(host, "look"), maskPeriod(host, "marks")]).toEqual([6, 3]);
  });

  it("keeps the 6 px hatch for the marked spans of any other look", () => {
    const config = {
      v: { label: "Verdi", color: "chart-1", qualityKey: "q" },
    } as const satisfies ChartConfig;
    const data = named([20, 40, 60]).map((row, index) => ({
      ...row,
      q: index === 2 ? "estimated" : "measured",
    }));
    const { host } = renderThemed(
      <LineChart data={data} config={config}>
        <Chart.Area dataKey="v" curve="linear" variant="lines" />
      </LineChart>
    );
    expect([maskPeriod(host, "look"), maskPeriod(host, "marks")]).toEqual([5, 6]);
  });
});

describe("Line strokes on device pixels (B1-10)", () => {
  it("draws a flat line's stroke over whole device pixels at 1, 2 and 3 px", () => {
    // 50 of [0, 100] on the 200 px plot lies at y = 100 at DPR 1. A 2 px stroke centres on that
    // edge and covers rows 99 and 100; a quiet 1 px stroke and a consumer's 3 px one centre half a
    // pixel lower, on 100.5, and cover row 100, or rows 99 to 101.
    const cases = [
      { variant: "default", style: undefined, y: 100 },
      { variant: "quiet", style: undefined, y: 100.5 },
      { variant: "default", style: { "--chart-stroke": "3px" }, y: 100.5 },
    ] as const;
    for (const { variant, style, y } of cases) {
      const { host, unmount } = renderThemed(
        <LineChart data={named([50, 50, 100])}>
          <Chart.Line dataKey="v" curve="linear" variant={variant} style={style} />
        </LineChart>
      );
      expectWholeOrigin(host);
      expect(
        vertices(linePath(host))
          .slice(0, 2)
          .map(([, across]) => across)
      ).toEqual([y, y]);
      unmount();
    }
  });
});

describe("Line strokes follow an inherited width (review 2, Y7)", () => {
  it("moves a flat line onto the half pixel when Root's --chart-stroke goes from 2 to 3 px with no resize", () => {
    // 50 of [0, 100] on the 200 px plot lies at y = 100 at DPR 1. A 2 px stroke centres on that
    // edge, and a 3 px one half a pixel lower, on 100.5, so it covers rows 99 to 101. Nothing
    // resizes and the Line's own props stay, so only Root's inherited width changes.
    const chart = (stroke: string): ReactNode => (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: WIDTH }}>
          <Chart.Root
            data={named([50, 50, 100])}
            config={CONFIG}
            xKey="name"
            xScale="point"
            data-intro="none"
            style={{ "--chart-stroke": stroke }}
            aria-label="Verdier">
            <Chart.Line dataKey="v" curve="linear" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const across = (host: HTMLElement): number[] =>
      vertices(linePath(host))
        .slice(0, 2)
        .map(([, y]) => y);
    const { host, rerender } = renderThemed(chart("2px"));
    expect(across(host)).toEqual([100, 100]);
    rerender(chart("3px"));
    expectWholeOrigin(host);
    expect(across(host)).toEqual([100.5, 100.5]);
    rerender(chart("2px"));
    expect(across(host)).toEqual([100, 100]);
  });
});

describe("Line step risers on device pixels (B2-9, Q2-6)", () => {
  it("centres a 1 px riser inside the band its run starts, and a 2 px one on the band edge", () => {
    // Two band slots on the 200 px plot, 100 px each, reading 50 and 100 of [0, 100]. At DPR 1 a
    // quiet 1 px step-after line moves every run edge and value half a pixel, so its riser
    // centres at 100.5 and covers column 100, the second band's first. A 2 px line stays on the
    // edges and covers columns 99 and 100.
    const cases = [
      { variant: "quiet", d: "M0.5,100.5L100.5,100.5L100.5,0.5L200.5,0.5" },
      { variant: "default", d: "M0,100L100,100L100,0L200,0" },
    ] as const;
    for (const { variant, d } of cases) {
      const { host, unmount } = renderThemed(
        <LocaleProvider locale="nb-NO">
          <div style={{ width: 200 }}>
            <Chart.Root
              data={named([50, 100])}
              config={CONFIG}
              xKey="name"
              yInclude={[0, 100]}
              data-intro="none"
              aria-label="Trapp">
              <Chart.Line dataKey="v" curve="step-after" variant={variant} />
            </Chart.Root>
          </div>
        </LocaleProvider>
      );
      expect(linePath(host)).toBe(d);
      unmount();
    }
  });
});

describe("plain step risers on device pixels (B3-1)", () => {
  it("centres a 2 px riser on the band edge and a 1 px one just inside the next band", () => {
    // Two band slots on 200 px, 50 and 100 of [0, 100]: the vertices sit on the crosshair columns
    // at 50.5 and 150.5, and the riser halfway between the slots' centres, at the band edge 100.
    // A 2 px stroke centres on it, and a quiet 1 px one half a pixel past it, as the values move.
    const cases = [
      { variant: "default", d: "M50.5,100L100,100L100,0L150.5,0" },
      { variant: "quiet", d: "M50.5,100.5L100.5,100.5L100.5,0.5L150.5,0.5" },
    ] as const;
    for (const { variant, d } of cases) {
      const { host, unmount } = renderThemed(
        <LocaleProvider locale="nb-NO">
          <div style={{ width: 200 }}>
            <Chart.Root
              data={named([50, 100])}
              config={CONFIG}
              xKey="name"
              yInclude={[0, 100]}
              data-intro="none"
              aria-label="Trapp">
              <Chart.Line dataKey="v" curve="step" variant={variant} />
            </Chart.Root>
          </div>
        </LocaleProvider>
      );
      expect(linePath(host)).toBe(d);
      unmount();
    }
  });
});

describe("Line and Area motion", () => {
  it("tweens each vertex through the eased midpoints, and ends on the resting path", () => {
    clock = installFrameClock();
    const { host, rerender } = renderThemed(<LineChart data={named(A)} />);
    const start = clock.now();
    rerender(<LineChart data={named(B)} />);
    for (const ms of [120, 240, 360] as const) {
      clock.frameAt(start + ms);
      // The tween moves unsnapped numbers, and each frame snaps what it draws.
      expect(vertices(linePath(host))).toEqual(
        A.map((value, index) => moving([place(index, 7), value], [place(index, 7), B[index] ?? 0], EASED[ms]))
      );
    }
    clock.frameAt(start + 480);
    expect(vertices(linePath(host))).toEqual(B.map((value, index) => pixel(index, B.length, value)));
  });

  it("moves a stacked area's top with the line on the same series in every frame", () => {
    clock = installFrameClock();
    const stack = (top: readonly number[]) =>
      named([10, 20, 10]).map((row, index) => ({ ...row, w: top[index] ?? 0 }));
    const parts = (
      <>
        <Chart.Area dataKey="v" curve="linear" />
        <Chart.Area dataKey="w" curve="linear" />
        <Chart.Line dataKey="w" curve="linear" />
      </>
    );
    const { host, rerender } = renderThemed(
      <LineChart data={stack([30, 40, 90])} config={STACKED}>
        {parts}
      </LineChart>
    );
    const start = clock.now();
    rerender(
      <LineChart data={stack([60, 10, 50])} config={STACKED}>
        {parts}
      </LineChart>
    );
    for (const ms of [120, 240, 360] as const) {
      clock.frameAt(start + ms);
      // DOM audit: the upper area's fill, whose first half is its top edge.
      const top = vertices(
        host.querySelectorAll('[data-slot="chart-area"][data-part="solid"]')[1]?.getAttribute("d") ?? null
      ).slice(0, 3);
      expect(top).toEqual(vertices(linePath(host)));
    }
  });

  it("continues from the drawn vertices when a second update lands at 240 ms", () => {
    clock = installFrameClock();
    const { host, rerender } = renderThemed(<LineChart data={named(A)} />);
    const start = clock.now();
    rerender(<LineChart data={named(B)} />);
    clock.frameAt(start + 240);
    const drawn = vertices(linePath(host));
    rerender(<LineChart data={named(A)} />);
    // The second update's first frame draws where the first one was, with no jump.
    expect(vertices(linePath(host))).toEqual(drawn);
    clock.frameAt(start + 240 + 480);
    expect(vertices(linePath(host))).toEqual(A.map((value, index) => pixel(index, A.length, value)));
  });

  it("slides an append that drops the first reading one slot left through the eased midpoints", () => {
    clock = installFrameClock();
    const before = named(A);
    const after = [...before.slice(1), { name: "c7", v: 50 }];
    const { host, rerender } = renderThemed(<LineChart data={before} />);
    const start = clock.now();
    rerender(<LineChart data={after} />);
    clock.frameAt(start + 240);
    // The route holds the leaving first reading, the six that stay and the new one, in axis order.
    // Each keeps its value and moves left by one slot: the first to one slot before the plot, the
    // new one from one slot past it.
    const route = [...A, 50].map((value, index) =>
      moving([place(index, 7), value], [place(index - 1, 7), value], EASED[240])
    );
    expect(vertices(linePath(host))).toEqual(route);
    clock.frameAt(start + 480);
    expect(vertices(linePath(host))).toEqual(
      [...A.slice(1), 50].map((value, index) => pixel(index, A.length, value))
    );
  });

  it("pairs September with October by position and grows the 31st day out of the old end", () => {
    clock = installFrameClock();
    const september = named(
      Array.from({ length: 30 }, (_, day) => (day % 5) * 20 + 10),
      "s"
    );
    const october = named(
      Array.from({ length: 31 }, (_, day) => ((day + 2) % 5) * 20 + 10),
      "o"
    );
    const { host, rerender } = renderThemed(<LineChart data={september} />);
    const start = clock.now();
    rerender(<LineChart data={october} />);
    clock.frameAt(start + 240);
    const drawn = vertices(linePath(host));
    expect(drawn).toHaveLength(31);
    // The 31st vertex starts on September's 30th, at the plot's last pixel.
    expect(drawn[30]).toEqual(
      moving([place(29, 30), september[29]?.v ?? 0], [place(30, 31), october[30]?.v ?? 0], EASED[240])
    );
    expect(drawn[3]).toEqual(
      moving([place(3, 30), september[3]?.v ?? 0], [place(3, 31), october[3]?.v ?? 0], EASED[240])
    );
    clock.frameAt(start + 480);
    expect(vertices(linePath(host))).toEqual(october.map((row, index) => pixel(index, 31, row.v ?? 0)));
    // Back to September: the 31st shrinks into the new end, and the rest is September's own path.
    rerender(<LineChart data={september} />);
    clock.frameAt(start + 960);
    expect(vertices(linePath(host))).toEqual(september.map((row, index) => pixel(index, 30, row.v ?? 0)));
  });

  it("crossfades a window that grows on another side over 150 ms", () => {
    clock = installFrameClock();
    const { host, rerender } = renderThemed(<LineChart data={named([20, 40, 100], "h")} />);
    rerender(<LineChart data={[...named([10, 30], "g"), ...named([20, 40, 100], "h")]} />);
    // DOM audit: the line's live group and the outgoing copy are aria-hidden plot output.
    const live = host.querySelector(
      '[data-slot="chart-line"][data-part="solid"]:not([data-outgoing] *)'
    )?.parentElement;
    const copy = host.querySelector("[data-outgoing]");
    expect(copy).not.toBeNull();
    expect([opacityAt(live, 0), opacityAt(copy, 0)]).toEqual([0, 1]);
    const midway = [opacityAt(live, 75), opacityAt(copy, 75)];
    expect(midway.every((value) => value > 0 && value < 1)).toBe(true);
    expect(opacityAt(live, 149.9)).toBeGreaterThan(0.99);
    // The new path is drawn whole at once: no frame mixes the two.
    expect(vertices(linePath(host))).toEqual(
      [10, 30, 20, 40, 100].map((value, index) => pixel(index, 5, value))
    );
  });

  it("crossfades the marker, its pill and the active dot with their path (B1-7)", async () => {
    clock = installFrameClock();
    const chart = (data: readonly Row[]) => (
      <LineChart data={data}>
        <Chart.Line dataKey="v" curve="linear" />
        <Chart.Marker dataKey="v" at="first">
          <Chart.ValueLabel />
        </Chart.Marker>
        <Chart.ActiveDot dataKey="v" />
      </LineChart>
    );
    const { host, rerender } = renderThemed(chart(named([20, 40, 100], "h")));
    // DOM audit: the plot's single tab stop is the listbox's option. The second slot, h1, goes active.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{Home}{ArrowRight}");
    rerender(chart([...named([10, 30], "g"), ...named([20, 40, 100], "h")]));
    // DOM audit: the marker, its pill and the active dot are aria-hidden plot output, and each
    // outgoing copy carries data-outgoing.
    const marker = host.querySelector('[data-slot="chart-marker"]:not([data-outgoing])');
    const oldMarker = host.querySelector('[data-slot="chart-marker"][data-outgoing]');
    const dot = host.querySelector('[data-slot="chart-active-dot"]:not([data-outgoing])');
    const oldDot = host.querySelector('[data-slot="chart-active-dot"][data-outgoing]');
    // The old marker stays on the first slot of three at 20, with its old text, and fades out,
    // while the live one rests on the first slot of five at 10 and fades in.
    expect(centreOf(oldMarker?.querySelector('[data-slot="chart-dot"]'))).toEqual(pixel(0, 3, 20));
    expect(oldMarker?.querySelector('[data-slot="chart-value-label"]')?.textContent).toBe("20");
    expect(centreOf(marker?.querySelector(':scope > svg > [data-slot="chart-dot"]'))).toEqual(
      pixel(0, 5, 10)
    );
    expect(
      marker?.querySelector(':scope > [data-part="anchor"] [data-slot="chart-value-label"]')?.textContent
    ).toBe("10");
    expect([opacityAt(marker, 75), opacityAt(oldMarker, 75)].every((value) => value > 0 && value < 1)).toBe(
      true
    );
    // The active dot on h1 fades out where it was, the second slot of three, and in on the fourth of five.
    // DOM audit: the active dot's circles are aria-hidden plot output.
    expect(centreOf(oldDot?.querySelector('[data-slot="chart-dot"]'))).toEqual(pixel(1, 3, 40));
    expect(centreOf(dot?.querySelector(':scope > [data-slot="chart-dot"]'))).toEqual(pixel(3, 5, 40));
    expect([opacityAt(dot, 75), opacityAt(oldDot, 75)].every((value) => value > 0 && value < 1)).toBe(true);
  });

  it("fades the old marker out beside the live one at its own opacity, twice in a row (B2-2, Q2-1)", () => {
    clock = installFrameClock();
    const chart = (data: readonly Row[]) => (
      <LineChart data={data}>
        <Chart.Line dataKey="v" curve="linear" />
        <Chart.Marker dataKey="v" at="first">
          <Chart.ValueLabel />
        </Chart.Marker>
      </LineChart>
    );
    const first = named([20, 40, 100], "h");
    const second = [...named([10, 30], "g"), ...first];
    const { host, rerender } = renderThemed(chart(first));
    rerender(chart(second));
    // DOM audit: the marker and its copy are aria-hidden plot output; the copy carries data-outgoing.
    const live = host.querySelector('[data-slot="chart-marker"]:not([data-outgoing])');
    const old = host.querySelector('[data-slot="chart-marker"][data-outgoing]');
    expect(old?.parentElement?.closest('[data-slot="chart-marker"]')).toBeNull();
    // Over the 150 ms linear fade the old marker goes from 1 to 0 and the live one from 0 to 1,
    // each as composited through its ancestors.
    expect([effectiveOpacityAt(old, 0), effectiveOpacityAt(live, 0)]).toEqual([1, 0]);
    expect(effectiveOpacityAt(old, 75)).toBeCloseTo(0.5, 2);
    expect(effectiveOpacityAt(live, 75)).toBeCloseTo(0.5, 2);
    for (const animation of document.getAnimations()) animation.finish();
    // A second window that grows on the start side crossfades again, and fades one copy, the
    // marker the first fade left, at 10, which holds no copy of its own.
    rerender(chart([...named([5], "f"), ...second]));
    const copies = [...host.querySelectorAll('[data-slot="chart-marker"][data-outgoing]')];
    expect(copies).toHaveLength(1);
    expect(copies[0]?.querySelector("[data-outgoing]")).toBeNull();
    expect(copies[0]?.querySelector('[data-slot="chart-value-label"]')?.textContent).toBe("10");
  });

  it("never starts a finished crossfade again on a key step (B2-3)", async () => {
    clock = installFrameClock();
    const chart = (data: readonly Row[]) => (
      <LineChart data={data}>
        <Chart.Line dataKey="v" curve="linear" />
        <Chart.ActiveDot dataKey="v" />
        <Chart.ActiveValueLine dataKey="v">
          <Chart.ValueLabel />
        </Chart.ActiveValueLine>
      </LineChart>
    );
    const { host, rerender } = renderThemed(chart(named([20, 40, 100], "h")));
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{Home}");
    rerender(chart([...named([10, 30], "g"), ...named([20, 40, 100], "h")]));
    // DOM audit: each outgoing copy carries data-outgoing.
    expect(host.querySelectorAll("[data-outgoing]").length).toBeGreaterThan(0);
    // Each copy leaves when its fade's finish event runs, in the next rendering step.
    for (const animation of document.getAnimations()) animation.finish();
    await expect.poll(() => host.querySelectorAll("[data-outgoing]").length).toBe(0);
    await userEvent.keyboard("{ArrowRight}");
    expect(host.querySelectorAll("[data-outgoing]")).toHaveLength(0);
    expect(document.getAnimations()).toHaveLength(0);
  });

  it("moves a Marker and an ActiveDot on a slot decimation leaves out with the line (Q3-3)", () => {
    // 2,400 point slots of 20 on the 300 by 200 px plot over [0, 100]: M4 keeps each 8-slot
    // column's first and last slot, so c1203 draws no vertex. Every reading turns 40, and the line
    // tweens from y = 160 to 120, so at 120 ms it lies at 160 - 40 × eased, and the marks on c1203
    // lie on it there, on the device pixel the line's value snaps to.
    clock = installFrameClock();
    const values = (v: number) => named(Array.from({ length: 2400 }, () => v));
    const chart = (data: readonly Row[]) => (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: WIDTH }}>
          <Chart.Root
            data={data}
            config={CONFIG}
            xKey="name"
            xScale="point"
            yInclude={[0, 100]}
            data-intro="none"
            aria-label="Tett">
            <Chart.Line dataKey="v" curve="linear" />
            <Chart.Marker dataKey="v" at={{ x: "c1203" }} />
            <Chart.ActiveDot dataKey="v" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const { host, rerender } = renderThemed(chart(values(20)));
    // DOM audit: the listbox is the plot's pointer surface; the line and marks are aria-hidden output.
    const surface = host.querySelector<HTMLElement>('[role="listbox"]');
    const box = surface?.getBoundingClientRect() ?? new DOMRect();
    surface?.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: box.left + (1203 * WIDTH) / 2399,
        clientY: box.top + HEIGHT / 2,
        pointerType: "mouse",
      })
    );
    // Column 150 holds slots 1,200 to 1,207, all 20, so it keeps 1,200 and 1,207 alone: two
    // vertices for each of the 300 columns, and none for c1203.
    expect(vertices(linePath(host))).toHaveLength(600);
    const start = clock.now();
    rerender(chart(values(40)));
    clock.frameAt(start + 120);
    const y = Math.round(160 - 40 * EASED[120]);
    expect(vertices(linePath(host))[0]?.[1]).toBe(y);
    // DOM audit: the marker's and the active dot's circles are aria-hidden plot output.
    const marker = host.querySelector('[data-slot="chart-marker"] > svg > [data-slot="chart-dot"]');
    const active = host.querySelector('[data-slot="chart-active-dot"] > [data-slot="chart-dot"]');
    expect([centreOf(marker)[1], centreOf(active)[1]]).toEqual([y, y]);
    clock.frameAt(start + 600);
    expect([centreOf(marker)[1], centreOf(active)[1]]).toEqual([120, 120]);
  });

  it("keeps an ActiveDot on the Area's path after the Line beside it unmounts (X9, Q1-2)", () => {
    // 2,400 point slots on the 300 by 200 px plot over [0, 100]: column 150 holds slots 1,200 to
    // 1,207, read 10, 50, 0, 30, 20, 20, 20, 20. M4 keeps the first, the highest, the lowest and the
    // last, so c1203 draws no vertex, and the path passes it a fifth of the way from 0 at c1202 to
    // 20 at c1207: 4, at y = 200 - 4 × 2 = 192. The reading itself, 30, sits at y = 140.
    const COLUMN = [10, 50, 0, 30, 20, 20, 20, 20];
    const rows = named(Array.from({ length: 2400 }, (_, slot) => COLUMN[slot - 1200] ?? 20));
    let hideLine = (): void => undefined;
    function ToggledLine(): ReactNode {
      const [shown, setShown] = useState(true);
      useEffect(() => {
        hideLine = () => setShown(false);
      }, []);
      return shown ? <Chart.Line dataKey="v" curve="linear" /> : null;
    }
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: WIDTH }}>
          <Chart.Root
            data={rows}
            config={CONFIG}
            xKey="name"
            xScale="point"
            yInclude={[0, 100]}
            data-intro="none"
            aria-label="Tett">
            <Chart.Area dataKey="v" curve="linear" />
            <ToggledLine />
            <Chart.ActiveDot dataKey="v" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: the listbox is the plot's pointer surface; the active dot is aria-hidden output.
    const surface = host.querySelector<HTMLElement>('[role="listbox"]');
    const point = (slot: number) => {
      const box = surface?.getBoundingClientRect() ?? new DOMRect();
      surface?.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: box.left + (slot * WIDTH) / 2399,
          clientY: box.top + HEIGHT / 2,
          pointerType: "mouse",
        })
      );
    };
    const activeY = () =>
      centreOf(host.querySelector('[data-slot="chart-active-dot"] > [data-slot="chart-dot"]'))[1];
    point(1203);
    expect(activeY()).toBe(192);
    // Only the Line's own component renders, so the Area places nothing new.
    flushSync(hideLine);
    point(1100);
    point(1203);
    expect(activeY()).toBe(192);
  });

  it("keeps an ActiveDot on the Area's tween when the Line beside it unmounts mid-tween (review 2, Y3)", async () => {
    // Data A to B moves the second of 7 point slots from 40 to 20, at x = 50 on the 300 px plot.
    // The ActiveDot joins the Line's tween. The Line unmounts at 120 ms with no pointer move, and
    // the dot rides the Area's vertex, which tweens on the same clock, until it rests at 20.
    clock = installFrameClock();
    let hideLine = (): void => undefined;
    function ToggledLine(): ReactNode {
      const [shown, setShown] = useState(true);
      useEffect(() => {
        hideLine = () => setShown(false);
      }, []);
      return shown ? <Chart.Line dataKey="v" curve="linear" /> : null;
    }
    const chart = (data: readonly Row[]) => (
      <LineChart data={data}>
        <Chart.Area dataKey="v" curve="linear" />
        <ToggledLine />
        <Chart.ActiveDot dataKey="v" />
      </LineChart>
    );
    const { host, rerender } = renderThemed(chart(named(A)));
    // DOM audit: the listbox is the plot's pointer surface; the active dot is aria-hidden output.
    const surface = host.querySelector<HTMLElement>('[role="listbox"]');
    const box = surface?.getBoundingClientRect() ?? new DOMRect();
    surface?.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: box.left + place(1, 7),
        clientY: box.top + HEIGHT / 2,
        pointerType: "mouse",
      })
    );
    const active = () =>
      centreOf(host.querySelector('[data-slot="chart-active-dot"] > [data-slot="chart-dot"]'));
    expect(active()).toEqual(pixel(1, 7, 40));
    const start = clock.now();
    rerender(chart(named(B)));
    const at = (ms: 120 | 240 | 360) => moving([place(1, 7), 40], [place(1, 7), 20], EASED[ms]);
    clock.frameAt(start + 120);
    expect(active()).toEqual(at(120));
    flushSync(hideLine);
    // The followers rebuild their joins in the microtask after the Line's commit.
    await Promise.resolve();
    for (const ms of [240, 360] as const) {
      clock.frameAt(start + ms);
      expect(active()).toEqual(at(ms));
    }
    clock.frameAt(start + 600);
    expect(active()).toEqual(pixel(1, 7, 20));
  });

  it("keeps dots, the marker and its pill on their vertices in every frame, with no React commit", () => {
    clock = installFrameClock();
    let commits = 0;
    const chart = (data: readonly Row[]) => (
      <Profiler id="chart" onRender={() => (commits += 1)}>
        <LineChart data={data}>
          <Chart.Line dataKey="v" curve="linear" />
          <Chart.Dots dataKey="v" />
          <Chart.Marker dataKey="v" at="last">
            <Chart.ValueLabel />
          </Chart.Marker>
        </LineChart>
      </Profiler>
    );
    const { host, rerender } = renderThemed(chart(named(A)));
    const start = clock.now();
    rerender(chart(named(B)));
    commits = 0;
    for (const ms of [120, 240, 360, 480] as const) {
      clock.frameAt(start + ms);
      const line = vertices(linePath(host));
      // DOM audit: dots and the marker are aria-hidden plot output.
      const dots = [...host.querySelectorAll('[data-slot="chart-dots"] [data-slot="chart-dot"]')].map(
        (dot) => [Number(dot.getAttribute("cx")), Number(dot.getAttribute("cy"))] as const
      );
      expect(dots).toEqual(line);
      const marker = host.querySelector('[data-slot="chart-marker"] [data-slot="chart-dot"]');
      expect([Number(marker?.getAttribute("cx")), Number(marker?.getAttribute("cy"))]).toEqual(line.at(-1));
      const anchor = host.querySelector<HTMLElement>('[data-slot="chart-marker"] [data-part="anchor"]');
      expect(Number.parseFloat(anchor?.style.getPropertyValue("--chart-marker-x") ?? "")).toBeCloseTo(
        line.at(-1)?.[0] ?? 0,
        1
      );
    }
    expect(commits).toBe(0);
  });
});

describe("point marks after a commit that changes what they draw (review 2, Y1 and Y2)", () => {
  it("moves the ring an ActiveDot mounts when its variant turns to ping without a resize", async () => {
    // A[0] = 10 and A[1] = 40 of [0, 100], on the first and second of 7 point slots. Both of the
    // ping variant's circles, the ring the commit mounts and the dot, centre on the active vertex.
    const chart = (variant: "default" | "ping") => (
      <LineChart data={named(A)}>
        <Chart.Line dataKey="v" curve="linear" />
        <Chart.ActiveDot dataKey="v" variant={variant} />
      </LineChart>
    );
    const { host, rerender } = renderThemed(chart("default"));
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{Home}");
    rerender(chart("ping"));
    await userEvent.keyboard("{ArrowRight}");
    // DOM audit: the active dot's circles are aria-hidden plot output.
    const circles = [...host.querySelectorAll('[data-slot="chart-active-dot"] > [data-slot="chart-dot"]')];
    expect(circles.map((circle) => circle.getAttribute("data-part"))).toEqual(["ping", null]);
    expect(circles.map((circle) => centreOf(circle))).toEqual([pixel(1, 7, 40), pixel(1, 7, 40)]);
  });

  it("moves standalone Dots to the plot's edges when the x scale turns from band to point", async () => {
    // Three slots on the 300 px plot, reading 20, 40 and 100 of [0, 100]. Band centres lie at 50,
    // 150 and 250 px, and point places at 0, 150 and 300 px, each on its 1 px column. The data
    // and the size stay, the same rows included, so only the scale moves the dots.
    const data = named([20, 40, 100]);
    const chart = (xScale: "band" | "point") => (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: WIDTH }}>
          <Chart.Root
            data={data}
            config={CONFIG}
            xKey="name"
            xScale={xScale}
            data-intro="none"
            aria-label="Verdier">
            <Chart.Dots dataKey="v" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: dots are aria-hidden plot output.
    const centres = (host: HTMLElement) =>
      [
        ...host.querySelectorAll('[data-slot="chart-dots"] [data-slot="chart-dot"]:not([data-outgoing] *)'),
      ].map((dot) => centreOf(dot));
    const { host, rerender } = renderThemed(chart("band"));
    expect(centres(host)).toEqual([
      [50.5, 160],
      [150.5, 120],
      [250.5, 0],
    ]);
    rerender(chart("point"));
    // The dots follow Root's commit in the microtask after it, before the next frame.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(centres(host)).toEqual([
      [0.5, 160],
      [150.5, 120],
      [299.5, 0],
    ]);
  });
});
