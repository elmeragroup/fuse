"use client";

/**
 * What a live line Root shares with its parts: the words, the clock, the active reading and the
 * measured plot, and the hooks a part reads the shown feed and draws a frame through. The readings
 * reach parts only through the clock, so every part names what the plot shows. The root context
 * changes with the props, never with the clock or the pointer, so a frame renders
 * nothing in React: each part writes it to the DOM itself.
 */
import { use, useLayoutEffect, useRef, useSyncExternalStore } from "react";

import { useDrawGateOpen } from "./chart-draw-gate";
import type { DrawGate } from "./chart-draw-gate";
import type { ChartPlot } from "./chart-plot-measure";
import { LiveLinePlotContext, LiveLineRootContext } from "./chart-scope-contexts";
import { ChartCompositionError } from "./layout/errors";
import type { LiveClock, LiveFeed, LiveFrame } from "./layout/live-clock";
import type { LiveGeometry } from "./layout/live-window";
import type { LiveText } from "./live-line-chart-text";

/** The reading the readout shows, by its instant, and what made it active. */
export type LiveActive = { readonly time: number; readonly source: "pointer" | "keyboard" };

/** The pointer and keyboard state of a live line Root. */
export type LiveStore = {
  /** The active reading, or null. */
  readonly active: () => LiveActive | null;
  readonly subscribe: (listener: () => void) => () => void;
  /** Show a reading, or none. */
  readonly activate: (active: LiveActive | null) => void;
  /** Where the pointer rests across the plot, 0 to 1, or null while it is away. */
  readonly pointer: () => number | null;
  /** Record where the pointer rests, or null when it leaves. Either ends a dismissal. */
  readonly point: (share: number | null) => void;
  /**
   * Whether Escape dismissed the readout, which a pointer resting on the plot does not undo: only a
   * pointer that moves or leaves, or a key step, ends it.
   */
  readonly dismissed: () => boolean;
  /** Let go of the active reading until the pointer moves or leaves, or a key steps. */
  readonly dismiss: () => void;
};

/**
 * Create a Root's store.
 *
 * @returns The store, with no reading active and no pointer.
 */
export function createLiveStore(): LiveStore {
  let active: LiveActive | null = null;
  let pointer: number | null = null;
  let dismissed = false;
  const listeners = new Set<() => void>();
  const activate = (next: LiveActive | null): void => {
    if (next !== null) dismissed = false;
    if (next?.time === active?.time && next?.source === active?.source) return;
    active = next;
    for (const listener of listeners) listener();
  };
  return {
    active: () => active,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    activate,
    pointer: () => pointer,
    point(share) {
      pointer = share;
      dismissed = false;
    },
    dismissed: () => dismissed,
    dismiss() {
      activate(null);
      dismissed = true;
    },
  };
}

/** What every live line part reads from Root. */
export type LiveLineRootContextValue = {
  readonly text: LiveText;
  readonly clock: LiveClock;
  readonly store: LiveStore;
  /** The id prefix every generated id of this Root starts with. */
  readonly id: string;
  /** Root's `aria-label`, or undefined when `aria-labelledby` names the chart. */
  readonly name: string | undefined;
  readonly drawing: DrawGate;
  /** Whether the reader asks for reduced motion, under which no part glides. */
  readonly reduced: boolean;
  /** Say a message through Root's status region, such as the table's page. */
  readonly announce: (text: string) => void;
};

/**
 * Read the enclosing live line Root.
 *
 * @param part - The calling part's display name, which the error names.
 * @returns The Root's context.
 * @throws {ChartCompositionError} `part-outside-root` when no `LiveLineChart.Root` encloses the part.
 */
export function useLiveRoot(part: string): LiveLineRootContextValue {
  const value = use(LiveLineRootContext);
  if (value === null) {
    throw new ChartCompositionError(part, "part-outside-root", "must be used within LiveLineChart.Root.");
  }
  return value;
}

/**
 * Root's measured plot once Root opens its draw gate. The server and a hydrating part read the gate
 * closed, so their HTML matches.
 *
 * @param context - The Root.
 * @returns The plot, or null before it is measured and while the part hydrates.
 */
export function useLivePlot(context: LiveLineRootContextValue): ChartPlot | null {
  const open = useDrawGateOpen(context.drawing);
  const measured = use(LiveLinePlotContext);
  return open ? measured : null;
}

/** A frame in the plot's pixels. */
function geometryOf(frame: LiveFrame, plot: ChartPlot): LiveGeometry {
  return { width: plot.box.width, height: plot.box.height, window: frame.window, domain: frame.domain };
}

/**
 * Draw every frame of the clock into the plot: in every commit of the part once the plot is
 * measured, then on each frame the clock shows, in the order the parts mounted. The drawing writes
 * the DOM directly, so a frame renders nothing in React. A frame carries the readings it was
 * composed from, so a part reads its span from the frame, never from a newer render.
 *
 * @param context - The Root.
 * @param plot - The measured plot, or null, which draws nothing.
 * @param draw - Writes one frame. The latest one the part rendered runs.
 */
export function useLiveFrame(
  context: LiveLineRootContextValue,
  plot: ChartPlot | null,
  draw: (frame: LiveFrame, geometry: LiveGeometry) => void
): void {
  const latest = useRef(draw);
  const { clock } = context;
  useLayoutEffect(() => {
    latest.current = draw;
    if (plot === null) return;
    const frame = clock.get();
    draw(frame, geometryOf(frame, plot));
  });
  useLayoutEffect(() => {
    if (plot === null) return undefined;
    return clock.subscribe(() => {
      const frame = clock.get();
      latest.current(frame, geometryOf(frame, plot));
    });
  }, [clock, plot]);
}

/**
 * The feed the plot shows, as a part renders it: Root's latest feed once the clock takes it, and
 * the feed it held while paused. Every readout that names a reading, its value or the latest value
 * reads it, so the words never name a reading the plot doesn't show. It changes only when the
 * clock takes a feed, never as the window scrolls.
 *
 * @param context - The Root.
 * @returns The shown feed.
 */
export function useShownFeed(context: LiveLineRootContextValue): LiveFeed {
  const { clock } = context;
  const shown = () => clock.get().feed;
  return useSyncExternalStore(clock.subscribe, shown, shown);
}

/**
 * The active reading, as a part renders it. It changes only when another reading becomes active,
 * never as the window scrolls.
 *
 * @param context - The Root.
 * @returns The active reading, or null.
 */
export function useLiveActive(context: LiveLineRootContextValue): LiveActive | null {
  const { store } = context;
  return useSyncExternalStore(store.subscribe, store.active, noActive);
}

function noActive(): null {
  return null;
}
