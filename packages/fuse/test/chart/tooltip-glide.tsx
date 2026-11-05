/**
 * The fixtures and frame readers the chart tooltip's glide suites share. The oracle for "covers no
 * mark" is the drawn marks themselves, read from the DOM: each bar's and active dot's client box,
 * and points the browser samples along each line's own path, with its stroke's width.
 */
import type { ReactNode } from "react";

import { Chart } from "../../src/components/chart/chart-namespace";
import { LocaleProvider } from "../../src/intl/locale-context";
import { label, pointerAt, popup, surfaceBox } from "./marks";

/** bklit's months. */
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

/** bklit's revenue per month. */
export const REVENUE = [12000, 15500, 11000, 18800, 16800, 21200];

/** bklit's profit per month. */
const PROFIT = [4500, 5200, 3800, 7100, 5400, 8800];

/** Thirty days of two series that cross, rise to the plot top and fall away. */
export const DAYS = Array.from({ length: 30 }, (_, index) => ({
  day: `d${String(index)}`,
  a: Math.round(50 + 30 * Math.sin(index / 3)),
  b: Math.round(40 + 20 * Math.cos(index / 4)),
}));

/** A chart 160 px under the top of a 640 px column, after a button that Tab leaves from. */
function stage(chart: ReactNode): ReactNode {
  return (
    <div style={{ padding: "160px 24px 24px", width: 640, boxSizing: "border-box" }}>
      {/* A stop before the chart, so Tab enters the chart as a keyboard reader does. */}
      <button type="button">Before</button>
      <LocaleProvider locale="en-US">{chart}</LocaleProvider>
    </div>
  );
}

/** bklit's revenue and profit as grouped bars. */
export function barChart(): ReactNode {
  return stage(
    <Chart.Root
      data={MONTHS.map((month, index) => ({ month, revenue: REVENUE[index], profit: PROFIT[index] }))}
      config={{
        revenue: { label: "Revenue", color: "chart-1" },
        profit: { label: "Profit", color: "chart-2" },
      }}
      xKey="month"
      data-intro="none"
      aria-label="Revenue and profit">
      <Chart.YAxis />
      <Chart.BarGroup series={["revenue", "profit"]}>
        <Chart.Bar dataKey="revenue" />
        <Chart.Bar dataKey="profit" />
      </Chart.BarGroup>
      <Chart.Tooltip />
    </Chart.Root>
  );
}

/** Four columns, each band wider than the popup, so a step lands the popup past its own width. */
export const WIDE = ["k0", "k1", "k2", "k3"];

/** The four wide columns at 2, 4, 1 and 3. */
export function wideChart(): ReactNode {
  return stage(
    <Chart.Root
      data={WIDE.map((name, index) => ({ name, v: [2, 4, 1, 3][index] }))}
      config={{ v: { label: "V", color: "chart-1" } }}
      xKey="name"
      data-intro="none"
      aria-label="Wide columns">
      <Chart.Bar dataKey="v" />
      <Chart.Tooltip />
    </Chart.Root>
  );
}

/** Thirty days of two lines with their active dots. */
export function lineChart(): ReactNode {
  return stage(
    <Chart.Root
      data={DAYS}
      config={{ a: { label: "Alpha", color: "chart-1" }, b: { label: "Beta", color: "chart-2" } }}
      xKey="day"
      xScale="point"
      data-intro="none"
      aria-label="Two lines">
      <Chart.YAxis />
      <Chart.Line dataKey="a" />
      <Chart.Line dataKey="b" />
      <Chart.ActiveDot dataKey="a" />
      <Chart.ActiveDot dataKey="b" />
      <Chart.Tooltip />
    </Chart.Root>
  );
}

/** The popup's positioner, which carries Base UI's place. */
export function positioner(): HTMLElement | null {
  // DOM audit: the positioner wraps the popup and carries Base UI's transform.
  return document.querySelector<HTMLElement>('[data-slot="chart-tooltip-positioner"]');
}

/** Whether Base UI has placed the popup for its current open. Until then it hides it. */
function placed(): boolean {
  const element = positioner();
  return popup() !== null && element !== null && element.style.opacity !== "0";
}

/**
 * The pointer onto a slot's centre, by default 3 px above the plot's bottom, under every mark's
 * top, or at a share of the plot's height from its top.
 */
export async function hoverSlot(
  host: HTMLElement,
  slot: number,
  count: number,
  scale: "band" | "point",
  depth?: number
) {
  const box = surfaceBox(host);
  const x =
    scale === "band"
      ? box.left + (box.width * (slot + 0.5)) / count
      : box.left + Math.min(box.width - 1, Math.max(1, (box.width * slot) / (count - 1)));
  const y = depth === undefined ? box.bottom - 3 : box.top + box.height * depth;
  await pointerAt(x, y);
}

