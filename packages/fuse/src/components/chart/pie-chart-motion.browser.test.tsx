// PieChart's motion against SPEC's Motion table, in Chromium with motion on. Units under test:
// PieChart.Pie on its Root's loop, and the pop and dims in the stylesheet. Oracles, written by
// hand from the Motion table and D3, D5, S2 and S6: slice i sweeps its own angle from 100 + i·80 ms
// over 1000 ms; an update moves every slice over 480 ms; a leaving slice collapses over 480 ms to
// its seam, or to Other's start when it folds; the pop rides a 400/25 spring, whose damping ratio
// 25 / (2·√400) = 0.625 overshoots by e^(−π·0.625/√(1 − 0.625²)) ≈ 8.1 %; every dim fades over
// 150 ms. Time is read from each frame's own timestamp, never by counting frames.
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { outerArc, polarFigure, sectors } from "../../../test/chart/pie";
import { sweepGlides } from "../../../test/chart/tooltip-glide";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { PieChart } from "./pie-chart-namespace";

/** One frame's time since a start, in milliseconds, with each slice's outer arc and each ghost's. */
type Frame = {
  readonly t: number;
  readonly slices: readonly (readonly [number, number] | null)[];
  readonly ghosts: readonly (readonly [number, number] | null)[];
};

/** Half a frame and more either side of a scheduled time, for the frame that straddles it. */
const SLACK = 34;

/** How closely an angle reads back from a path rounded to 3 decimals of the radius, in degrees. */
const ROUNDED = 0.1;

/**
 * Record every frame from now until `until` ms have passed since `start` reads a time.
 *
 * @param host - The rendered chart's host.
 * @param start - The start time, or null until the frame that should read it.
 * @param until - How long after the start to stop.
 * @returns The frames from the start on.
 */
async function record(host: HTMLElement, start: () => number | null, until: number): Promise<Frame[]> {
  const frames: Frame[] = [];
  for (;;) {
    const now = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
    const from = start();
    if (from === null) continue;
    // DOM audit: ghosts are aria-hidden plot output the loop writes, read by their slot.
    const ghosts = [...host.querySelectorAll('[data-slot="pie-chart-ghost"]')];
    frames.push({
      t: now - from,
      slices: sectors(host).map((path) => outerArc(path.getAttribute("d") ?? "")),
      ghosts: ghosts.map((path) => outerArc(path.getAttribute("d") ?? "")),
    });
    if (now - from > until) return frames;
  }
}

const width = (arc: readonly [number, number] | null | undefined): number => (arc ? arc[1] - arc[0] : 0);

function Chart({
  data,
  intro,
  labels,
  pace,
  center = false,
}: {
  readonly data: readonly { part: string; kr: number }[];
  readonly intro?: "none";
  readonly labels?: "inside" | "outside";
  /** The figure's `--chart-intro` and `--chart-stagger`, as a consumer overrides them. */
  readonly pace?: { readonly intro: string; readonly stagger: string };
  /** Whether the centre prints the total. */
  readonly center?: boolean;
}) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 320 }}>
        <PieChart.Root
          data={data}
          config={{
            a: { label: "A", color: "chart-1" },
            b: { label: "B", color: "chart-2" },
            c: { label: "C", color: "chart-3" },
            d: { label: "D", color: "chart-4" },
            e: { label: "E", color: "chart-5" },
            f: { label: "F", color: "chart-6" },
            g: { label: "G", color: "chart-7" },
          }}
          nameKey="part"
          valueKey="kr"
          innerRadius={0.5}
          data-intro={intro}
          style={
            pace === undefined ? undefined : { "--chart-intro": pace.intro, "--chart-stagger": pace.stagger }
          }
          aria-label="Regning">
          <PieChart.Pie />
          {labels === undefined ? null : <PieChart.Labels position={labels} />}
          {center ? (
            <PieChart.Center>
              <PieChart.CenterValue />
            </PieChart.Center>
          ) : null}
        </PieChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** Shares of 100: 180°, 108°, 54° and 18°. */
