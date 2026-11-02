/**
 * The fixtures and frame readers the chart tooltip's glide suites share. The oracle for "covers no
 * mark" is the drawn marks themselves, read from the DOM: each bar's and active dot's client box,
 * and points the browser samples along each line's own path, with its stroke's width.
 */
import type { ReactNode } from "react";

import { userEvent } from "vitest/browser";

import { Chart } from "../../src/components/chart/chart-namespace";
import { LocaleProvider } from "../../src/intl/locale-context";

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

/** Wait for a number of animation frames. */
export async function frames(count: number): Promise<void> {
  for (let frame = 0; frame < count; frame += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

/** The plot surface's client box. */
export function surfaceBox(host: HTMLElement): DOMRect {
  return host.querySelector('[role="listbox"]')?.getBoundingClientRect() ?? new DOMRect();
}

/** The open popup. It portals out of the host, and a closed popup stays mounted, hidden. */
export function popup(): HTMLElement | null {
  // DOM audit: the popup is aria-hidden and portals out of the host, so its slot is the locator.
  return document.querySelector<HTMLElement>('[data-slot="chart-tooltip"][data-open]');
}

/** The popup's positioner, which carries Base UI's place. */
export function positioner(): HTMLElement | null {
  // DOM audit: the positioner wraps the popup and carries Base UI's transform.
  return document.querySelector<HTMLElement>('[data-slot="chart-tooltip-positioner"]');
}

/** The open popup's slot label. */
export function label(): string | null {
  return popup()?.querySelector('[data-slot="chart-tooltip-label"]')?.textContent ?? null;
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
  const target = document.elementFromPoint(x, y);
  if (!(target instanceof Element)) throw new Error(`nothing at ${String(x)}, ${String(y)}`);
  const rect = target.getBoundingClientRect();
  await userEvent.hover(target, { position: { x: x - rect.left, y: y - rect.top }, force: true });
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

/**
 * Points along each drawn line and its dashed twin, as stroke-wide squares in client pixels. Lines
 * here stay still.
 */
function lineBoxes(host: HTMLElement): Box[] {
  const boxes: Box[] = [];
  for (const path of host.querySelectorAll<SVGPathElement>('[data-slot="chart-line"]')) {
    const matrix = path.getScreenCTM();
    if (matrix === null) continue;
    const half = Number.parseFloat(getComputedStyle(path).strokeWidth) / 2;
    // The dashed twin draws nothing while no span of the line is dashed.
    if ((path.getAttribute("d") ?? "") === "") continue;
    const length = path.getTotalLength();
    for (let at = 0; at <= length; at += 1) {
      const { x, y } = new DOMPoint(path.getPointAtLength(at).x, path.getPointAtLength(at).y).matrixTransform(
        matrix
      );
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
