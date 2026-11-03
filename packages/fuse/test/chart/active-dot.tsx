/**
 * The fixtures and readers the active dot's suites share: seven readings that dip and climb, one
 * series on a 0 to 100 domain, a pointer move onto a point slot, and a reader of where the dot and
 * the crosshair show. The dot and the crosshair are aria-hidden plot output, so their slots are the
 * only locators.
 */
import type { ChartConfig } from "../../src/components/chart/chart-types";
import { dispatchSlotMove } from "./tooltip-glide";

/** Seven readings that dip and climb, so every curve bends between them. */
export const READINGS = [70, 20, 85, 10, 60, 30, 90];

/** One series, `v`. */
export const ONE_SERIES: ChartConfig = { v: { label: "V", color: "chart-1" } };

/** A value domain from 0 to 100. */
export const PERCENT = [0, 100] as const;

/**
 * A pointer move over a point slot's centre, halfway down the plot, by `nudge` px to its right, as
 * the chart's own events.
 *
 * @param host - The rendered chart's host.
 * @param slot - The slot.
 * @param nudge - Pixels to the right of the slot's centre.
 * @param count - The slots in the plot.
 */
export function moveTo(host: HTMLElement, slot: number, nudge = 0, count = READINGS.length): void {
  dispatchSlotMove(host, slot / (count - 1), nudge, { depth: 0.5 });
}

/**
 * The active dot's layer, the first in the chart.
 *
 * @param host - The rendered chart's host.
 * @returns The layer, or null.
 */
export function dotLayer(host: HTMLElement): Element | null {
  // DOM audit: the active dot is aria-hidden plot output.
  return host.querySelector('[data-slot="chart-active-dot"]');
}

/** Where the active dot and the crosshair show in one frame. */
export type DotAndCrosshair = {
  readonly x: number;
  readonly y: number;
  readonly crosshair: number;
  readonly gliding: boolean;
};

/**
 * The dot's centre, the crosshair line's centre along x, in client pixels, and whether a Web
 * Animation moves the dot's layer.
 *
 * @param host - The rendered chart's host.
 * @returns What shows now.
 */
export function shown(host: HTMLElement): DotAndCrosshair {
  // DOM audit: the dot and the crosshair are aria-hidden plot output.
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