const QUARTET = [
  { part: "a", kr: 50 },
  { part: "b", kr: 30 },
  { part: "c", kr: 15 },
  { part: "d", kr: 5 },
];

describe("the pie's motion (SPEC's Motion table)", () => {
  it("sweeps each slice in its own angle from 100 + i·80 ms over 1000 ms, once in view", async () => {
    const { host } = renderThemed(<Chart data={QUARTET} />);
    const figure = polarFigure(host);
    let from: number | null = null;
    const frames = await record(
      host,
      () => {
        // The entrance starts in the frame Root writes data-drawn.
        if (from === null && figure.hasAttribute("data-drawn")) from = performance.now();
        return from;
      },
      1500
    );
    const rest = [180, 108, 54, 18];
    rest.forEach((angle, index) => {
      const begins = 100 + 80 * index;
      const ends = begins + 1000;
      const widths = frames.map((frame) => ({ t: frame.t, width: width(frame.slices[index]) }));
      expect(widths.filter(({ t }) => t < begins - SLACK).every(({ width: w }) => w === 0)).toBe(true);
      expect(
        widths.filter(({ t }) => t > ends + SLACK).every(({ width: w }) => Math.abs(w - angle) < ROUNDED)
      ).toBe(true);
      expect(widths.some(({ width: w }) => w > 0 && w < angle - 1)).toBe(true);
      // The sweep only grows.
      widths.forEach(({ width: w }, at) => {
        expect(w).toBeGreaterThanOrEqual((widths[at - 1]?.width ?? 0) - ROUNDED);
      });
    });
  });

  it("takes its pace from the figure's --chart-intro and --chart-stagger", async () => {
    // 0.6 s and 200 ms: slice i sweeps from 100 + i·200 ms over 600 ms, so d waits until 700 ms.
    const { host } = renderThemed(<Chart data={QUARTET} pace={{ intro: "0.6s", stagger: "200ms" }} />);
    const figure = polarFigure(host);
    let from: number | null = null;
    const frames = await record(
      host,
      () => {
        if (from === null && figure.hasAttribute("data-drawn")) from = performance.now();
        return from;
      },
      1500
    );
    [180, 108, 54, 18].forEach((angle, index) => {
      const begins = 100 + 200 * index;
      const widths = frames.map((frame) => ({ t: frame.t, width: width(frame.slices[index]) }));
      expect(widths.filter(({ t }) => t < begins - SLACK).every(({ width: w }) => w === 0)).toBe(true);
      expect(
        widths
          .filter(({ t }) => t > begins + 600 + SLACK)
          .every(({ width: w }) => Math.abs(w - angle) < ROUNDED)
      ).toBe(true);
    });
  });

  it.each(["inside", "outside"] as const)(
    "carries each %s label and its leader on its slice's bisector, frame by frame, as an update moves it",
    async (position) => {
      const { host, rerender } = renderThemed(<Chart data={QUARTET} intro="none" labels={position} />);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      rerender(
        <Chart
          data={[
            { part: "a", kr: 20 },
            { part: "b", kr: 30 },
            { part: "c", kr: 30 },
            { part: "d", kr: 20 },
          ]}
          intro="none"
          labels={position}
        />
      );
      // DOM audit: the labels and leaders are aria-hidden plot output, read by their slot.
      const pie = host.querySelector('[data-slot="pie-chart-pie"]');
      const label = host.querySelector<HTMLElement>('[data-slot="pie-chart-label"][data-index="0"]');
      const leader = host.querySelector('[data-slot="pie-chart-leader"][data-index="0"]');
      const bearing = (x: number, y: number): number => ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
      // Where slice a's label hangs off the dial: the label's centre inside, the leader's anchor outside.
      const hung = (): number => {
        if (position === "outside") {
          const [x = 0, y = 0] =
            (leader?.getAttribute("points") ?? "").split(" ")[0]?.split(",").map(Number) ?? [];
          return bearing(x, y);
        }
        const dial = pie?.getBoundingClientRect();
        const box = label?.getBoundingClientRect();
        if (dial === undefined || box === undefined) return Number.NaN;
        return bearing(
          box.left + box.width / 2 - (dial.left + dial.width / 2),
          box.top + box.height / 2 - (dial.top + dial.height / 2)
        );
      };
      const seen: { readonly bisector: number; readonly hung: number }[] = [];
      const start = performance.now();
      while (performance.now() - start < 700) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const arc = outerArc(sectors(host)[0]?.getAttribute("d") ?? "");
        if (arc !== null) seen.push({ bisector: (arc[0] + arc[1]) / 2, hung: hung() });
      }
      // Slice a's bisector moves from 90° to 36°, and the label rides it through the frames between.
      expect(seen.some(({ bisector }) => bisector < 89 && bisector > 37)).toBe(true);
      for (const frame of seen)
        expect(Math.abs(frame.hung - frame.bisector)).toBeLessThan(position === "inside" ? 2 : 0.5);
    }
  );

  it("counts the centre total up over the entrance, then rolls its digits on the 400/35 ticker spring", async () => {
    // The ticker's damping ratio 35 / (2·√400) = 0.875 at ω = 20 settles within 0.1 % once its
    // envelope e^(−17.5t) / √(1 − 0.875²) does, by ln 2066 / 17.5 ≈ 436.2 ms, 437 in whole milliseconds.
    const { host } = renderThemed(<Chart data={QUARTET} center />);
    const figure = polarFigure(host);
    // DOM audit: the centre's digits are reels whose slide is a CSS transition, read from its animations.
    const slide = (): { readonly duration: number; readonly delay: number } | null => {
      for (const reel of host.querySelectorAll("[data-reel]")) {
        const timing = reel
          .getAnimations()
          .find(
            (animation) => animation instanceof CSSTransition && animation.transitionProperty === "translate"
          )
          ?.effect?.getComputedTiming();
        if (timing !== undefined) return { duration: Number(timing.duration), delay: Number(timing.delay) };
      }
      return null;
    };
    await expect.poll(() => figure.hasAttribute("data-entering") && slide() !== null).toBe(true);
    expect(slide()).toEqual({ duration: 1000, delay: 100 });
    await expect.poll(() => figure.hasAttribute("data-entering"), { timeout: 3000 }).toBe(false);
    for (const animation of host.getAnimations({ subtree: true })) animation.finish();
    // The total's 100 swaps to a's 50, a text of another shape; a's 50 rolls to b's 30.
    await userEvent.tab();
    for (const animation of host.getAnimations({ subtree: true })) animation.finish();
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => slide() !== null).toBe(true);
    const roll = slide();
    expect(roll?.duration).toBeGreaterThan(300);
    expect(roll?.duration).toBeLessThanOrEqual(437);
  });

  it("moves every slice to new data over 480 ms, each edge between its old and its new angle", async () => {
    const { host, rerender } = renderThemed(<Chart data={QUARTET} intro="none" />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    rerender(
      <Chart
        data={[
          { part: "a", kr: 20 },
          { part: "b", kr: 30 },
          { part: "c", kr: 30 },
          { part: "d", kr: 20 },
        ]}
        intro="none"
      />
    );
    const from = performance.now();
    const frames = await record(host, () => from, 700);
    // Old ends 180, 288, 342 and 360, new ends 72, 180, 288 and 360.
    const ends = [
      [180, 72],
      [288, 180],
      [342, 288],
    ];
    ends.forEach(([before = 0, after = 0], index) => {
      const seen = frames.map((frame) => frame.slices[index]?.[1] ?? Number.NaN);
      expect(seen.every((end) => end <= before + ROUNDED && end >= after - ROUNDED)).toBe(true);
      expect(seen.some((end) => end < before - 1 && end > after + 1)).toBe(true);
      const settled = frames.filter(({ t }) => t > 480 + SLACK);
      expect(settled.every((frame) => Math.abs((frame.slices[index]?.[1] ?? 0) - after) < ROUNDED)).toBe(
        true
      );
    });
  });

  it("collapses a leaving slice to its own seam over 480 ms, then drops its ghost (D5)", async () => {
    const { host, rerender } = renderThemed(<Chart data={QUARTET} intro="none" />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    rerender(<Chart data={QUARTET.filter(({ part }) => part !== "c")} intro="none" />);
    const from = performance.now();
    const frames = await record(host, () => from, 700);
    // Without c the pie is 85: d starts at 80 / 85 of the turn, 338.82°, where c's ghost ends.
    const seam = (80 / 85) * 360;
    const shrinking = frames.flatMap((frame) => frame.ghosts.map((ghost) => ({ t: frame.t, ghost })));
    expect(shrinking.length).toBeGreaterThan(0);
    // The ghost starts at c's 54° and only shrinks.
    shrinking.forEach(({ ghost }, at) => {
      const before = at === 0 ? 54 : width(shrinking[at - 1]?.ghost);
      expect(width(ghost)).toBeLessThanOrEqual(before + ROUNDED);
    });
    const last = shrinking.filter(({ ghost }) => ghost !== null).at(-1)?.ghost;
    expect(Math.abs((last?.[0] ?? 0) - seam)).toBeLessThan(4);
    expect(frames.filter(({ t }) => t > 480 + SLACK).every((frame) => frame.ghosts.length === 0)).toBe(true);
  });

  it("collapses the slices that fold into Other's start while Other grows (S6)", async () => {
    const six = [
      { part: "a", kr: 30 },
      { part: "b", kr: 25 },
      { part: "c", kr: 20 },
      { part: "d", kr: 15 },
      { part: "e", kr: 6 },
      { part: "f", kr: 4 },
    ];
    const { host, rerender } = renderThemed(<Chart data={six} intro="none" />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    rerender(<Chart data={[...six, { part: "g", kr: 10 }]} intro="none" />);
    const from = performance.now();
    const frames = await record(host, () => from, 700);
    // Seven rows past the cap of 6: e and f fold into Other, 10 of 110, last from 100 / 110 of the turn.
    const other = (100 / 110) * 360;
    const ends = frames.flatMap((frame) => frame.ghosts.filter((ghost) => ghost !== null));
    expect(ends.length).toBeGreaterThan(0);
    const finals = frames
      .filter(({ t }) => t > 400)
      .flatMap((frame) => frame.ghosts.flatMap((ghost) => (ghost === null ? [] : [ghost])));
    for (const ghost of finals) expect(Math.abs(ghost[0] - other)).toBeLessThan(6);
    const grown = frames.at(-1)?.slices.at(-1);
    expect(Math.abs((grown?.[0] ?? 0) - other)).toBeLessThan(ROUNDED);
    expect(Math.abs((grown?.[1] ?? 0) - 360)).toBeLessThan(ROUNDED);
  });

  it("pops the active slice on the 400/25 spring, past its 8 px and back, and fades the dims over 150 ms", async () => {
    const { host } = renderThemed(<Chart data={QUARTET} intro="none" />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const [first, second] = sectors(host);
    const rest = first?.getBoundingClientRect().left ?? 0;
    await userEvent.tab();
    // DOM audit: the dim is a CSS transition on the slice, read from its own animations.
    const fade = second
      ?.getAnimations()
      .find((animation) => animation instanceof CSSTransition && animation.transitionProperty === "opacity");
    expect(Number(fade?.effect?.getComputedTiming().duration)).toBe(150);
    const shifts = sweepGlides(host, () => (first?.getBoundingClientRect().left ?? 0) - rest, 4);
    const peak = Math.max(...shifts);
    expect(peak).toBeGreaterThan(8 * 1.06);
    expect(peak).toBeLessThan(8 * 1.1);
    expect(shifts.at(-1)).toBeCloseTo(8, 1);
  });
});
