// RadarChart's motion against SPEC's Motion table, in Chromium with motion on. Units under test:
// RadarChart.Line on its Root's loop, the Grid's and the AngleAxis's entrance in the stylesheet,
// ActiveDot's ride and the Grid's hand. Oracles, written by hand from the Motion table and S5:
// series s grows from the centre at 600 + s·150 ms over 1000 ms; rings scale out 80 ms apart on
// 100/15 and spokes extend 50 ms apart on 80/15, both with ζω = 7.5, whose envelopes settle within
// 0.1 % by ln 1512 / 7.5 ≈ 976 ms and ln 1835 / 7.5 ≈ 1002 ms; labels fade over 500 ms from 400 ms,
// 50 ms apart; a hydrated grid stays at rest (the owner's L6 decision); an update moves each
// spoke's radius over 480 ms; a change of spoke count crossfades over 150 ms; the active dot rides
// the polygon's edges on the 300/30 follow spring, ln 2000 / 15 ≈ 507 ms for a key step; and the
// hand turns the short way on 420/42, overdamped, its slow root 21 − √(21² − 420) ≈ 16.4 settling
// by about 483 ms. The entrance runs on a hand-driven frame clock, read on the loop's own time; the
// rest read each frame's own timestamp.
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { installFrameClock } from "../../../test/chart/frame-clock";
import { polarFigure } from "../../../test/chart/pie";
import { layerPath, pathPoints, radarLayers } from "../../../test/chart/radar";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { RadarChart } from "./radar-chart-namespace";

/** Half a frame and more either side of a scheduled time, for the frame that straddles it. */
const SLACK = 34;

/** How closely a radius reads back from a path rounded to 3 decimals. */
const ROUNDED = 0.002;

/** Each series line's vertex radii, as drawn now. */
function radii(host: HTMLElement): number[][] {
  return radarLayers(host, "radar-chart-line").map((line) =>
    pathPoints(layerPath(line, "solid").getAttribute("d") ?? "").map(({ x, y }) => Math.hypot(x, y))
  );
}

/** Every frame's time since a start and each series' radii, until `until` ms past the start. */
async function record(
  host: HTMLElement,
  start: () => number | null,
  until: number
): Promise<{ readonly t: number; readonly radii: readonly (readonly number[])[] }[]> {
  const frames: { readonly t: number; readonly radii: readonly (readonly number[])[] }[] = [];
  for (;;) {
    const now = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
    const from = start();
    if (from === null) continue;
    frames.push({ t: now - from, radii: radii(host) });
    if (now - from > until) return frames;
  }
}

/** Each animation's delay and duration on the elements of a slot. */
function timings(
  host: HTMLElement,
  selector: string
): { readonly delay: number; readonly duration: number }[] {
  return [...host.querySelectorAll(selector)].map((element) => {
    const timing = element.getAnimations()[0]?.effect?.getComputedTiming();
    // A delay of 3 × 50 ms computes as 150.00000000000003, so each reads to a hundredth.
    return { delay: Math.round(Number(timing?.delay) * 100) / 100, duration: Number(timing?.duration) };
  });
}

function Chart({
  a,
  b = a,
  intro,
  children,
}: {
  readonly a: readonly number[];
  readonly b?: readonly number[];
  readonly intro?: "none";
  readonly children?: React.ReactNode;
}) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 320 }}>
        <RadarChart.Root
          data={a.map((value, index) => ({ spoke: `s${String(index)}`, a: value, b: b[index] ?? 0 }))}
          config={{ a: { label: "A", color: "chart-1" }, b: { label: "B", color: "chart-2" } }}
          nameKey="spoke"
          max={4}
          data-intro={intro}
          aria-label="Radar">
          <RadarChart.Grid />
          <RadarChart.AngleAxis />
          <RadarChart.Line dataKey="a" />
          <RadarChart.Line dataKey="b" />
          {children}
        </RadarChart.Root>
      </div>
    </LocaleProvider>
  );
}

