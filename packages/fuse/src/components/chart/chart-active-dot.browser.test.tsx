// The active dot's glide with motion on, in Chromium. Oracles: the drawn line's own geometry, which
// the path's getPointAtLength gives through its screen matrix; the crosshair's drawn line; and, for
// the glide's pace, the closed-form response of a damped oscillator of mass 1, written below.
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { glideLanded, popup } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig, ChartCurve } from "./chart-types";
import "./chart.css";

/** Seven readings that dip and climb, so every curve bends between them. */
const READINGS = [70, 20, 85, 10, 60, 30, 90];

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
          config={{ v: { label: "V", color: "chart-1" } }}
          xKey="name"
          xScale="point"
          yInclude={[0, 100]}
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

/** The plot's pointer surface. */
function surface(host: HTMLElement): HTMLElement {
  // DOM audit: the plot's listbox is its one pointer target.
  const found = host.querySelector<HTMLElement>('[role="listbox"]');
  if (found === null) throw new Error("no plot");
  return found;
}

/** A pointer move over a slot's centre, by `nudge` px to its right, as the chart's own events. */
function moveTo(host: HTMLElement, slot: number, nudge = 0, count = READINGS.length): void {
  const box = surface(host).getBoundingClientRect();
  surface(host).dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      clientX: box.left + (box.width * slot) / (count - 1) + nudge,
      clientY: box.top + box.height / 2,
      pointerType: "mouse",
    })
  );
}

/** Wait through at least `ms` milliseconds of frames. */
async function wait(ms: number): Promise<void> {
  const start = performance.now();
  do await nextFrames(1);
  while (performance.now() - start < ms);
}

// DOM audit: the active dot, its layer and the crosshair are aria-hidden plot output.
const dotLayer = (host: HTMLElement) => host.querySelector('[data-slot="chart-active-dot"]');
const crosshairLayer = (host: HTMLElement) => host.querySelector('[data-slot="chart-crosshair"]');

/** The dot's centre and the crosshair line's centre along x, in client pixels. */
function shown(host: HTMLElement) {
  const dot = dotLayer(host)?.querySelector('[data-slot="chart-dot"]')?.getBoundingClientRect();
  const line = host.querySelector('[data-slot="chart-crosshair-mark"]')?.getBoundingClientRect();
  if (dot === undefined || line === undefined) throw new Error("no dot or crosshair");
  return {
    x: (dot.left + dot.right) / 2,
    y: (dot.top + dot.bottom) / 2,
    crosshair: (line.left + line.right) / 2,
    gliding: (dotLayer(host)?.getAnimations() ?? []).some(({ playState }) => playState === "running"),
  };
}

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

describe("an active dot on a fast step across several slots", () => {
  it.each(["natural", "monotone", "step"] as const)(
    "rides the %s line, on the crosshair, in every frame",
    async (curve) => {
      const { host } = renderThemed(<RideChart curve={curve} />);
      await nextFrames(2);
      moveTo(host, 1);
      await nextFrames(40);
      const points = linePoints(host);
      const frames: ReturnType<typeof shown>[] = [];
      let watching = true;
      const watch = () => {
        if (!watching) return;
        frames.push(shown(host));
        requestAnimationFrame(watch);
      };
      // A quick nudge, then the step from k1 to k5, so the pointer reads as fast.
      moveTo(host, 1, 2);
      await nextFrames(1);
      moveTo(host, 5);
      requestAnimationFrame(watch);
      await nextFrames(60);
      watching = false;
      const moving = frames.filter(({ gliding }) => gliding);
      expect(moving.length, JSON.stringify(frames)).toBeGreaterThan(3);
      for (const frame of frames) {
        const off = Math.min(...points.map((point) => Math.hypot(point.x - frame.x, point.y - frame.y)));
        expect(off, JSON.stringify(frame)).toBeLessThanOrEqual(1);
        expect(Math.abs(frame.x - frame.crosshair), JSON.stringify(frame)).toBeLessThanOrEqual(1);
      }
    }
  );
});