/**
 * Dispatch a pointer move onto the plot surface at once, as the chart's own events, without
 * waiting on the browser's input: at a share of the plot's length along the slot axis, `nudge` px
 * past it, and, as `hoverSlot` places it, 3 px inside the plot's far edge across, or at a share of
 * the plot's breadth from its start.
 *
 * @param host - The rendered chart's host.
 * @param share - Where along the slot axis, as a share of the plot from its start.
 * @param nudge - Pixels past that place along the slot axis.
 * @param across - The slot axis, `x` unless the chart lies on its side, and the place across it.
 */
export function dispatchSlotMove(
  host: HTMLElement,
  share: number,
  nudge = 0,
  across: { readonly axis?: "x" | "y"; readonly depth?: number } = {}
): void {
  // DOM audit: the plot's listbox is its one pointer target.
  const surface = host.querySelector('[role="listbox"]');
  if (surface === null) throw new Error("no plot");
  const box = surface.getBoundingClientRect();
  const { axis = "x", depth } = across;
  const [along, breadth] =
    axis === "x"
      ? [[box.left, box.width] as const, [box.top, box.height] as const]
      : [[box.top, box.height] as const, [box.left, box.width] as const];
  const at = along[0] + along[1] * share + nudge;
  const off = depth === undefined ? breadth[0] + breadth[1] - 3 : breadth[0] + breadth[1] * depth;
  surface.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      clientX: axis === "x" ? at : off,
      clientY: axis === "x" ? off : at,
      pointerType: "mouse",
    })
  );
}

/** A box in client pixels. */
type Box = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

/** How far two boxes overlap along each axis, 0 where they do not. */
function overlap(a: Box, b: Box) {
  return {
    x: Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)),
    y: Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)),
  };
}

/**
 * The boxes of every drawn mark the popup must not cover: each bar, a square the stroke's width
 * around points 1 px apart along each line's path, and each shown active dot with its ring.
 */
function markBoxes(host: HTMLElement, lines: readonly Box[]): Box[] {
  // DOM audit: marks are aria-hidden plot output, so their slots are the only locators.
  const bars = [...host.querySelectorAll('[data-slot="chart-bar"]')].map((bar) =>
    bar.getBoundingClientRect()
  );
  const dots = [...host.querySelectorAll('[data-slot="chart-active-dot"][data-value] circle')].map((dot) => {
    const box = dot.getBoundingClientRect();
    const ring = Number.parseFloat(getComputedStyle(dot).strokeWidth) / 2;
    return { left: box.left - ring, top: box.top - ring, right: box.right + ring, bottom: box.bottom + ring };
  });
  return [...bars, ...dots, ...lines];
}

/** One shown active dot in one frame: its centre in client pixels, and whether its layer glides. */
export type DotFrame = { readonly x: number; readonly y: number; readonly gliding: boolean };

/**
 * The centre of each shown active dot, in page order, and whether a Web Animation moves its layer.
 *
 * @param host - The rendered chart's host.
 * @returns One entry per shown dot.
 */
export function dotFrame(host: HTMLElement): DotFrame[] {
  // DOM audit: active dots are aria-hidden plot output, so their slots are the only locators.
  return [...host.querySelectorAll('[data-slot="chart-active-dot"][data-value]')].flatMap((layer) => {
    const dot = layer.querySelector(':scope > [data-slot="chart-dot"]:not([data-part])');
    if (dot === null) return [];
    const box = dot.getBoundingClientRect();
    const gliding = layer.getAnimations().some((animation) => animation.playState === "running");
    return [{ x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2, gliding }];
  });
}

/** What a watch has read so far, one reading per frame, and a stop. */
export type FrameWatch<T> = { readonly frames: T[]; readonly stop: () => void };

/**
 * Read something in every animation frame, from the next one on, until stopped.
 *
 * @param read - The reader, called once per frame.
 * @returns The readings so far, one per frame, and a stop.
 */