describe("the radar's entrance (SPEC's Motion table)", () => {
  it("grows series s from the centre at 600 + s·150 ms over 1000 ms, and scales out the grid on a client mount", async () => {
    // The series run on a hand-driven frame clock, which stands still until the entrance starts, so
    // that frame is the loop's t = 0, and each reading is 10 ms of the loop's own time on.
    const clock = installFrameClock();
    const frames: { readonly t: number; readonly radii: readonly (readonly number[])[] }[] = [];
    let rings: ReturnType<typeof timings> = [];
    let spokes: ReturnType<typeof timings> = [];
    let labels: ReturnType<typeof timings> = [];
    try {
      const { host } = renderThemed(<Chart a={[4, 2, 3, 1]} b={[1, 3, 2, 4]} />);
      const figure = polarFigure(host);
      const start = clock.now();
      await expect
        .poll(() => {
          clock.frameAt(start);
          return figure.hasAttribute("data-drawn");
        })
        .toBe(true);
      // DOM audit: the scale-outs and the fade are CSS animations, read from their own animations.
      rings = timings(host, '[data-slot="radar-chart-grid-ring"]');
      spokes = timings(host, '[data-slot="radar-chart-spoke"]:not([data-part])');
      labels = timings(host, '[data-slot="radar-chart-angle-label"]');
      for (let t = 0; t <= 1900; t += 10) {
        clock.frameAt(start + t);
        frames.push({ t, radii: radii(host) });
      }
    } finally {
      clock.restore();
    }
    expect(rings.map(({ delay }) => delay)).toEqual([0, 80, 160, 240]);
    expect(spokes.map(({ delay }) => delay)).toEqual([0, 50, 100, 150]);
    expect(labels).toEqual([0, 1, 2, 3].map((index) => ({ delay: 400 + 50 * index, duration: 500 })));
    for (const { duration } of rings) expect(duration).toBeGreaterThan(600);
    for (const { duration } of rings) expect(duration).toBeLessThanOrEqual(976);
    for (const { duration } of spokes) expect(duration).toBeGreaterThan(600);
    for (const { duration } of spokes) expect(duration).toBeLessThanOrEqual(1002);
    const rests = [
      [1, 0.5, 0.75, 0.25],
      [0.25, 0.75, 0.5, 1],
    ];
    rests.forEach((rest, series) => {
      const begins = 600 + 150 * series;
      const ends = begins + 1000;
      const seen = frames.map((frame) => ({ t: frame.t, radii: frame.radii[series] ?? [] }));
      for (const frame of seen.filter(({ t }) => t <= begins)) {
        expect(frame.radii.every((radius) => radius < ROUNDED)).toBe(true);
      }
      for (const frame of seen.filter(({ t }) => t >= ends)) {
        frame.radii.forEach((radius, spoke) => {
          expect(Math.abs(radius - (rest[spoke] ?? 0))).toBeLessThan(ROUNDED);
        });
      }
      expect(
        seen.some((frame) => (frame.radii[0] ?? 0) > 0.05 && (frame.radii[0] ?? 0) < (rest[0] ?? 0) - 0.05)
      ).toBe(true);
      seen.forEach((frame, index) => {
        frame.radii.forEach((radius, spoke) => {
          expect(radius).toBeGreaterThanOrEqual((seen[index - 1]?.radii[spoke] ?? 0) - ROUNDED);
        });
      });
    });
  });

  it("keeps a hydrated grid and its labels at rest while the series grow in", async () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(<Chart a={[4, 2, 3, 1]} />);
    document.body.append(host);
    const root = hydrateRoot(host, <Chart a={[4, 2, 3, 1]} />);
    try {
      const figure = polarFigure(host);
      await expect.poll(() => figure.hasAttribute("data-entering")).toBe(true);
      expect(figure.hasAttribute("data-grow")).toBe(false);
      // DOM audit: the scale-outs and the fade are CSS animations, read from their own animations.
      const grid = [
        ...host.querySelectorAll(
          '[data-slot="radar-chart-grid-ring"], [data-slot="radar-chart-spoke"], [data-slot="radar-chart-angle-label"]'
        ),
      ];
      expect(grid.flatMap((element) => element.getAnimations())).toEqual([]);
      const [first] = await record(host, () => 0, 0);
      expect(first?.radii[0]?.every((radius) => radius < 1 - ROUNDED)).toBe(true);
    } finally {
      root.unmount();
      host.remove();
    }
  });
});