describe("an active dot on a fast step across a zigzag", () => {
  it("rides every peak of the line, on the crosshair, in every frame", async () => {
    // Nine readings that alternate 20 and 80, stepped from the first to the last at once, across
    // four peaks. Past the last reading the dot holds while the crosshair overshoots.
    const zigzag = [20, 80, 20, 80, 20, 80, 20, 80, 20];
    const { host } = renderThemed(<RideChart curve="linear" readings={zigzag} />);
    await nextFrames(2);
    moveTo(host, 0, 0, zigzag.length);
    await nextFrames(40);
    const points = linePoints(host);
    const frames: ReturnType<typeof shown>[] = [];
    let watching = true;
    const watch = () => {
      if (!watching) return;
      frames.push(shown(host));
      requestAnimationFrame(watch);
    };
    moveTo(host, 0, 2, zigzag.length);
    await nextFrames(1);
    moveTo(host, 8, 0, zigzag.length);
    requestAnimationFrame(watch);
    await nextFrames(60);
    watching = false;
    expect(frames.filter(({ gliding }) => gliding).length, JSON.stringify(frames)).toBeGreaterThan(3);
    const end = Math.max(...points.map(({ x }) => x));
    for (const frame of frames) {
      const off = Math.min(...points.map((point) => Math.hypot(point.x - frame.x, point.y - frame.y)));
      expect(off, JSON.stringify(frame)).toBeLessThanOrEqual(1);
      expect(frame.x, JSON.stringify(frame)).toBeLessThanOrEqual(end + 0.5);
      expect(Math.abs(frame.x - Math.min(frame.crosshair, end)), JSON.stringify(frame)).toBeLessThanOrEqual(
        1
      );
    }
  });
});

/** The oscillator's position at `t` seconds, released from rest at 0 towards 1, damping below critical. */
function oscillator(stiffness: number, damping: number, t: number): number {
  const natural = Math.sqrt(stiffness);
  const ratio = damping / (2 * natural);
  const damped = natural * Math.sqrt(1 - ratio * ratio);
  const decay = Math.exp(-ratio * natural * t);
  return 1 - decay * (Math.cos(damped * t) + ((ratio * natural) / damped) * Math.sin(damped * t));
}

/** The milliseconds until the oscillator stays within 0.1% of its target. */
function settling(stiffness: number, damping: number): number {
  let last = 0;
  for (let ms = 1; ms <= 5000; ms += 1) {
    if (Math.abs(1 - oscillator(stiffness, damping, ms / 1000)) >= 0.001) last = ms;
  }
  return last + 1;
}

/** How long the running glide of a layer lasts, in milliseconds. */
function glideLength(layer: Element | null): number {
  const animation = layer?.getAnimations().find(({ playState }) => playState === "running");
  return Number(animation?.effect?.getComputedTiming().duration ?? Number.NaN);
}

describe("the pace of a step", () => {
  // bklit's tooltip-dot spring, stiffness 300 and damping 30, is the floor.
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

  it("follows a keyboard step on the floor spring", async () => {
    const { host } = renderThemed(<RideChart curve="monotone" />);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    await userEvent.keyboard("{Home}");
    await nextFrames(40);
    await userEvent.keyboard("{ArrowRight}");
    await nextFrames(1);
    expect(Math.abs(glideLength(dotLayer(host)) - floor)).toBeLessThanOrEqual(1);
    expect(Math.abs(glideLength(crosshairLayer(host)) - floor)).toBeLessThanOrEqual(1);
  });
});

/** Bars over seven slots, with a line crosshair and an ActiveDot on the series `dot` names. */
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

/** A pointer move over a band slot's centre, by `nudge` px to its right. */
function moveToBand(host: HTMLElement, slot: number, nudge = 0): void {
  const box = surface(host).getBoundingClientRect();
  surface(host).dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      clientX: box.left + (box.width * (slot + 0.5)) / READINGS.length + nudge,
      clientY: box.top + box.height / 2,
      pointerType: "mouse",
    })
  );
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

