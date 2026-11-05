// The stack floors through bars and columns at rest and through the data updates whose floor changes
// hands, in Chromium. Unit under test: the whole bar path from the model to the drawn polygon or path,
// through the plot frame's pixel floor and the stack floors' settlement, in both forms, each motion
// case judged only in frames where a loose probe bar shows the tween under way. Oracles, none computed
// by the code under test: a non-zero reading draws one device pixel or more and stays inside the plot,
// also when the zero rule lies on the plot's edge; a stack's segments abut at rest, show in every
// frame, and floor one segment a side, never on another segment's pixel; and the active overlay draws
// its bar's geometry.
import type { ReactNode } from "react";
import { useLayoutEffect, useState } from "react";

import { flushSync } from "react-dom";
import { describe, expect, it, vi } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { drawnRect } from "../../../test/chart/bar-box";
import {
  activateFirst,
  activeOverlay,
  at,
  drawnPlot,
  expectApart,
  expectFloored,
  PATH_SLOTS,
  PROBE,
  run,
  seriesColumns,
  sides,
  stackChart,
  stacked,
  sweep,
  times,
  turnsIn,
  tweenFrames,
  week,
} from "../../../test/chart/floor-charts";
import type { Transition } from "../../../test/chart/floor-charts";
import { installFrameClock } from "../../../test/chart/frame-clock";
import { barLayerBox, bars } from "../../../test/chart/marks";
import { SERIAL } from "../../../test/chart/world-model";
import { emulatePixelRatio } from "../../../test/page-metrics";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

const STACK = {
  inner: { label: "Inner", color: "chart-1", stack: "s" },
  outer: { label: "Outer", color: "chart-2", stack: "s" },
} as const satisfies ChartConfig;

describe("a small non-zero bar", () => {
  it("keeps a small negative bar inside the plot when the zero rule lies on the plot's top edge", async () => {
    // Every reading is negative, so the zero rule lies on the plot's top edge, and -4 on -1200..0
    // is 0.85 CSS px. Its pixel grows down, into the plot.
    const data = [-1000, -4, -700].map((carts, index) => ({ day: `d${String(index + 1)}`, carts }));
    await sweep(renderThemed, 10, "vertical", week(data, [-1200]), (host, plot, dpr, offset) => {
      expect(plot.zero, at(dpr, offset)).toBeLessThan(SERIAL);
      const rect = bars(host).map((bar) => drawnRect(bar))[1] ?? drawnRect(null);
      expectFloored(rect, plot, { vertical: true, sign: -1, dpr, what: at(dpr, offset) });
    });
  });
});

describe("a small segment of a stack", () => {
  function stack(rows: readonly { inner: number; outer: number }[]) {
    return (
      <Chart.Root
        data-intro="none"
        data={rows.map((row, index) => ({ day: `d${String(index + 1)}`, ...row }))}
        config={STACK}
        xKey="day"
        yInclude={[1200]}
        // No seam, so the segments must abut.
        style={{ "--chart-plot-height": "16rem", "--chart-bar-seam": "0px" }}
        aria-label="Stack">
        <Chart.Grid />
        <Chart.Bar dataKey="inner" />
        <Chart.Bar dataKey="outer" />
      </Chart.Root>
    );
  }

  // A small outer segment on a tall inner one, a small inner one under a tall outer one, and a
  // stack whose segments are both small: 1 and 1 on 0..1200 are 0.21 CSS px each.
  const ROWS = [
    { inner: 800, outer: 4 },
    { inner: 4, outer: 800 },
    { inner: 1, outer: 1 },
  ];

  it("keeps its segments abutting, with no overlap, and its total one device pixel or more", async () => {
    await sweep(renderThemed, 10, "vertical", stack(ROWS), (host, plot, dpr, offset) => {
      const inner = bars(host, 0).map((bar) => drawnRect(bar));
      const outer = bars(host, 1).map((bar) => drawnRect(bar));
      ROWS.forEach((_, index) => {
        const what = `row ${String(index)} ${at(dpr, offset)}`;
        const low = inner[index] ?? drawnRect(null);
        const high = outer[index] ?? drawnRect(null);
        // The inner segment stands on the zero rule, and the outer one starts where it ends.
        expect(Math.abs(low.y + low.height - plot.zero), `${what}: inner base`).toBeLessThan(SERIAL);
        expect(Math.abs(high.y + high.height - low.y), `${what}: segments abut`).toBeLessThan(SERIAL);
        const total = low.height + high.height;
        expect(total, `${what}: total`).toBeGreaterThanOrEqual(1 / dpr - SERIAL);
      });
      // The small outer segment keeps its own pixel.
      expect(outer[0]?.height, `small outer ${at(dpr, offset)}`).toBeGreaterThanOrEqual(1 / dpr - SERIAL);
    });
  });
});