describe("the radar's updates (R11, S5)", () => {
  it("moves each spoke's radius over 480 ms, between its old and its new", async () => {
    const { host, rerender } = renderThemed(<Chart a={[4, 2, 3, 1]} intro="none" />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    rerender(<Chart a={[2, 4, 1, 3]} intro="none" />);
    const from = performance.now();
    const frames = await record(host, () => from, 700);
    const before = [1, 0.5, 0.75, 0.25];
    const after = [0.5, 1, 0.25, 0.75];
    before.forEach((old, spoke) => {
      const low = Math.min(old, after[spoke] ?? 0);
      const high = Math.max(old, after[spoke] ?? 0);
      const seen = frames.map((frame) => frame.radii[0]?.[spoke] ?? 0);
      expect(seen.every((radius) => radius >= low - ROUNDED && radius <= high + ROUNDED)).toBe(true);
      expect(seen.some((radius) => radius > low + 0.02 && radius < high - 0.02)).toBe(true);
      for (const frame of frames.filter(({ t }) => t > 480 + SLACK)) {
        expect(Math.abs((frame.radii[0]?.[spoke] ?? 0) - (after[spoke] ?? 0))).toBeLessThan(ROUNDED);
      }
    });
  });

  it("crossfades a change of spoke count over 150 ms and draws the new spokes at once", async () => {
    const { host, rerender } = renderThemed(<Chart a={[4, 2, 3, 1]} intro="none" />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    rerender(<Chart a={[4, 2, 3, 1, 2]} intro="none" />);
    const [line] = radarLayers(host, "radar-chart-line");
    // DOM audit: the old drawing fades out as a copy marked data-outgoing, beside the live group.
    const outgoing = line?.querySelector("[data-outgoing]");
    const fades = [outgoing, outgoing?.parentElement?.previousElementSibling].map((element) =>
      Number(element?.getAnimations()[0]?.effect?.getComputedTiming().duration)
    );
    expect(fades).toEqual([150, 150]);
    expect(pathPoints(layerPath(outgoing ?? undefined, "solid").getAttribute("d") ?? "")).toHaveLength(4);
    const drawn = radii(host)[0] ?? [];
    expect(drawn).toHaveLength(5);
    [1, 0.5, 0.75, 0.25, 0.5].forEach((radius, spoke) => {
      expect(Math.abs((drawn[spoke] ?? 0) - radius)).toBeLessThan(ROUNDED);
    });
  });
});

describe("the radar's followers (SPEC's Motion table)", () => {
  it("keeps the active dot on its series' vertex in every frame as an update moves the polygon", async () => {
    const { host, rerender } = renderThemed(
      <Chart a={[4, 4, 4, 4]} intro="none">
        <RadarChart.ActiveDot dataKey="a" />
      </Chart>
    );
    await userEvent.tab();
    for (const animation of host.getAnimations({ subtree: true })) animation.finish();
    rerender(
      <Chart a={[2, 4, 4, 4]} intro="none">
        <RadarChart.ActiveDot dataKey="a" />
      </Chart>
    );
    const [dot] = radarLayers(host, "radar-chart-active-dot");
    const [line] = radarLayers(host, "radar-chart-line");
    const seen: { readonly dot: number; readonly vertex: number }[] = [];
    const start = performance.now();
    while (performance.now() - start < 700) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const [point] = pathPoints(layerPath(dot, "dots").getAttribute("d") ?? "");
      const [vertex] = pathPoints(layerPath(line, "solid").getAttribute("d") ?? "");
      if (point !== undefined && vertex !== undefined)
        seen.push({ dot: Math.hypot(point.x, point.y), vertex: Math.hypot(vertex.x, vertex.y) });
    }
    // Spoke 0's radius moves from 1 to 0.5, and the dot reads the same radius in every frame.
    expect(seen.some(({ vertex }) => vertex > 0.55 && vertex < 0.95)).toBe(true);
    for (const frame of seen) expect(Math.abs(frame.dot - frame.vertex)).toBeLessThan(ROUNDED);
  });

  it("rides the active dot along the polygon's edges through each vertex between, on the follow spring", async () => {
    const { host } = renderThemed(
      <Chart a={[4, 2, 3, 1]} intro="none">
        <RadarChart.ActiveDot dataKey="a" />
      </Chart>
    );
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    for (const animation of host.getAnimations({ subtree: true })) animation.finish();
    await userEvent.keyboard("{End}");
    const [dot] = radarLayers(host, "radar-chart-active-dot");
    // DOM audit: the dot rides in its follow group, read by data-follow.
    const group = dot?.querySelector("[data-follow]");
    const ride = group?.getAnimations()[0];
    const frames = ride?.effect instanceof KeyframeEffect ? ride.effect.getKeyframes() : [];
    // From spoke 1 at (0.5, 0) through spoke 2 at (0, 0.75) to spoke 3 at (−0.25, 0), the short way.
    const scale = (dot?.getBoundingClientRect().width ?? 0) / 2;
    const offsets = frames.map((frame) =>
      String(frame.translate)
        .split(" ")
        .map((part) => Number.parseFloat(part) / scale)
    );
    expect(offsets.map(([x = 0, y = 0]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100])).toEqual([
      [0.75, 0],
      [0.25, 0.75],
      [0, 0],
    ]);
    const duration = Number(ride?.effect?.getComputedTiming().duration);
    expect(duration).toBeGreaterThan(400);
    expect(duration).toBeLessThanOrEqual(507);
  });

  it("turns the hand to the active spoke the short way round on 420/42", async () => {
    const { host } = renderThemed(<Chart a={[4, 2, 3, 1]} intro="none" />);
    await userEvent.tab();
    // DOM audit: the hand is the grid's spoke whose part is "hand".
    const hand = host.querySelector<SVGLineElement>('[data-slot="radar-chart-spoke"][data-part="hand"]');
    await userEvent.keyboard("{ArrowLeft}");
    const turn = hand?.getAnimations()[0];
    const frames = turn?.effect instanceof KeyframeEffect ? turn.effect.getKeyframes() : [];
    // Spoke 0 to spoke 3 is a quarter turn back, not three quarters forward.
    expect(frames.map((frame) => frame.rotate)).toEqual(["0deg", "-90deg"]);
    const duration = Number(turn?.effect?.getComputedTiming().duration);
    expect(duration).toBeGreaterThan(400);
    expect(duration).toBeLessThanOrEqual(483);
  });
});