/** How far a point lies from the straight track through a list of points. */
function offTrack(point: { x: number; y: number }, track: readonly { x: number; y: number }[]): number {
  let least = Number.POSITIVE_INFINITY;
  track.forEach((end, index) => {
    const start = track[index - 1];
    if (start === undefined) {
      least = Math.min(least, Math.hypot(point.x - end.x, point.y - end.y));
      return;
    }
    const [dx, dy] = [end.x - start.x, end.y - start.y];
    const share = Math.max(
      0,
      Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy))
    );
    least = Math.min(least, Math.hypot(point.x - start.x - dx * share, point.y - start.y - dy * share));
  });
  return least;
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
    "rides the straight track through the %s' far ends, on the crosshair, in every frame",
    async (_name, rows, stacked, domain, hanging) => {
      const { host } = renderThemed(<BarRideChart rows={rows} stacked={stacked} domain={domain} />);
      await nextFrames(2);
      moveToBand(host, 1);
      await nextFrames(40);
      const ends = barEnds(host, stacked ? 1 : 0, hanging);
      expect(ends).toHaveLength(READINGS.length);
      const frames: ReturnType<typeof shown>[] = [];
      let watching = true;
      const watch = () => {
        if (!watching) return;
        frames.push(shown(host));
        requestAnimationFrame(watch);
      };
      // A quick nudge, then the step from k1 to k5, so the pointer reads as fast.
      moveToBand(host, 1, 2);
      await nextFrames(1);
      moveToBand(host, 5);
      requestAnimationFrame(watch);
      await nextFrames(60);
      watching = false;
      const moving = frames.filter(({ gliding }) => gliding);
      expect(moving.length, JSON.stringify(frames)).toBeGreaterThan(3);
      for (const frame of frames) {
        expect(offTrack(frame, ends), JSON.stringify(frame)).toBeLessThanOrEqual(1);
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
    const frames: ReturnType<typeof shown>[] = [];
    let watching = true;
    const watch = () => {
      if (!watching) return;
      frames.push(shown(host));
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
    moveToBand(host, 2);
    await nextFrames(40);
    watching = false;
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

/** Two series side by side in a BarGroup, in `order`, with a line crosshair and an ActiveDot on `dot`. */
function GroupChart({
  dot,
  order,
  stacked = false,
}: {
  readonly dot: "a" | "b";
  readonly order: readonly ["a", "b"] | readonly ["b", "a"];
  /** Stacks b on a in one column instead of grouping them side by side. */
  readonly stacked?: boolean;
}) {
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

/** A fast pointer step from one of five band slots to another, frame by frame until it rests. */
async function fastStep(host: HTMLElement, from: number, to: number) {
  const move = (slot: number, nudge = 0) => {
    const box = surface(host).getBoundingClientRect();
    surface(host).dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: box.left + (box.width * (slot + 0.5)) / 5 + nudge,
        clientY: box.top + box.height / 2,
        pointerType: "mouse",
      })
    );
  };
  move(from);
  await nextFrames(40);
  const frames: { x: number; y: number; gliding: boolean }[] = [];
  let watching = true;
  const watch = () => {
    if (!watching) return;
    // DOM audit: the active dot is aria-hidden plot output, so its slot is the only locator.
    const dot = dotLayer(host)?.querySelector('[data-slot="chart-dot"]')?.getBoundingClientRect();
    if (dot !== undefined) {
      frames.push({
        x: (dot.left + dot.right) / 2,
        y: (dot.top + dot.bottom) / 2,
        gliding: (dotLayer(host)?.getAnimations() ?? []).some(({ playState }) => playState === "running"),
      });
    }
    requestAnimationFrame(watch);
  };
  move(from, 2);
  await nextFrames(1);
  move(to);
  requestAnimationFrame(watch);
  await nextFrames(60);
  watching = false;
  return frames;
}

describe("an active dot on bars after its bars change", () => {
  it("rides the new series' bars after its dataKey changes", async () => {
    // b stacks on a in the same columns, so a's flat track and b's peaked one share their places
    // along x, and a track kept from a would carry the dot flat under b's peak at k1.
    const { host, rerender } = renderThemed(<GroupChart dot="a" order={["a", "b"]} stacked />);
    await nextFrames(2);
    await fastStep(host, 0, 2);
    rerender(<GroupChart dot="b" order={["a", "b"]} stacked />);
    await nextFrames(2);
    const frames = await fastStep(host, 0, 4);
    const ends = barEnds(host, 1, [false, false, false, false, false]);
    expect(frames.filter(({ gliding }) => gliding).length, JSON.stringify(frames)).toBeGreaterThan(3);
    for (const frame of frames) {
      expect(offTrack(frame, ends), JSON.stringify(frame)).toBeLessThanOrEqual(1);
      expect(frame.x, JSON.stringify(frame)).toBeLessThanOrEqual((ends[4]?.x ?? 0) + 0.5);
    }
  });

  it("rides its bars' new places after the BarGroup's order changes", async () => {
    const { host, rerender } = renderThemed(<GroupChart dot="b" order={["a", "b"]} />);
    await nextFrames(2);
    await fastStep(host, 0, 2);
    rerender(<GroupChart dot="b" order={["b", "a"]} />);
    await nextFrames(2);
    const frames = await fastStep(host, 0, 4);
    const ends = barEnds(host, 1, [false, false, false, false, false]);
    expect(frames.filter(({ gliding }) => gliding).length, JSON.stringify(frames)).toBeGreaterThan(3);
    for (const frame of frames) {
      expect(offTrack(frame, ends), JSON.stringify(frame)).toBeLessThanOrEqual(1);
      expect(frame.x, JSON.stringify(frame)).toBeLessThanOrEqual((ends[4]?.x ?? 0) + 0.5);
    }
  });
});

/**
 * 2,400 point slots over a 300 px plot, so each 8-slot column keeps its first, last, lowest and
 * highest readings. In c1200 to c1207 those are c1200, c1201 at 0, c1202 at 100 and c1207, so c1203
 * at 60 draws no vertex, and the line passes it on the way from c1202 down to c1207.
 */
const DENSE = Array.from({ length: 2400 }, (_, index) => ({
  name: `c${String(index)}`,
  v: index === 1201 ? 0 : index === 1202 ? 100 : index === 1203 ? 60 : 20,
}));
const DENSE_CONFIG: ChartConfig = { v: { label: "V", color: "chart-1" } };
const DENSE_DOMAIN = [0, 100] as const;

describe("an active dot stepping onto a reading the line leaves out", () => {
  it("starts its glide where it showed, and rests where the line passes the slot", async () => {
    const { host } = renderThemed(
      <div style={{ padding: "120px 24px 24px", width: 348, boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={DENSE}
            config={DENSE_CONFIG}
            xKey="name"
            xScale="point"
            yInclude={DENSE_DOMAIN}
            data-intro="none"
            aria-label="Dense">
            <Chart.Crosshair />
            <Chart.Line dataKey="v" curve="linear" />
            <Chart.ActiveDot dataKey="v" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    await nextFrames(2);
    // c1000 opens its column, so the line draws a vertex there, 25 px left of c1203.
    moveTo(host, 1000, 0, DENSE.length);
    await nextFrames(40);
    const before = shown(host);
    const frames: ReturnType<typeof shown>[] = [];
    let watching = true;
    const watch = () => {
      if (!watching) return;
      frames.push(shown(host));
      requestAnimationFrame(watch);
    };
    moveTo(host, 1203, 0, DENSE.length);
    requestAnimationFrame(watch);
    await nextFrames(60);
    watching = false;
    const first = frames[0];
    if (first === undefined) throw new Error("no frames");
    expect(
      Math.hypot(first.x - before.x, first.y - before.y),
      JSON.stringify({ before, first })
    ).toBeLessThanOrEqual(1);
    const rest = frames.at(-1);
    const points = linePoints(host);
    if (rest === undefined) throw new Error("no frames");
    expect(
      Math.min(...points.map((point) => Math.hypot(point.x - rest.x, point.y - rest.y)))
    ).toBeLessThanOrEqual(1);
  });
});

describe("an active dot on a series that a Line and an Area both draw", () => {
  it("rides the Line, as it joins the Line on a data update, though the Area draws first", async () => {
    const { host } = renderThemed(
      <div style={{ padding: "120px 24px 24px", width: 648, boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={READINGS.map((v, index) => ({ name: `k${String(index)}`, v }))}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            xScale="point"
            yInclude={[0, 100]}
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
    await nextFrames(2);
    moveTo(host, 1);
    await nextFrames(40);
    const points = linePoints(host);
    const frames: ReturnType<typeof shown>[] = [];
    let watching = true;
    const watch = () => {
      if (!watching) return;
      frames.push(shown(host));
      requestAnimationFrame(watch);
    };
    moveTo(host, 1, 2);
    await nextFrames(1);
    moveTo(host, 5);
    requestAnimationFrame(watch);
    await nextFrames(60);
    watching = false;
    expect(frames.filter(({ gliding }) => gliding).length, JSON.stringify(frames)).toBeGreaterThan(3);
    for (const frame of frames) {
      const off = Math.min(...points.map((point) => Math.hypot(point.x - frame.x, point.y - frame.y)));
      expect(off, JSON.stringify(frame)).toBeLessThanOrEqual(1);
    }
  });
});

/**
 * Where the dot's running glide starts: its animations paused at their first frame, as the frame
 * after the step shows them, with the dot's centre read there.
 */
function glideStart(host: HTMLElement): ReturnType<typeof shown> {
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
    const { host } = renderThemed(
      <div style={{ padding: "120px 24px 24px", width: 348, boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={DENSE_END}
            config={DENSE_CONFIG}
            xKey="name"
            xScale="point"
            yInclude={DENSE_DOMAIN}
            data-intro="none"
            aria-label="Dense end">
            <Chart.Crosshair />
            <Chart.Line dataKey="v" curve="linear" />
            <Chart.ActiveDot dataKey="v" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    await nextFrames(2);
    moveTo(host, 2000, 0, DENSE_END.length);
    await nextFrames(40);
    const points = linePoints(host);
    const end = Math.max(...points.map(({ x }) => x));
    const frames: ReturnType<typeof shown>[] = [];
    let watching = true;
    const watch = () => {
      if (!watching) return;
      frames.push(shown(host));
      requestAnimationFrame(watch);
    };
    moveTo(host, 2000, 0.5, DENSE_END.length);
    await nextFrames(1);
    moveTo(host, 2399, 0, DENSE_END.length);
    requestAnimationFrame(watch);
    await nextFrames(60);
    watching = false;
    expect(frames.filter(({ gliding }) => gliding).length, JSON.stringify(frames)).toBeGreaterThan(3);
    for (const frame of frames) {
      const off = Math.min(...points.map((point) => Math.hypot(point.x - frame.x, point.y - frame.y)));
      expect(off, JSON.stringify(frame)).toBeLessThanOrEqual(1);
      expect(frame.x, JSON.stringify(frame)).toBeLessThanOrEqual(end + 0.5);
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
      const box = surface(host).getBoundingClientRect();
      surface(host).dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: box.left + (box.width * (slot + 0.5)) / 10 + nudge,
          clientY: box.top + box.height / 2,
          pointerType: "mouse",
        })
      );
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
    const frames: ReturnType<typeof shown>[] = [];
    let watching = true;
    const watch = () => {
      if (!watching) return;
      frames.push(shown(host));
      requestAnimationFrame(watch);
    };
    move(0, 2);
    await nextFrames(1);
    move(6);
    requestAnimationFrame(watch);
    await nextFrames(60);
    watching = false;
    expect(frames.filter(({ gliding }) => gliding).length, JSON.stringify(frames)).toBeGreaterThan(3);
    for (const frame of frames) expect(offTrack(frame, rests), JSON.stringify(frame)).toBeLessThanOrEqual(1);
  });
});

/** 600 readings a pixel apart: k0 at 10, then 60 from k1 on, so a step from k0 to k1 is mostly a rise. */
const RISE = Array.from({ length: 600 }, (_, index) => ({
  name: `k${String(index)}`,
  v: index === 0 ? 10 : 60,
}));

function PingChart() {
  return (
    <div style={{ padding: "200px 24px 24px", width: 648, boxSizing: "border-box" }}>
      {/* The ping ring held at twice its size, so its own scale sits between the dot's layer and the screen. */}
      <style>
        {
          '[data-slot="chart-dot"][data-part="ping"] { animation: none !important; transform: scale(2) !important; }'
        }
      </style>
      <LocaleProvider locale="en-US">
        <Chart.Root
          data={RISE}
          config={DENSE_CONFIG}
          xKey="name"
          xScale="point"
          yInclude={DENSE_DOMAIN}
          data-intro="none"
          style={{ "--chart-plot-height": "200px" }}
          aria-label="Ping rise">
          <Chart.Line dataKey="v" curve="linear" />
          <Chart.ActiveDot dataKey="v" variant="ping" />
          <Chart.Tooltip />
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

describe("a ping dot's glide under the tooltip's roof", () => {
  it("leaves the popup where it rests when it opens on the slot, though the ring is scaled", async () => {
    // Open on k1 at once.
    const fresh = renderThemed(<PingChart />);
    await nextFrames(2);
    moveTo(fresh.host, 1, 0, RISE.length);
    await nextFrames(40);
    await glideLanded();
    const opened = popup()?.getBoundingClientRect().bottom ?? Number.NaN;
    fresh.unmount();
    // Reach k1 by a step from k0: the dot glides up 100 px while the popup measures the roof.
    const stepped = renderThemed(<PingChart />);
    await nextFrames(2);
    moveTo(stepped.host, 0, 0, RISE.length);
    await nextFrames(40);
    await glideLanded();
    moveTo(stepped.host, 1, 0, RISE.length);
    await nextFrames(60);
    await glideLanded();
    const glided = popup()?.getBoundingClientRect().bottom ?? Number.NaN;
    expect(Math.abs(glided - opened), JSON.stringify({ opened, glided })).toBeLessThanOrEqual(1);
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

describe("an active dot whose Line sits elsewhere in the tree", () => {
  it("rides the line from inside a display: contents wrapper", async () => {
    const { host } = renderThemed(
      <div style={{ padding: "120px 24px 24px", width: 648, boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={READINGS.map((v, index) => ({ name: `k${String(index)}`, v }))}
            config={DENSE_CONFIG}
            xKey="name"
            xScale="point"
            yInclude={DENSE_DOMAIN}
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
    await nextFrames(2);
    moveTo(host, 1);
    await nextFrames(40);
    const points = linePoints(host);
    const frames: ReturnType<typeof shown>[] = [];
    let watching = true;
    const watch = () => {
      if (!watching) return;
      frames.push(shown(host));
      requestAnimationFrame(watch);
    };
    moveTo(host, 1, 2);
    await nextFrames(1);
    moveTo(host, 5);
    requestAnimationFrame(watch);
    await nextFrames(60);
    watching = false;
    expect(frames.filter(({ gliding }) => gliding).length, JSON.stringify(frames)).toBeGreaterThan(3);
    for (const frame of frames) {
      const off = Math.min(...points.map((point) => Math.hypot(point.x - frame.x, point.y - frame.y)));
      expect(off, JSON.stringify(frame)).toBeLessThanOrEqual(1);
    }
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
        <div style={{ padding: "120px 24px 24px", width: 348, boxSizing: "border-box" }}>
          <LocaleProvider locale="en-US">
            <Chart.Root
              data={DENSE_NATURAL}
              config={DENSE_CONFIG}
              xKey="name"
              xScale="point"
              yInclude={DENSE_DOMAIN}
              data-intro="none"
              aria-label="Dense natural">
              <Chart.Crosshair />
              <Chart.Line dataKey="v" curve="natural" />
              <Chart.ActiveDot dataKey="v" />
            </Chart.Root>
          </LocaleProvider>
        </div>
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