describe("a stack of segments under a device pixel through a data update", () => {
  // Three segments of 1 on -1,000..1,000 over 200 px, 0.1 CSS px each, the second turning over and
  // the third leaving to 0. Two of 1 on 0..1,200 over 256 px, 0.21 CSS px each, the outer one
  // leaving to 0, or arriving from 0.
  const TURN = {
    from: [1, 1, 1],
    to: [1, -1, 0],
    include: [-1000, 1000],
    height: 200,
    zero: 100,
    perUnit: 0.1,
  };
  const TWO = { include: [1200], height: 256, zero: 256, perUnit: 256 / 1200 };

  for (const form of ["bars", "path"] as const) {
    it(`floors one segment of the positive side, on the zero rule, while a segment turns over (${form}, Q2-2)`, async () => {
      // At 1x a 0.25 offset puts the chart's top, and so the plot's and zero's, a quarter of a
      // device pixel in, where the positive side's 0.3 px reach holds no place where rounding turns:
      // every segment snaps to nothing on its own, so the side draws its one owner's pixel alone.
      const transition: Transition = { ...TURN, what: "turn over", form, seam: "none", dpr: 1, offset: 0.25 };
      await run(transition, 20, ({ host, drawn, rule, log }) => {
        const page = barLayerBox(host).top + transition.zero;
        expect(turnsIn(1, page, page - 0.3), `${log}: a clean reach`).toBe(false);
        const { positive } = sides(drawn, rule);
        expect(positive, `${log}: one floor`).toHaveLength(1);
        const [only] = positive;
        expect(only?.rect.height, `${log}: one device pixel`).toBeCloseTo(1, 6);
        expect((only?.rect.y ?? 0) + (only?.rect.height ?? 0), `${log}: on the zero rule`).toBeCloseTo(
          rule,
          6
        );
        return true;
      });
    });

    // Each segment's base and tip move in a straight line between their rests on the probe's
    // progress, so a segment covers a device pixel on its own exactly where its path holds a place
    // where rounding turns. One that draws without one is floored: one a side at most, and its
    // pixel covers no other segment's. A frame where a turn lies too near a path's end to tell is
    // left unjudged. The leaving segment's path at 1x 0.8 px in, and the turning one's at 1.5x 0.35
    // px in, where it floors below zero beside the first segment's own pixel, cross such places.
    const CROSSINGS: readonly Transition[] = [
      { ...TWO, what: "leave", from: [1, 1], to: [1, 0], form, seam: "none", dpr: 1, offset: 0.8 },
      { ...TURN, what: "turn over", form, seam: "none", dpr: 1.5, offset: 0.35 },
    ];
    for (const transition of CROSSINGS) {
      it(`lays no floor on another segment's own pixel: ${transition.what} at ${String(transition.dpr)}x (${form}, B2-1)`, async () => {
        const { dpr } = transition;
        const ends = { from: stacked(transition.from), to: stacked(transition.to) };
        await run(transition, 10, ({ host, drawn, rule, progress, log }) => {
          const top = barLayerBox(host).top;
          const page = (value: number) => top + transition.zero - value * transition.perUnit;
          // How far the progress may stray, as a page distance along any path here.
          const doubt = (0.5 / dpr / (PROBE * transition.perUnit)) * 3 * transition.perUnit + 1e-4;
          const floored: number[] = [];
          for (const [series, rect] of drawn.entries()) {
            if (rect.height <= SERIAL) continue;
            const [baseFrom = 0, tipFrom = 0] = ends.from[series] ?? [];
            const [baseTo = 0, tipTo = 0] = ends.to[series] ?? [];
            const base = page(baseFrom + (baseTo - baseFrom) * progress);
            const tip = page(tipFrom + (tipTo - tipFrom) * progress);
            const [low, high] = [Math.min(base, tip), Math.max(base, tip)];
            if (turnsIn(dpr, low - doubt, low + doubt) || turnsIn(dpr, high - doubt, high + doubt))
              return false;
            if (!turnsIn(dpr, low, high)) floored.push(series);
          }
          const both = sides(drawn, rule);
          for (const side of [both.positive, both.negative]) {
            expect(
              side.filter(({ series }) => floored.includes(series)).length,
              `${log}: one floor a side`
            ).toBeLessThanOrEqual(1);
          }
          for (const series of floored) {
            const own = drawn[series];
            const others = drawn.filter((other, index) => index !== series && other.height > SERIAL);
            if (own !== undefined) expectApart([own], others, `${log}: floor of s${String(series)}`);
          }
          return true;
        });
      });
    }

    it(`shows the stack in every frame while a segment arrives under the default seam (${form}, B2-2)`, async () => {
      // The default 2 px seam would take the whole of a 0.21 px inner segment, and an arriving outer
      // one starts with no length, so the stack shows only through its floor's owner.
      const transition: Transition = {
        ...TWO,
        what: "arrive",
        from: [1, 0],
        to: [1, 1],
        form,
        seam: "default",
        dpr: 1,
        offset: 0,
      };
      await run(transition, 20, ({ drawn, rule, log }) => {
        const { positive } = sides(drawn, rule);
        const length = positive.reduce((sum, { rect }) => sum + rect.height, 0);
        expect(length, `${log}: the stack shows`).toBeGreaterThanOrEqual(1 - SERIAL);
        return true;
      });
    });
  }
});

