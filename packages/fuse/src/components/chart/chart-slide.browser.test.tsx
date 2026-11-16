// The slide duration of issue #515 in Chromium. Unit under test: Chart's data update motion, from a
// `data` that moves the window by one slot to the frames Root's loop draws the line in. Oracle: the
// stated gap between the two updates, which the slide runs for when it is shorter than the update's
// 480 ms, written by hand, and 480 ms otherwise, as for an update that keeps the window's slots. The
// bars of a second series run for the same time, so the chart rests when both do. The page's frames
// and clock are fake, so the loop's own seam, requestAnimationFrame and performance.now, runs frame
// by frame at 16 ms on every machine. Each gap advances the clock asynchronously. The microtasks a
// commit queues, among them the one that ends its cached instant, then run before the next commit
// reads the clock, as they do between two tasks of a real feed.
import { beforeEach, describe, expect, it, vi } from "vitest";

import "../../../dist/styles.css";
import { useFakeFrames } from "../../../test/animation-frames";
import { bars, linePath } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

const FRAME_MS = 16;

const VALUES = [3, 5, 4, 6, 2, 7, 5, 8, 4, 6] as const;

// Two configs that differ only in the line's color, so swapping them changes no `data`.
const CONFIGS = {
  "chart-1": {
    kw: { label: "Effekt", color: "chart-1" },
    kwh: { label: "Forbruk", color: "chart-2" },
  },
  "chart-3": {
    kw: { label: "Effekt", color: "chart-3" },
    kwh: { label: "Forbruk", color: "chart-2" },
  },
} as const;

type Row = { readonly slot: string; readonly kw: number; readonly kwh: number };

// Each window is built once, so a rerender of the same window passes the same `data`.
const windows = new Map<string, readonly Row[]>();

/**
 * A window of `slots` categories starting at a reading, so each next window of the same length
 * slides by one slot, with every value raised by `lift`.
 */
function windowAt(start: number, lift: number, slots: number): readonly Row[] {
  const name = `${start}:${lift}:${slots}`;
  const built =
    windows.get(name) ??
    Array.from({ length: slots }, (_, index) => ({
      slot: `R${start + index}`,
      kw: (VALUES[start + index] ?? 0) + lift,
      kwh: (VALUES[start + index] ?? 0) / 2 + lift,
    }));
  windows.set(name, built);
  return built;
}

/** One render of the feed: the window it shows, the marks that draw it and the line's color. */
type FeedProps = {
  readonly start: number;
  readonly lift?: number;
  readonly slots?: number;
  readonly marks?: "line and bars" | "line";
  readonly color?: keyof typeof CONFIGS;
};

function Feed({ start, lift = 0, slots = 6, marks = "line and bars", color = "chart-1" }: FeedProps) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 640 }}>
        <Chart.Root
          data={windowAt(start, lift, slots)}
          config={CONFIGS[color]}
          xKey="slot"
          // A domain that holds still keeps a slide from relaying the plot as a bar mounts.
          yInclude={[20]}
          data-intro="none"
          style={{ "--chart-plot-height": "200px" }}
          aria-label="Effekt">
          <Chart.Line dataKey="kw" curve="linear" />
          {marks === "line and bars" ? <Chart.Bar dataKey="kwh" /> : null}
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

/** What a frame draws: the line's path and every bar's corners. */
function drawn(host: HTMLElement): string {
  return [linePath(host), ...bars(host).map((bar) => bar.getAttribute("points"))].join(" ");
}

/**
 * How long the last of `updates` runs: the time from its commit to the first frame that draws the
 * line and the bars at rest. The chart mounts on `first`, and each update renders its feeds the
 * stated milliseconds after the one before it, every feed of one update in the same task, as
 * successive `flushSync` commits.
 */
async function lastRuns(
  first: FeedProps,
  updates: readonly { readonly after: number; readonly feeds: readonly FeedProps[] }[]
): Promise<number> {
  const { host, rerender } = renderThemed(<Feed {...first} />);
  await expect.poll(() => linePath(host)).not.toBe("");
  for (const { after, feeds } of updates) {
    await vi.advanceTimersByTimeAsync(after);
    for (const feed of feeds) rerender(<Feed {...feed} />);
  }
  const frames: string[] = [];
  for (let frame = 0; frame < 40; frame += 1) {
    await vi.advanceTimersByTimeAsync(FRAME_MS);
    frames.push(drawn(host));
  }
  const rest = frames.at(-1);
  return (frames.findIndex((frame) => frame === rest) + 1) * FRAME_MS;
}

/** How long a slide runs when it follows another slide by `gap` milliseconds. */
function slideAfter(gap: number): Promise<number> {
  return lastRuns({ start: 0 }, [
    { after: 0, feeds: [{ start: 1 }] },
    { after: gap, feeds: [{ start: 2 }] },
  ]);
}

describe("a data update after a slide", () => {
  beforeEach(useFakeFrames);

  it("runs for the time since the previous update when that is shorter than 480 ms", async () => {
    expect(await slideAfter(240)).toBe(240);
  });

  it("runs 480 ms when the previous update came longer ago", async () => {
    expect(await slideAfter(640)).toBe(480);
  });

  it("leaves an update that keeps the window's slots at 480 ms, however soon it follows", async () => {
    // The last update keeps the slide's slots and raises every value.
    const runs = await lastRuns({ start: 0 }, [
      { after: 0, feeds: [{ start: 1 }] },
      { after: 240, feeds: [{ start: 1, lift: 2 }] },
    ]);
    expect(runs).toBe(480);
  });

  it("runs for the time since an update that moved no mark, as a line's crossfade", async () => {
    // Dropping the window's last slot keeps its first, so the line crossfades and moves no mark.
    const runs = await lastRuns({ start: 0, marks: "line" }, [
      { after: 0, feeds: [{ start: 1, marks: "line" }] },
      { after: 640, feeds: [{ start: 1, slots: 5, marks: "line" }] },
      { after: 160, feeds: [{ start: 2, slots: 5, marks: "line" }] },
    ]);
    expect(runs).toBe(160);
  });

  it("runs 480 ms when only a config change came since the last data longer ago", async () => {
    const runs = await lastRuns({ start: 0 }, [
      { after: 0, feeds: [{ start: 1 }] },
      { after: 640, feeds: [{ start: 1, color: "chart-3" }] },
      { after: 160, feeds: [{ start: 2, color: "chart-3" }] },
    ]);
    expect(runs).toBe(480);
  });

  it("lands in the next frame when it follows another data update in the same task", async () => {
    // The first update keeps the window's slots, so it runs 480 ms, and the slide it is cut by
    // follows it by no time at all.
    const runs = await lastRuns({ start: 0 }, [
      {
        after: 640,
        feeds: [
          { start: 0, lift: 2 },
          { start: 1, lift: 2 },
        ],
      },
    ]);
    expect(runs).toBe(FRAME_MS);
  });
});
