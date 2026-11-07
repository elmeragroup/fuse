// The active dot's ride along its line with motion on, in Chromium. Oracles: the drawn line's own
// geometry, which the path's getPointAtLength gives through its screen matrix, or its own path data
// for the dense natural line; the crosshair's drawn line; and, for the glide's pace, the settling
// time of the closed-form damped oscillator in test/chart/oscillator.ts.
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, wait } from "../../../test/animation-frames";
import { ONE_SERIES, PERCENT, READINGS, dotLayer, moveTo, shown } from "../../../test/chart/active-dot";
import type { DotAndCrosshair } from "../../../test/chart/active-dot";
import { settling } from "../../../test/chart/oscillator";
import { everyFrame, onTheWay, sweepGlides } from "../../../test/chart/tooltip-glide";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartCurve } from "./chart-types";
import "./chart.css";

function RideChart({
  curve,
  readings = READINGS,
  plotHeight,
}: {
  readonly curve: ChartCurve;
  readonly readings?: readonly number[];
  /** Root's `--chart-plot-height`. */
  readonly plotHeight?: string;
}) {
  return (
    <div style={{ padding: "120px 24px 24px", width: 648, boxSizing: "border-box" }}>
      <button type="button">Before</button>
      <LocaleProvider locale="en-US">
        <Chart.Root
          data={readings.map((v, index) => ({ name: `k${String(index)}`, v }))}
          config={ONE_SERIES}
          xKey="name"
          xScale="point"
          yInclude={PERCENT}
          data-intro="none"
          style={plotHeight === undefined ? undefined : { "--chart-plot-height": plotHeight }}
          aria-label="Ride">
          <Chart.Crosshair />
          <Chart.Line dataKey="v" curve={curve} />
          <Chart.ActiveDot dataKey="v" />
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

/** One series that a stepped Area draws first and a linear Line draws after it. */
function AreaAndLine() {
  return (
    <div style={{ padding: "120px 24px 24px", width: 648, boxSizing: "border-box" }}>
      <LocaleProvider locale="en-US">
        <Chart.Root
          data={READINGS.map((v, index) => ({ name: `k${String(index)}`, v }))}
          config={ONE_SERIES}
          xKey="name"
          xScale="point"
          yInclude={PERCENT}
          data-intro="none"
          aria-label="Area and line">
          <Chart.Crosshair />
          <Chart.Area dataKey="v" curve="step" />
          <Chart.Line dataKey="v" curve="linear" />
          <Chart.ActiveDot dataKey="v" />
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

/** A monotone Line whose ActiveDot sits inside a display: contents wrapper. */
function WrappedDot() {
  return (
    <div style={{ padding: "120px 24px 24px", width: 648, boxSizing: "border-box" }}>
      <LocaleProvider locale="en-US">
        <Chart.Root
          data={READINGS.map((v, index) => ({ name: `k${String(index)}`, v }))}
          config={ONE_SERIES}
          xKey="name"
          xScale="point"
          yInclude={PERCENT}
          data-intro="none"
          aria-label="Wrapped">
          <Chart.Crosshair />
          <Chart.Line dataKey="v" curve="monotone" />
          <div style={{ display: "contents" }}>
            <Chart.ActiveDot dataKey="v" />
          </div>
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

// DOM audit: the crosshair is aria-hidden plot output.
const crosshairLayer = (host: HTMLElement) => host.querySelector('[data-slot="chart-crosshair"]');

/** Points every quarter pixel along the drawn line, in client pixels. */
function linePoints(host: HTMLElement): DOMPoint[] {
  // DOM audit: the line is aria-hidden plot output.
  const path = host.querySelector<SVGPathElement>('[data-slot="chart-line"][data-part="solid"]');
  const matrix = path?.getScreenCTM();
  if (path === null || matrix === null || matrix === undefined) throw new Error("no line");
  const length = path.getTotalLength();
  return Array.from({ length: Math.ceil(length * 4) + 1 }, (_, index) =>
    path.getPointAtLength(Math.min(length, index / 4)).matrixTransform(matrix)
  );
}

/** How far a frame's dot lies from the nearest point along the line. */
const offLine = (points: readonly DOMPoint[], frame: DotAndCrosshair) =>
  Math.min(...points.map((point) => Math.hypot(point.x - frame.x, point.y - frame.y)));

describe("an active dot on a fast step across several slots", () => {
  it.each([
    ["the natural line", () => <RideChart curve="natural" />],
    ["the monotone line", () => <RideChart curve="monotone" />],
    ["the step line", () => <RideChart curve="step" />],
    // It joins the Line on a data update, so it rides the Line though the Area draws first.
    ["the Line of a series an Area draws too", () => <AreaAndLine />],
    ["the line from inside a display: contents wrapper", () => <WrappedDot />],
  ] as const)("rides %s, on the crosshair, along its whole glide", async (_name, chart: () => ReactNode) => {
    const { host } = renderThemed(chart());
    await nextFrames(2);
    moveTo(host, 1);
    await nextFrames(40);
    const points = linePoints(host);
    // A quick nudge, then the step from k1 to k5, so the pointer reads as fast.
    moveTo(host, 1, 2);
    await nextFrames(1);
    moveTo(host, 5);
    const frames = sweepGlides(host, () => shown(host));
    expect(onTheWay(frames).length, JSON.stringify(frames)).toBeGreaterThan(3);
    for (const frame of frames) {
      expect(offLine(points, frame), JSON.stringify(frame)).toBeLessThanOrEqual(1);
      expect(Math.abs(frame.x - frame.crosshair), JSON.stringify(frame)).toBeLessThanOrEqual(1);
    }
  });
});

describe("an active dot on a fast step across a zigzag", () => {
  it("rides every peak of the line, on the crosshair, along its whole glide", async () => {
    // Nine readings that alternate 20 and 80, stepped from the first to the last at once, across
    // four peaks. Past the last reading the dot holds while the crosshair overshoots.
    const zigzag = [20, 80, 20, 80, 20, 80, 20, 80, 20];
    const { host } = renderThemed(<RideChart curve="linear" readings={zigzag} />);
    await nextFrames(2);
    moveTo(host, 0, 0, zigzag.length);
    await nextFrames(40);
    const points = linePoints(host);
    moveTo(host, 0, 2, zigzag.length);
    await nextFrames(1);
    moveTo(host, 8, 0, zigzag.length);
    const frames = sweepGlides(host, () => shown(host));
    expect(onTheWay(frames).length, JSON.stringify(frames)).toBeGreaterThan(3);
    const end = Math.max(...points.map(({ x }) => x));
    for (const frame of frames) {
      expect(offLine(points, frame), JSON.stringify(frame)).toBeLessThanOrEqual(1);
      expect(frame.x, JSON.stringify(frame)).toBeLessThanOrEqual(end + 0.5);
      expect(Math.abs(frame.x - Math.min(frame.crosshair, end)), JSON.stringify(frame)).toBeLessThanOrEqual(
        1
      );
    }
  });
});

/** How long the running glide of a layer lasts, in milliseconds. */
function glideLength(layer: Element | null): number {
  const animation = layer?.getAnimations().find(({ playState }) => playState === "running");
  return Number(animation?.effect?.getComputedTiming().duration ?? Number.NaN);
}

describe("the pace of a step", () => {
  // The follow spring, stiffness 300 and damping 30, is the floor.
  const floor = settling(300, 30);

  it("follows a slow step on the floor spring, and a fast one over the same distance sooner", async () => {
    const { host } = renderThemed(<RideChart curve="monotone" />);
    await nextFrames(2);
    moveTo(host, 1);
    await wait(1200);
    moveTo(host, 5);
    await nextFrames(1);
    const slow = glideLength(dotLayer(host));
    expect(glideLength(crosshairLayer(host))).toBe(slow);
    await wait(1200);
    moveTo(host, 1);
    await wait(1200);
    moveTo(host, 1, 2);
    await nextFrames(1);
    moveTo(host, 5);
    await nextFrames(1);
    const fast = glideLength(dotLayer(host));
    expect(glideLength(crosshairLayer(host))).toBe(fast);
    expect(Math.abs(slow - floor), `${String(slow)} ms against ${String(floor)} ms`).toBeLessThanOrEqual(1);
    // The fastest pointer settles in about 120 ms.
    expect(fast).toBeLessThan(slow);
    expect(fast).toBeLessThanOrEqual(130);
  });

  it("follows a keyboard step on the fastest spring, which keeps a held arrow key from trailing", async () => {
    // A keyboard step takes FOLLOW_FASTEST, stiffness 5300 at follow's damping ratio, so damping
    // 2 · (30 / (2√300)) · √5300 ≈ 126.1.
    const fastest = settling(5300, (30 / Math.sqrt(300)) * Math.sqrt(5300));
    const { host } = renderThemed(<RideChart curve="monotone" />);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    await userEvent.keyboard("{Home}");
    await nextFrames(40);
    await userEvent.keyboard("{ArrowRight}");
    await nextFrames(1);
    expect(Math.abs(glideLength(dotLayer(host)) - fastest)).toBeLessThanOrEqual(1);
    expect(Math.abs(glideLength(crosshairLayer(host)) - fastest)).toBeLessThanOrEqual(1);
  });
});

/** A dense chart of 2,400 point slots over a 300 px plot, with a crosshair and an ActiveDot. */
function DenseChart({
  rows,
  curve,
  label,
}: {
  readonly rows: readonly { readonly name: string; readonly v: number }[];
  readonly curve: ChartCurve;
  readonly label: string;
}) {
  return (
    <div style={{ padding: "120px 24px 24px", width: 348, boxSizing: "border-box" }}>
      <LocaleProvider locale="en-US">
        <Chart.Root
          data={rows}
          config={ONE_SERIES}
          xKey="name"
          xScale="point"
          yInclude={PERCENT}
          data-intro="none"
          aria-label={label}>
          <Chart.Crosshair />
          <Chart.Line dataKey="v" curve={curve} />
          <Chart.ActiveDot dataKey="v" />
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

/**
 * 2,400 point slots over a 300 px plot, so each 8-slot column keeps its first, last, lowest and
 * highest readings. In c1200 to c1207 those are c1200, c1201 at 0, c1202 at 100 and c1207, so c1203
 * at 60 draws no vertex, and the line passes it on the way from c1202 down to c1207.
 */
const DENSE = Array.from({ length: 2400 }, (_, index) => ({
  name: `c${String(index)}`,
  v: index === 1201 ? 0 : index === 1202 ? 100 : index === 1203 ? 60 : 20,
}));

describe("an active dot stepping onto a reading the line leaves out", () => {
  it("starts its glide where it showed, and rests where the line passes the slot", async () => {
    const { host } = renderThemed(<DenseChart rows={DENSE} curve="linear" label="Dense" />);
    await nextFrames(2);
    // c1000 opens its column, so the line draws a vertex there, 25 px left of c1203.
    moveTo(host, 1000, 0, DENSE.length);
    await nextFrames(40);
    const before = shown(host);
    moveTo(host, 1203, 0, DENSE.length);
    const { frames, stop } = everyFrame(() => shown(host));
    await nextFrames(60);
    stop();
    const first = frames[0];
    if (first === undefined) throw new Error("no frames");
    expect(
      Math.hypot(first.x - before.x, first.y - before.y),
      JSON.stringify({ before, first })
    ).toBeLessThanOrEqual(1);
    const rest = frames.at(-1);
    if (rest === undefined) throw new Error("no frames");
    expect(offLine(linePoints(host), rest)).toBeLessThanOrEqual(1);
  });
});

/**
 * Where the dot's running glide starts: its animations paused at their first frame, as the frame
 * after the step shows them, with the dot's centre read there.
 */
function glideStart(host: HTMLElement): DotAndCrosshair {
  for (const animation of dotLayer(host)?.getAnimations() ?? []) {
    animation.pause();
    animation.currentTime = 0;
  }
  return shown(host);
}

describe("a step that interrupts a glide over a steep stretch", () => {
  it("starts the new glide where the dot showed", async () => {
    // 600 readings a pixel apart on a 200 px plot: 0, then 35, then 100 from k2 on. The line climbs
    // 70 px over k0 to k1 and 130 px over k1 to k2, a bend that is under half a pixel off a straight
    // line from k0 to k2 measured square to it, though 30 px off it measured straight up.
    const steep = Array.from({ length: 600 }, (_, index) => (index === 0 ? 0 : index === 1 ? 35 : 100));
    const { host } = renderThemed(<RideChart curve="linear" readings={steep} plotHeight="200px" />);
    await nextFrames(2);
    moveTo(host, 0, 0, steep.length);
    await nextFrames(40);
    moveTo(host, 2, 0, steep.length);
    await nextFrames(3);
    // Stop the glide where it shows, then step on.
    for (const animation of dotLayer(host)?.getAnimations() ?? []) animation.pause();
    const before = shown(host);
    moveTo(host, 40, 0, steep.length);
    await nextFrames(1);
    const after = glideStart(host);
    expect(
      Math.hypot(after.x - before.x, after.y - before.y),
      JSON.stringify({ before, after })
    ).toBeLessThanOrEqual(1);
  });
});

describe("a step after a data update moved the dot", () => {
  it("starts its glide where the dot shows after the update", async () => {
    const readings = [10, 50, 50, 50, 50, 50, 50];
    const { host, rerender } = renderThemed(<RideChart curve="linear" readings={readings} />);
    await nextFrames(2);
    moveTo(host, 0);
    await nextFrames(40);
    // k0 rises from 10 to 90 while it stays active, and the update's tween lands.
    rerender(<RideChart curve="linear" readings={[90, ...readings.slice(1)]} />);
    await nextFrames(60);
    const before = shown(host);
    moveTo(host, 1);
    await nextFrames(1);
    const after = glideStart(host);
    expect(
      Math.hypot(after.x - before.x, after.y - before.y),
      JSON.stringify({ before, after })
    ).toBeLessThanOrEqual(1);
  });
});

/**
 * 2,400 point slots over a 300 px plot, whose last 8-slot column keeps c2392, c2393 at 0, c2394 at
 * 100 and c2399 at 60, so the line ends on a vertical stack at the plot's right edge.
 */
const DENSE_END = Array.from({ length: 2400 }, (_, index) => ({
  name: `c${String(index)}`,
  v: index === 2393 ? 0 : index === 2394 ? 100 : index === 2399 ? 60 : 20,
}));

describe("an active dot stepping onto a line's last reading, on a stack", () => {
  it("rides the line onto the stack and holds at its last point", async () => {
    const { host } = renderThemed(<DenseChart rows={DENSE_END} curve="linear" label="Dense end" />);
    await nextFrames(2);
    moveTo(host, 2000, 0, DENSE_END.length);
    await nextFrames(40);
    const points = linePoints(host);
    const end = Math.max(...points.map(({ x }) => x));
    moveTo(host, 2000, 0.5, DENSE_END.length);
    await nextFrames(1);
    moveTo(host, 2399, 0, DENSE_END.length);
    const frames = sweepGlides(host, () => shown(host));
    expect(onTheWay(frames).length, JSON.stringify(frames)).toBeGreaterThan(3);
    for (const frame of frames) {
      expect(offLine(points, frame), JSON.stringify(frame)).toBeLessThanOrEqual(1);
      expect(frame.x, JSON.stringify(frame)).toBeLessThanOrEqual(end + 0.5);
    }
  });
});

describe("a slow step interrupted on a steep track", () => {
  it("starts the next glide where the dot showed, by the easing the animation plays", async () => {
    // 600 readings a pixel apart that alternate 0 and 100 on a 200 px plot, so the track climbs or
    // falls 200 px within every pixel along it, and a fraction of a pixel along is many across.
    const saw = Array.from({ length: 600 }, (_, index) => (index % 2 === 0 ? 0 : 100));
    const { host } = renderThemed(<RideChart curve="linear" readings={saw} plotHeight="200px" />);
    await nextFrames(2);
    moveTo(host, 0, 0, saw.length);
    // A pause before the step, so the pointer reads as slow and the step takes the floor spring.
    await wait(1200);
    moveTo(host, 599, 0, saw.length);
    await wait(70);
    for (const animation of dotLayer(host)?.getAnimations() ?? []) animation.pause();
    const before = shown(host);
    moveTo(host, 300, 0, saw.length);
    await nextFrames(1);
    const after = glideStart(host);
    expect(
      Math.hypot(after.x - before.x, after.y - before.y),
      JSON.stringify({ before, after })
    ).toBeLessThanOrEqual(1);
  });
});

/**
 * 2,400 readings over a 300 px plot on a natural curve, uneven from one slot to the next, so the
 * decimated columns stack several vertices on one pixel and the spline bends back between them.
 */
const DENSE_NATURAL = Array.from({ length: 2400 }, (_, index) => ({
  name: `c${String(index)}`,
  v: 50 + 30 * Math.sin(index / 50) + (((index * 37) % 11) - 5) * 2,
}));

describe("an active dot on a dense natural line", () => {
  /** The line's cubic segments and straight lines, from its own path data, in client pixels. */
  function drawnSegments(path: SVGPathElement): DOMPoint[][] {
    const matrix = path.getScreenCTM();
    if (matrix === null) throw new Error("no line matrix");
    const tokens =
      (path.getAttribute("d") ?? "").match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gu) ?? [];
    const segments: DOMPoint[][] = [];
    let at = new DOMPoint();
    let command = "";
    let numbers: number[] = [];
    const point = (x = 0, y = 0) => new DOMPoint(x, y).matrixTransform(matrix);
    for (const token of tokens) {
      if (/^[A-Za-z]$/u.test(token)) {
        command = token;
        numbers = [];
        continue;
      }
      numbers.push(Number(token));
      if (command === "M" && numbers.length === 2) {
        at = point(numbers[0], numbers[1]);
        command = "L";
        numbers = [];
      } else if (command === "L" && numbers.length === 2) {
        const next = point(numbers[0], numbers[1]);
        segments.push([at, next]);
        at = next;
        numbers = [];
      } else if (command === "C" && numbers.length === 6) {
        const [x1, y1, x2, y2, x, y] = numbers;
        const end = point(x, y);
        segments.push([at, point(x1, y1), point(x2, y2), end]);
        at = end;
        numbers = [];
      }
    }
    return segments;
  }

  /** How far a point lies from the drawn segments, sampling each one near it every 1/200 of the way. */
  function offCurve(segments: readonly DOMPoint[][], x: number, y: number): number {
    let least = Number.POSITIVE_INFINITY;
    for (const segment of segments) {
      const xs = segment.map((point) => point.x);
      if (Math.min(...xs) > x + 2 || Math.max(...xs) < x - 2) continue;
      for (let step = 0; step <= 200; step += 1) {
        const t = step / 200;
        const u = 1 - t;
        const weights = segment.length === 4 ? [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] : [u, t];
        const [px, py] = [0, 0].map((_, axis) =>
          segment.reduce(
            (sum, point, index) => sum + (weights[index] ?? 0) * (axis === 0 ? point.x : point.y),
            0
          )
        );
        least = Math.min(least, Math.hypot((px ?? 0) - x, (py ?? 0) - y));
      }
    }
    return least;
  }

  it.each([
    // c1507 and c1941 are drawn inside the bends the spline makes in their columns, 39 px across
    // from where the run, which leaves each bend out, passes them.
    { name: "forward", from: 1507, to: 1941 },
    { name: "backward", from: 1941, to: 1507 },
  ])(
    "keeps every place of a ride within 1 px of the line, $name between readings inside its bends",
    async ({ from, to }) => {
      const { host } = renderThemed(
        <DenseChart rows={DENSE_NATURAL} curve="natural" label="Dense natural" />
      );
      await nextFrames(2);
      // The dot shows on the first reading, then settles there.
      moveTo(host, from, 0, DENSE_NATURAL.length);
      await nextFrames(60);
      // DOM audit: the line is aria-hidden plot output.
      const path = host.querySelector<SVGPathElement>('[data-slot="chart-line"][data-part="solid"]');
      if (path === null) throw new Error("no line");
      const segments = drawnSegments(path);
      moveTo(host, to, 0, DENSE_NATURAL.length);
      await nextFrames(1);
      // The ride, paused and swept through its whole duration a millisecond at a time.
      const [ride] = dotLayer(host)?.getAnimations() ?? [];
      if (ride === undefined) throw new Error("no ride");
      ride.pause();
      const duration = Number(ride.effect?.getTiming().duration);
      const ridden = ride.effect instanceof KeyframeEffect ? ride.effect.getKeyframes().length : 0;
      expect(ridden).toBeGreaterThan(2);
      const off: string[] = [];
      for (let time = 0; time <= duration; time += 1) {
        ride.currentTime = time;
        const { x, y } = shown(host);
        const away = offCurve(segments, x, y);
        if (away > 1)
          off.push(`${String(time)} ms: ${x.toFixed(2)}, ${y.toFixed(2)} is ${away.toFixed(2)} px off`);
      }
      expect(off).toEqual([]);
    }
  );
});