describe("the stack floors' stacks and their readers", () => {
  it("floors the tiny column of each of two stacks side by side in a BarGroup", async () => {
    // 120 categories, so the bars draw as paths. Stack "a" reads 0.001 at c0 and stack "b" 0.001
    // at c1, each over a series of zeros, side by side in a BarGroup, with 1,000 elsewhere: both
    // are far under a device pixel on 0..1,200 over 256 px, and each keeps its own pixel.
    const config = {
      p: { label: "P", color: "chart-1", stack: "a" },
      pz: { label: "P0", color: "chart-1", stack: "a" },
      q: { label: "Q", color: "chart-2", stack: "b" },
      qz: { label: "Q0", color: "chart-2", stack: "b" },
    } as const satisfies ChartConfig;
    const data = Array.from({ length: PATH_SLOTS }, (_, slot) => ({
      day: `c${String(slot)}`,
      p: slot === 0 ? 0.001 : slot === 50 ? 1000 : 0,
      pz: 0,
      q: slot === 1 ? 0.001 : slot === 60 ? 1000 : 0,
      qz: 0,
    }));
    const { host } = renderThemed(
      stackChart({
        config,
        data,
        include: [1200],
        height: 256,
        width: 600,
        children: (
          <>
            <Chart.Grid />
            <Chart.BarGroup series={["p", "pz", "q", "qz"]}>
              <Chart.Bar dataKey="p" />
              <Chart.Bar dataKey="pz" />
              <Chart.Bar dataKey="q" />
              <Chart.Bar dataKey="qz" />
            </Chart.BarGroup>
          </>
        ),
      })
    );
    await nextFrames();
    const plot = drawnPlot(host, true, devicePixelRatio);
    // DOM audit: the path form's paths are aria-hidden plot output, one layer per series.
    const column = (series: number) => seriesColumns(host, series)[0] ?? drawnRect(null);
    for (const [series, what] of [
      [0, "a at c0"],
      [2, "b at c1"],
    ] as const) {
      const rect = column(series);
      expectFloored(rect, plot, { vertical: true, sign: 1, dpr: devicePixelRatio, what });
    }
  });

  it("redraws a resting active overlay when its bar takes or leaves the floor", async () => {
    // Three stacked segments on -1,000..1,000 over 200 px, 0.1 CSS px a unit. [1, 1, -10] becomes
    // [1, -10, 1]: the first segment rests at [0, 1] throughout, and owns the positive floor only
    // once the second turns over and the third rises past it. Its overlay draws its geometry,
    // floor and all, in every frame.
    const config = {
      s0: { label: "S0", color: "chart-1", stack: "s" },
      s1: { label: "S1", color: "chart-2", stack: "s" },
      s2: { label: "S2", color: "chart-3", stack: "s" },
    } as const satisfies ChartConfig;
    const chart = ([s0, s1, s2]: readonly [number, number, number]) =>
      stackChart({
        config,
        data: [{ day: "d1", s0, s1, s2 }],
        include: [-1000, 1000],
        height: 200,
        width: 400,
      });
    let owned = 0;
    // DOM audit: the plot's single tab stop is the listbox's option.
    await tweenFrames(
      renderThemed,
      chart([1, 1, -10]),
      chart([1, -10, 1]),
      { times: times(0, 600, 20), ready: activateFirst },
      (host, time) => {
        const bar = drawnRect(bars(host, 0)[0]);
        const overlay = activeOverlay(host, 0);
        const what = `${String(time)} ms: bar ${String(bar.y)}+${String(bar.height)}, overlay ${String(overlay.y)}+${String(overlay.height)}`;
        expect(overlay.y, what).toBeCloseTo(bar.y, 6);
        expect(overlay.height, what).toBeCloseTo(bar.height, 6);
        if (bar.height > SERIAL) owned += 1;
      }
    );
    // The first segment takes the floor in some frame, so the check saw a change.
    expect(owned).toBeGreaterThan(0);
  });

  for (const form of ["bars", "path"] as const) {
    it(`keeps a segment's floor with its category while the window slides (${form})`, async () => {
      // c0 to c{n-1} becomes c1 to c{n}: c0 leaves and c1 slides into the first slot. Only c0's a
      // and c1's b read 1, 0.21 CSS px on 0..1,200 over 256 px, so b draws exactly c1's pixel, and
      // in every frame of the slide c1's b stays the only segment of its stack slot with length.
      const count = form === "bars" ? 20 : 120;
      const config = {
        a: { label: "A", color: "chart-1", stack: "s" },
        b: { label: "B", color: "chart-2", stack: "s" },
      } as const satisfies ChartConfig;
      const chart = (shift: number) =>
        stackChart({
          config,
          data: Array.from({ length: count }, (_, index) => {
            const slot = index + shift;
            return { day: `c${String(slot)}`, a: slot === 0 ? 1 : 0, b: slot === 1 ? 1 : 0 };
          }),
          include: [1200],
          height: 256,
          width: 1200,
        });
      /** How long b draws along the value axis, over every slot. */
      const drawnB = (host: HTMLElement) =>
        form === "bars"
          ? bars(host, 1).reduce((sum, bar) => sum + drawnRect(bar).height, 0)
          : seriesColumns(host, 1).reduce((sum, { height }) => sum + height, 0);
      await tweenFrames(
        renderThemed,
        chart(0),
        chart(1),
        {
          times: times(0, 600, 20),
          ready: (host) => {
            expect(drawnB(host), "at rest").toBeCloseTo(1, 6);
          },
        },
        (host, time) => {
          expect(drawnB(host), `${String(time)} ms`).toBeCloseTo(1, 6);
        }
      );
    });
  }

  it("settles each Panel's stacks in that Panel's own plot", async () => {
    // An upper Panel of 200 px over -1,000..1,000 turns [-10, -10] into [10, 1] above a lower Panel
    // of 50 px whose two series move too. Whether the lower series stack or not, the upper Panel
    // must draw the same pixels in every frame: a stack's floor lives in its own Panel's plot.
    const upper = {
      u0: { label: "U0", color: "chart-1", stack: "up" },
      u1: { label: "U1", color: "chart-2", stack: "up" },
    } as const satisfies ChartConfig;
    const chart = (stacked: boolean, values: readonly [number, number], lower: number) => (
      <LocaleProvider locale="en-US">
        <div style={{ width: 400, paddingTop: 12.8 }}>
          <Chart.Root
            data-intro="none"
            data={[{ day: "d1", u0: values[0], u1: values[1], l0: lower, l1: lower }]}
            config={{
              ...upper,
              l0: stacked
                ? { label: "L0", color: "chart-3", stack: "low" }
                : { label: "L0", color: "chart-3" },
              l1: stacked
                ? { label: "L1", color: "chart-4", stack: "low" }
                : { label: "L1", color: "chart-4" },
            }}
            xKey="day"
            style={{ "--chart-bar-seam": "0px" }}
            aria-label="Panels">
            <Chart.Panel
              series={["u0", "u1"]}
              yInclude={[-1000, 1000]}
              style={{ "--chart-plot-height": "200px" }}>
              <Chart.Bar dataKey="u0" />
              <Chart.Bar dataKey="u1" />
            </Chart.Panel>
            <Chart.Panel
              series={["l0", "l1"]}
              yInclude={[-100, 100]}
              style={{ "--chart-plot-height": "50px" }}>
              <Chart.Bar dataKey="l0" />
              <Chart.Bar dataKey="l1" />
            </Chart.Panel>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const frames = async (stacked: boolean): Promise<string[]> => {
      const drawn: string[] = [];
      await tweenFrames(
        renderThemed,
        chart(stacked, [-10, -10], 10),
        chart(stacked, [10, 1], 20),
        { times: times(0, 600, 20) },
        (host, time) => {
          // DOM audit: the upper Panel draws the first two bars, one layer per series.
          const panel = host.querySelector<HTMLElement>('[data-slot="chart-panel"]') ?? host;
          drawn.push(
            `${String(time)} ms ${JSON.stringify(
              [0, 1].map((series) => {
                const { y, height } = drawnRect(bars(panel, series)[0]);
                return [y, height];
              })
            )}`
          );
        }
      );
      return drawn;
    };
    expect(await frames(true)).toEqual(await frames(false));
  });

  for (const [orientation, dpr] of [
    ["vertical", 1],
    ["horizontal", 1],
    ["vertical", 1.5],
  ] as const) {
    it(`gives an hourly segment its floor over its whole hour, never under the quarters above it (${orientation}, ${String(dpr)}x, B7-2)`, async () => {
      // Four quarter hours from midnight UTC stack an hourly a, 1 on the hour, and quarterly b,
      // 0 then 1, 1 and 1, on 0..1,200 over 256 px: 0.21 CSS px a unit, so every pixel drawn here
      // is a floor, and a's hour runs under b's last three quarters. No pixel holds both.
      const config = {
        a: { label: "A", color: "chart-1", stack: "s", interval: "hour" },
        b: { label: "B", color: "chart-2", stack: "s" },
      } as const satisfies ChartConfig;
      const quarter = (index: number) => new Date(Date.UTC(2025, 9, 1, 0, index * 15));
      const data = [0, 1, 1, 1].map((b, index) => ({
        start: quarter(index),
        // The hour's reading sits on its first quarter's row.
        a: index === 0 ? 1 : null,
        b,
      }));
      await emulatePixelRatio(dpr);
      const { host } = renderThemed(
        <LocaleProvider locale="en-US">
          <div style={{ width: 400 }}>
            <Chart.Root
              data-intro="none"
              data={data}
              config={config}
              xKey="start"
              interval="quarter-hour"
              timeZone="UTC"
              orientation={orientation}
              yInclude={[1200]}
              style={{ "--chart-plot-height": "256px", "--chart-bar-seam": "0px" }}
              aria-label="Hour">
              <Chart.Bar dataKey="a" />
              <Chart.Bar dataKey="b" />
            </Chart.Root>
          </div>
        </LocaleProvider>
      );
      await nextFrames();
      const hour = bars(host, 0).map((bar) => drawnRect(bar));
      const quarters = bars(host, 1).map((bar) => drawnRect(bar));
      // The stack shows: one series or the other draws a pixel.
      expect([...hour, ...quarters].some(({ width, height }) => width > SERIAL && height > SERIAL)).toBe(
        true
      );
      expectApart(hour, quarters, "a and b");
    });
  }
});

describe("a stack whose marks leave", () => {
  // One category stacks inner and outer on 0..1,200 over 256 px, 0.21 CSS px a unit, so neither
  // segment reaches a device pixel and the outer one, which reaches farther, holds the floor.
  const ROW = { inner: 1, outer: 2 };
  const MOVED = { inner: 2, outer: 3 };

  function chart(row: { readonly inner: number; readonly outer: number }, outer: ReactNode) {
    return stackChart({
      config: STACK,
      data: [{ day: "d1", ...row }],
      include: [1200],
      height: 256,
      width: 400,
      children: (
        <>
          <Chart.Grid />
          {outer}
          <Chart.Bar dataKey="inner" />
        </>
      ),
    });
  }

  it("hands the floor to the segment that stays before the next frame when a segment leaves mid-tween", async () => {
    // The outer Bar leaves through its own state, so Root does not render, and no commit batch
    // settles the stack: the removal alone must.
    let showOuter: (shown: boolean) => void = () => undefined;
    function Outer() {
      const [shown, setShown] = useState(true);
      useLayoutEffect(() => {
        showOuter = setShown;
      }, []);
      return shown ? <Chart.Bar dataKey="outer" /> : null;
    }
    await emulatePixelRatio(1);
    const clock = installFrameClock();
    const { host, rerender, unmount } = renderThemed(chart(ROW, <Outer />));
    try {
      const start = clock.now();
      rerender(chart(MOVED, <Outer />));
      clock.frameAt(start + 100);
      // Mid-tween the outer segment holds the floor, so the inner one draws no pixel of its own.
      expect(drawnRect(bars(host, 0)[0]).height, "inner before").toBeLessThan(1 - SERIAL);
      expect(drawnRect(bars(host, 1)[0]).height, "outer before").toBeGreaterThanOrEqual(1 - SERIAL);
      flushSync(() => {
        showOuter(false);
      });
      await Promise.resolve();
      // No frame ran since the removal, so the floor came with it.
      expect(bars(host, 1)).toHaveLength(0);
      const plot = drawnPlot(host, true, 1);
      expectFloored(drawnRect(bars(host, 0)[0]), plot, {
        vertical: true,
        sign: 1,
        dpr: 1,
        what: "inner after",
      });
      for (let time = 120; time <= 600; time += 40) {
        clock.frameAt(start + time);
        const what = `inner at ${String(time)} ms`;
        expectFloored(drawnRect(bars(host, 0)[0]), plot, { vertical: true, sign: 1, dpr: 1, what });
      }
    } finally {
      unmount();
      clock.restore();
    }
  });

  it("paints nothing into its marks and leaves no frame queued once Root unmounts mid-tween", async () => {
    // The outer Bar unmounts first, so a removal that settled at once would hand the floor to the
    // inner Bar and paint it on its way out.
    await emulatePixelRatio(1);
    const clock = installFrameClock();
    const errors = vi.spyOn(console, "error");
    const thrown: unknown[] = [];
    const onError = (event: ErrorEvent) => {
      thrown.push(event.error);
    };
    window.addEventListener("error", onError);
    try {
      const { host, rerender, unmount } = renderThemed(chart(ROW, <Chart.Bar dataKey="outer" />));
      const start = clock.now();
      rerender(chart(MOVED, <Chart.Bar dataKey="outer" />));
      clock.frameAt(start + 100);
      const inner = bars(host, 0)[0];
      const before = drawnRect(inner);
      expect(before.height, "inner before").toBeLessThan(1 - SERIAL);
      unmount();
      await Promise.resolve();
      await Promise.resolve();
      expect(drawnRect(inner), "inner after").toEqual(before);
      expect(clock.pending(), "a frame queued").toBe(false);
      expect(errors).not.toHaveBeenCalled();
      expect(thrown).toEqual([]);
    } finally {
      window.removeEventListener("error", onError);
      errors.mockRestore();
      clock.restore();
    }
  });
});

describe("a stack whose marks draw in a commit Root does not render", () => {
  // Every slot stacks inner 1 and outer 1 on 0..1,200 over 256 px, 0.21 CSS px each, so only the
  // outer segment keeps a pixel. React renders each mark's resting geometry, which the stack floors
  // decide alike, so no mark writes its geometry again however many draw in the commit. A stack
  // that settled once a mark would floor each inner segment while it draws alone, then take the
  // floor back.
  for (const form of ["bars", "path"] as const) {
    it(`writes no mark again when the chart mounts or late Bars mount (${form})`, async () => {
      const count = form === "bars" ? 12 : PATH_SLOTS;
      let show: (shown: boolean) => void = () => undefined;
      function Late() {
        const [shown, setShown] = useState(true);
        useLayoutEffect(() => {
          show = setShown;
        }, []);
        return shown ? (
          <>
            <Chart.Bar dataKey="inner" />
            <Chart.Bar dataKey="outer" />
          </>
        ) : null;
      }
      const data = Array.from({ length: count }, (_, slot) => ({
        day: `c${String(slot)}`,
        inner: 1,
        outer: 1,
      }));
      const records: MutationRecord[] = [];
      const observer = new MutationObserver((found) => {
        records.push(...found);
      });
      observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["points", "d"] });
      /** The marks whose geometry changed since the last call, by slot and series. */
      const rewritten = () => {
        records.push(...observer.takeRecords());
        const marks = records.flatMap(({ target }) =>
          target instanceof Element && target.matches('[data-slot="chart-bar"], [data-slot="chart-bar-path"]')
            ? [target.getAttribute("data-series")]
            : []
        );
        records.length = 0;
        return marks;
      };
      await emulatePixelRatio(1);
      const { host, unmount } = renderThemed(
        stackChart({
          config: STACK,
          data,
          include: [1200],
          height: 256,
          width: 600,
          children: (
            <>
              <Chart.Grid />
              <Late />
            </>
          ),
        })
      );
      try {
        await nextFrames();
        expect(rewritten(), "the chart mounts").toEqual([]);
        flushSync(() => {
          show(false);
        });
        flushSync(() => {
          show(true);
        });
        await nextFrames();
        expect(rewritten(), "late Bars mount").toEqual([]);
        // The outer segment keeps the stack's pixel, so the check looked at a floored stack.
        const outer =
          form === "bars" ? drawnRect(bars(host, 1)[0]) : (seriesColumns(host, 1)[0] ?? drawnRect(null));
        expectFloored(outer, drawnPlot(host, true, 1), { vertical: true, sign: 1, dpr: 1, what: "outer" });
      } finally {
        observer.disconnect();
        unmount();
      }
    });
  }
});
