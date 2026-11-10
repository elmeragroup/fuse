"use client";

/**
 * The way from a chart's active part to its open tooltip (CONTRACT section 9.5). While the popup
 * shows, the tooltip shares the test its anchor gives, so the plot keeps the active part for a
 * pointer that heads for the popup: over the parts it crosses on the way, and across the gap between
 * the plot and the popup, where no plot event reaches it.
 */
import type { ClientPoint } from "./chart-readout-port";
import type { ChartStore } from "./chart-store";

/** Whether a pointer that moved from one point to another heads for the open popup. */
export type Corridor = (from: ClientPoint, to: ClientPoint) => boolean;

const corridors = new WeakMap<ChartStore, Corridor>();

/**
 * Share the open popup's corridor on a Root's store, or take it away as the popup closes.
 *
 * @param store - The Root's store.
 * @param corridor - The corridor, or null.
 */
export function shareCorridor(store: ChartStore, corridor: Corridor | null): void {
  if (corridor === null) corridors.delete(store);
  else corridors.set(store, corridor);
}

/**
 * The open popup's corridor on a Root's store.
 *
 * @param store - The Root's store.
 * @returns The corridor, or undefined while no popup shows.
 */
export function corridorOf(store: ChartStore): Corridor | undefined {
  return corridors.get(store);
}
