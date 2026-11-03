"use client";

/**
 * Root's record of its x axis: the axis's `format`, which a part beside the axis such as
 * Chart.SlotLabel prints slots in, and the generation of the axis's tick nodes, which that part
 * reads boxes from. Chart.XAxis writes both in its commits, never on a pointer step, and a reader
 * renders again only when one of them changes.
 */
import { useSyncExternalStore } from "react";

import type { XFormat } from "./chart-types";

/** Root's record of its x axis. */
export type AxisRecord = {
  /** The axis's format, or undefined while no axis names one. */
  readonly format: () => XFormat | undefined;
  /** Record the axis's format, undefined when it unmounts. */
  readonly setFormat: (format: XFormat | undefined) => void;
  /** A number that changes whenever the axis's tick nodes may have changed. */
  readonly ticks: () => number;
  /** Note that the axis mounted, unmounted or rendered its ticks again. */
  readonly touchTicks: () => void;
  /** Listen for a change of either. The result stops listening. */
  readonly subscribe: (listener: () => void) => () => void;
};

/**
 * Create Root's record of its x axis.
 *
 * @returns The record, holding no format at tick generation 0.
 */
export function createAxisRecord(): AxisRecord {
  let format: XFormat | undefined;
  let ticks = 0;
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of listeners) listener();
  };
  return {
    format: () => format,
    setFormat: (next) => {
      if (next === format) return;
      format = next;
      notify();
    },
    ticks: () => ticks,
    touchTicks: () => {
      ticks += 1;
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const NO_FORMAT = (): undefined => undefined;

const NO_TICKS = (): number => 0;

/**
 * Read the x axis's format, rendering again when it changes. The server reads none.
 *
 * @param record - Root's record.
 * @returns The axis's format, or undefined.
 */
export function useAxisFormat(record: AxisRecord): XFormat | undefined {
  return useSyncExternalStore(record.subscribe, record.format, NO_FORMAT);
}

/**
 * Read the generation of the x axis's tick nodes, rendering again when it changes.
 *
 * @param record - Root's record.
 * @returns The generation.
 */
export function useAxisTicks(record: AxisRecord): number {
  return useSyncExternalStore(record.subscribe, record.ticks, NO_TICKS);
}
