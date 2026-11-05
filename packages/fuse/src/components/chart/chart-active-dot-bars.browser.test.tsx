// The active dot's ride across a Bar series with motion on, in Chromium. Oracles: the drawn bars'
// own boxes, whose far-end centres the straight track joins, the path form's own fill, which the
// browser hit-tests, and the crosshair's drawn line.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { READINGS, shown } from "../../../test/chart/active-dot";
import { offPolyline } from "../../../test/chart/polyline";
import {
  dispatchSlotMove,
  dotFrame,
  everyFrame,
  onTheWay,
  sweepGlides,
} from "../../../test/chart/tooltip-glide";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

/** Bars over seven slots, with a line crosshair and an ActiveDot on the outer series. */
function BarRideChart({
  rows,
  stacked = false,
  domain = [0, 100],
}: {
  readonly rows: readonly { readonly name: string; readonly a: number | null; readonly b?: number }[];
  readonly stacked?: boolean;
  readonly domain?: readonly [number, number];
}) {
  const config: ChartConfig = stacked
    ? {
        a: { label: "A", color: "chart-1", stack: "s" },
        b: { label: "B", color: "chart-2", stack: "s" },
      }
    : { a: { label: "A", color: "chart-1" } };
  return (
    <div style={{ padding: "120px 24px 24px", width: 648, boxSizing: "border-box" }}>
      <LocaleProvider locale="en-US">
        <Chart.Root
          data={rows}
          config={config}
          xKey="name"
          yInclude={domain}
          data-intro="none"
          aria-label="Bar ride">
          <Chart.Crosshair variant="line" />
          <Chart.Bar dataKey="a" />
          {stacked ? <Chart.Bar dataKey="b" /> : null}
          <Chart.ActiveDot dataKey={stacked ? "b" : "a"} />
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

/** A pointer move over the centre of one of `count` band slots, halfway down, by `nudge` px to its right. */
function moveToBand(host: HTMLElement, slot: number, nudge = 0, count = READINGS.length): void {
  dispatchSlotMove(host, (slot + 0.5) / count, nudge, { depth: 0.5 });
}

/**
 * The far-end centre of each drawn bar of one series, in slot order: its top, or its bottom where
 * the bar hangs below zero.
 */
function barEnds(host: HTMLElement, series: number, hanging: readonly boolean[]): { x: number; y: number }[] {
  // DOM audit: bars are aria-hidden plot output, so their slots are the only locators.
  const drawn = [
    ...host.querySelectorAll(
      `[data-slot="chart-bar-series"][data-series="${String(series)}"] [data-slot="chart-bar"]`
    ),
  ];
  return drawn.map((bar, index) => {
    const box = bar.getBoundingClientRect();
    return { x: (box.left + box.right) / 2, y: hanging[index] === true ? box.bottom : box.top };
  });
}

const named = (values: readonly (number | null)[]) =>
  values.map((a, index) => ({ name: `k${String(index)}`, a }));

describe("an active dot on bars, on a fast step across several slots", () => {
  it.each([
    ["plain bars", named(READINGS), false, [0, 100], READINGS.map(() => false)],
    [
      "a stack's outer segment",
      READINGS.map((value, index) => ({ name: `k${String(index)}`, a: 10 + index * 3, b: value / 2 })),
      true,
      [0, 100],
      READINGS.map(() => false),
    ],
    [
      "bars below zero",
      named([-40, 30, -70, 50, -20, 60, -10]),
      false,
      [-100, 100],
      [true, false, true, false, true, false, true],
    ],
  ] as const)(
    "rides the straight track through the %s' far ends, on the crosshair, along its whole glide",
    async (_name, rows, stacked, domain, hanging) => {
      const { host } = renderThemed(<BarRideChart rows={rows} stacked={stacked} domain={domain} />);
      await nextFrames(2);
      moveToBand(host, 1);
      await nextFrames(40);
      const ends = barEnds(host, stacked ? 1 : 0, hanging);
      expect(ends).toHaveLength(READINGS.length);
      // A quick nudge, then the step from k1 to k5, so the pointer reads as fast.
      moveToBand(host, 1, 2);
      await nextFrames(1);
      moveToBand(host, 5);
      const frames = sweepGlides(host, () => shown(host));
      expect(onTheWay(frames).length, JSON.stringify(frames)).toBeGreaterThan(3);
      for (const frame of frames) {
        expect(offPolyline(frame, ends), JSON.stringify(frame)).toBeLessThanOrEqual(1);
        expect(Math.abs(frame.x - frame.crosshair), JSON.stringify(frame)).toBeLessThanOrEqual(1);
      }
      const rest = frames.at(-1);
      const end = ends[5];
      if (rest === undefined || end === undefined) throw new Error("no frames");
      expect(Math.hypot(rest.x - end.x, rest.y - end.y)).toBeLessThanOrEqual(1);
    }
  );

  it("moves at once across a missing reading", async () => {
    const { host } = renderThemed(<BarRideChart rows={named([70, null, 85, 10, 60, 30, 90])} />);
    await nextFrames(2);
    moveToBand(host, 0);
    await nextFrames(40);
    const start = shown(host);
    const { frames, stop } = everyFrame(() => shown(host));
    moveToBand(host, 2);
    await nextFrames(40);
    stop();
    const end = shown(host);
    expect(end.x - start.x).toBeGreaterThan(100);
    const at = (frame: { x: number; y: number }, place: { x: number; y: number }) =>
      Math.hypot(frame.x - place.x, frame.y - place.y) <= 0.5;
    expect(
      frames.every((frame) => !frame.gliding && (at(frame, start) || at(frame, end))),
      JSON.stringify(frames)
    ).toBe(true);
  });
});

// Kept at module scope, so a rerender keeps the Root's model, and the frame, from one render to the
// next.
const GROUP_ROWS = [
  { name: "k0", a: 10, b: 10 },
  { name: "k1", a: 10, b: 90 },
  { name: "k2", a: 10, b: 10 },
  { name: "k3", a: 10, b: 10 },
  { name: "k4", a: 10, b: 10 },
];
const GROUP_CONFIG: ChartConfig = {
  a: { label: "A", color: "chart-1" },
  b: { label: "B", color: "chart-2" },
};
const GROUP_DOMAIN = [0, 100] as const;
const STACKED_CONFIG: ChartConfig = {
  a: { label: "A", color: "chart-1", stack: "s" },
  b: { label: "B", color: "chart-2", stack: "s" },
};

/** What a GroupChart draws: the dot's series, the bars' order, and whether b stacks on a. */
type Group = {
  readonly dot: "a" | "b";
  readonly order: readonly ["a", "b"] | readonly ["b", "a"];
  /** Stacks b on a in one column instead of grouping them side by side. */
  readonly stacked?: boolean;
};

/** Two series side by side in a BarGroup, in `order`, with an ActiveDot on `dot`. */
function GroupChart({ dot, order, stacked = false }: Group) {
  const config = stacked ? STACKED_CONFIG : GROUP_CONFIG;
  return (
    <div style={{ padding: "120px 24px 24px", width: 648, boxSizing: "border-box" }}>
      <LocaleProvider locale="en-US">
        <Chart.Root
          data={GROUP_ROWS}
          config={config}
          xKey="name"
          yInclude={GROUP_DOMAIN}
          data-intro="none"
          aria-label="Group ride">
          {stacked ? (
            order.map((key) => <Chart.Bar key={key} dataKey={key} />)
          ) : (
            <Chart.BarGroup series={[...order]}>
              {order.map((key) => (
                <Chart.Bar key={key} dataKey={key} />
              ))}
            </Chart.BarGroup>
          )}
          <Chart.ActiveDot dataKey={dot} />
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

/** A fast pointer step from one of five band slots to another, read every millisecond until it rests. */
async function fastStep(host: HTMLElement, from: number, to: number) {
  moveToBand(host, from, 0, 5);
  await nextFrames(40);
  moveToBand(host, from, 2, 5);
  await nextFrames(1);
  moveToBand(host, to, 0, 5);
  return sweepGlides(host, () => dotFrame(host)).flat();
}

describe("an active dot on bars after its bars change", () => {
  it.each<{ readonly name: string; readonly before: Group; readonly after: Group }>([
    // b stacks on a in the same columns, so a's flat track and b's peaked one share their places
    // along x, and a track kept from a would carry the dot flat under b's peak at k1.
    {
      name: "the new series' bars after its dataKey changes",
      before: { dot: "a", order: ["a", "b"], stacked: true },
      after: { dot: "b", order: ["a", "b"], stacked: true },
    },
    {
      name: "its bars' new places after the BarGroup's order changes",
      before: { dot: "b", order: ["a", "b"] },
      after: { dot: "b", order: ["b", "a"] },
    },
  ])("rides $name", async ({ before, after }) => {
    const { host, rerender } = renderThemed(<GroupChart {...before} />);
    await nextFrames(2);
    await fastStep(host, 0, 2);
    rerender(<GroupChart {...after} />);
    await nextFrames(2);
    const frames = await fastStep(host, 0, 4);
    const ends = barEnds(host, 1, [false, false, false, false, false]);
    expect(onTheWay(frames).length, JSON.stringify(frames)).toBeGreaterThan(3);
    for (const frame of frames) {
      expect(offPolyline(frame, ends), JSON.stringify(frame)).toBeLessThanOrEqual(1);
      expect(frame.x, JSON.stringify(frame)).toBeLessThanOrEqual((ends[4]?.x ?? 0) + 0.5);
    }
  });
});

// 150 slots, more than the 100 a chart draws bar by bar, so the bars draw as one path per series,
// narrowed to the first ten. b stands beside a in each band.
const PATH_ROWS = Array.from({ length: 150 }, (_, index) => ({
  name: `k${String(index)}`,
  a: 40 + (index % 3) * 10,
  b: 20 + (index % 5) * 15,
}));
const PATH_RANGE = ["k0", "k9"] as const;

describe("an active dot on a BarGroup drawn as paths", () => {
  it("rides its own series' column tops, beside the other series'", async () => {
    const { host } = renderThemed(
      <div style={{ padding: "120px 24px 24px", width: 648, boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={PATH_ROWS}
            config={GROUP_CONFIG}
            xKey="name"
            yInclude={GROUP_DOMAIN}
            defaultXRange={PATH_RANGE}
            data-intro="none"
            aria-label="Path group">
            <Chart.Crosshair variant="line" />
            <Chart.BarGroup series={["a", "b"]}>
              <Chart.Bar dataKey="a" />
              <Chart.Bar dataKey="b" />
            </Chart.BarGroup>
            <Chart.ActiveDot dataKey="b" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    await nextFrames(2);
    const move = (slot: number, nudge = 0) => {
      moveToBand(host, slot, nudge, 10);
    };
    // Where the dot rests on k0 to k7, each read once it has settled. The step below ends on k6,
    // and the spring's overshoot carries the dot a little way toward k7.
    const rests: { x: number; y: number }[] = [];
    for (let slot = 0; slot <= 7; slot += 1) {
      move(slot);
      await nextFrames(40);
      const { x, y } = shown(host);
      rests.push({ x, y });
    }
    // DOM audit: the path form draws each series' columns in one aria-hidden fill path.
    const fill = host.querySelector<SVGPathElement>(
      '[data-slot="chart-bar-series"][data-series="1"] [data-slot="chart-bar-path"][data-part="fill"]'
    );
    const matrix = fill?.getScreenCTM()?.inverse();
    if (fill === null || matrix === undefined) throw new Error("no columns");
    const inFill = (x: number, y: number) => fill.isPointInFill(new DOMPoint(x, y).matrixTransform(matrix));
    // Each rest is b's own column top: inside b's columns just below it, outside just above.
    for (const rest of rests) {
      expect(inFill(rest.x, rest.y + 2), JSON.stringify(rest)).toBe(true);
      expect(inFill(rest.x, rest.y - 2), JSON.stringify(rest)).toBe(false);
    }
    move(0);
    await nextFrames(40);
    move(0, 2);
    await nextFrames(1);
    move(6);
    const frames = sweepGlides(host, () => shown(host));
    expect(onTheWay(frames).length, JSON.stringify(frames)).toBeGreaterThan(3);
    for (const frame of frames)
      expect(offPolyline(frame, rests), JSON.stringify(frame)).toBeLessThanOrEqual(1);
  });
});