export function everyFrame<T>(read: () => T): FrameWatch<T> {
  const frames: T[] = [];
  let running = true;
  const frame = () => {
    if (!running) return;
    frames.push(read());
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return {
    frames,
    stop: () => {
      running = false;
    },
  };
}

/**
 * Pause the glides a pointer step just started under `host`, in the task that dispatched it, and
 * read the chart at every `every` ms of their way, then once more after they finish, where the
 * marks rest. The glides are Web Animations on the document's timeline, which no frame clock
 * drives, and a loaded runner delivers fewer frames during one, so a count of frames measures the
 * runner. Their own time, set by hand, reads the same places on any runner. A step's glides start
 * together, so one time places them all.
 *
 * @param host - The rendered chart's host.
 * @param read - The reader, called at each instant.
 * @param every - Milliseconds between instants.
 * @returns The readings, from the glides' start to their rest.
 */
export function sweepGlides<T>(host: HTMLElement, read: () => T, every = 1): T[] {
  const glides = host.getAnimations({ subtree: true }).filter(({ playState }) => playState === "running");
  if (glides.length === 0) throw new Error("no glide");
  for (const glide of glides) glide.pause();
  const end = Math.max(...glides.map((glide) => Number(glide.effect?.getComputedTiming().endTime)));
  const readings: T[] = [];
  for (let time = 0; time < end; time += every) {
    for (const glide of glides) glide.currentTime = time;
    readings.push(read());
  }
  for (const glide of glides) glide.finish();
  readings.push(read());
  return readings;
}

/**
 * The places a glide shows on its way: those more than 1 px from both where it starts and where it
 * rests. A mark that moves at once shows none.
 *
 * @param places - A sweep's places, from start to rest.
 * @returns The places in between.
 */
export function onTheWay<T extends { readonly x: number; readonly y: number }>(places: readonly T[]): T[] {
  const [start, rest] = [places[0], places.at(-1)];
  if (start === undefined || rest === undefined) return [];
  const apart = (a: T, b: T) => Math.hypot(a.x - b.x, a.y - b.y) > 1;
  return places.filter((place) => apart(place, start) && apart(place, rest));
}

/**
 * Read every shown active dot in every animation frame until stopped.
 *
 * @param host - The rendered chart's host.
 * @returns The frames read so far, and a stop.
 */
export function watchDots(host: HTMLElement) {
  return everyFrame(() => dotFrame(host));
}

/**
 * Points along each drawn line and its dashed twin, as stroke-wide squares in client pixels. Lines
 * here stay still.
 */
function lineBoxes(host: HTMLElement): Box[] {
  const boxes: Box[] = [];
  // DOM audit: drawn lines are aria-hidden plot output, so their slot is the only locator.
  for (const path of host.querySelectorAll<SVGPathElement>('[data-slot="chart-line"]')) {
    const matrix = path.getScreenCTM();
    if (matrix === null) continue;
    const half = Number.parseFloat(getComputedStyle(path).strokeWidth) / 2;
    // The dashed twin draws nothing while no span of the line is dashed.
    if ((path.getAttribute("d") ?? "") === "") continue;
    const length = path.getTotalLength();
    for (let at = 0; at <= length; at += 1) {
      const { x, y } = path.getPointAtLength(at).matrixTransform(matrix);
      boxes.push({ left: x - half, top: y - half, right: x + half, bottom: y + half });
    }
  }
  return boxes;
}

/**
 * Whether a drawn line reaches more than 1.5 px into a box: whether any point on a ring 1.5 px
 * inside the box lies in a line's stroke. A line that runs past the box on both sides and reaches
 * into it crosses that ring. The browser answers for each point, at the cost of one test per point.
 */
function lineInside(host: HTMLElement, shown: DOMRect): string | null {
  const ring: [number, number][] = [];
  const [left, right, top, bottom] = [
    shown.left + 1.5,
    shown.right - 1.5,
    shown.top + 1.5,
    shown.bottom - 1.5,
  ];
  for (let x = left; x <= right; x += 1) ring.push([x, top], [x, bottom]);
  for (let y = top; y <= bottom; y += 1) ring.push([left, y], [right, y]);
  // DOM audit: lines are aria-hidden plot output, so their slots are the only locators.
  for (const path of host.querySelectorAll<SVGPathElement>('[data-slot="chart-line"]')) {
    const matrix = path.getScreenCTM()?.inverse();
    if (matrix === undefined) continue;
    for (const [x, y] of ring) {
      if (path.isPointInStroke(new DOMPoint(x, y).matrixTransform(matrix))) {
        return `line at ${String(Math.round(x))}, ${String(Math.round(y))}`;
      }
    }
  }
  return null;
}

/**
 * Watch every animation frame until stopped, and keep the frames in which the popup covers a mark
 * by more than 1 px along both axes, and the positioner's left and top edges in each frame the popup
 * shows. The popup's own box scales while it opens, and the positioner's carries only its place.
 * Lines that a data update moves are tested against the popup's ring in every frame, which stays
 * cheap enough that a tween keeps most of its frames.
 *
 * @param host - The rendered chart's host.
 * @param lines - Whether the chart's lines stay still while the watch runs, or move.
 * @returns What the frames showed, and a stop.
 */
export function watchFrames(host: HTMLElement, lines: "still" | "moving" = "still") {
  const still = lines === "still" ? lineBoxes(host) : [];
  const covered: string[] = [];
  const lefts: number[] = [];
  const tops: number[] = [];
  let running = true;
  const frame = () => {
    if (!running) return;
    const element = popup();
    if (element !== null && placed()) {
      const shown = element.getBoundingClientRect();
      const place = positioner()?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      lefts.push(place.left);
      tops.push(place.top);
      const inside = lines === "moving" ? lineInside(host, shown) : null;
      if (inside !== null) covered.push(`${label() ?? "?"}: ${JSON.stringify(shown)} over the ${inside}`);
      for (const mark of markBoxes(host, still)) {
        const { x, y } = overlap(shown, mark);
        if (x > 1 && y > 1) {
          covered.push(`${label() ?? "?"}: ${JSON.stringify(shown)} over ${JSON.stringify(mark)}`);
          break;
        }
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return {
    covered,
    lefts,
    tops,
    stop: () => {
      running = false;
    },
  };
}
