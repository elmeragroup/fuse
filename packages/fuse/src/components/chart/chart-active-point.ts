"use client";

/**
 * The active point every readout part reads: the one owner of the live scope, the store
 * subscription, the window rule and the point a closing tooltip holds. A point is an index and the
 * series nearest the pointer or focused there, and a closing tooltip holds both together, so its
 * content keeps the slot and the series it showed until the popup has closed. The module reads only
 * the scope contexts and the store, so the light model paths that import it ship no readout code.
 */
import { use } from "react";

import { ChartHeldPointContext, ChartLiveContext } from "./chart-scope-contexts";
import type { HeldPoint } from "./chart-scope-contexts";
import { useChartStore } from "./chart-store";
import type { ChartStore } from "./chart-store";
import type { SlotWindow } from "./layout/slot-window";

/** Where a part reads its active point: the Root's store and its effective window. */
export type ActiveSource = { readonly store: ChartStore; readonly window: SlotWindow | null };

/** An active point: its index inside the window and its near or focused series, each or both null. */
export type ActivePoint = { readonly index: number | null; readonly near: number | null };

/** The index when it lies inside the window, else null. */
function inWindow(index: number | null, window: SlotWindow | null): number | null {
  return index !== null && window !== null && index >= window.first && index <= window.last ? index : null;
}

/** Whether a part follows the store, and the point a closing tooltip holds for it, or null. */
type Following = { readonly follow: boolean; readonly held: HeldPoint | null };

/** A part's `Following`, from its own `live` or its scope. */
function useFollow(live: boolean | undefined): Following {
  const scoped = use(ChartLiveContext);
  const held = use(ChartHeldPointContext);
  const follow = live ?? scoped;
  return { follow, held: follow ? held : null };
}

/**
 * The active index inside the window, or null, for a part that prints no series key. It never
 * renders when the pointer moves between series inside one slot. Outside a live scope it reads null
 * and never renders on a pointer move. Inside a closing tooltip it reads the index the popup held.
 *
 * @param source - The Root's store and window.
 * @param live - Whether to follow the store, which forces it on for parts such as LegendValue.
 * @returns The active index.
 */
export function useActiveIndex(source: ActiveSource, live?: boolean): number | null {
  const { follow, held } = useFollow(live);
  const active = useChartStore(source.store, (snapshot) => (follow ? snapshot.active : null));
  return inWindow(active ?? held?.index ?? null, source.window);
}

/**
 * The active index inside the window and its near or focused series, for a part that prints the
 * active point's key. Outside a live scope both read null. Inside a closing tooltip both read the
 * point the popup held, together.
 *
 * @param source - The Root's store and window.
 * @param live - Whether to follow the store.
 * @returns The active point.
 */
export function useActivePoint(source: ActiveSource, live?: boolean): ActivePoint {
  const { follow, held } = useFollow(live);
  const active = useChartStore(source.store, (snapshot) => (follow ? snapshot.active : null));
  const near = useChartStore(source.store, (snapshot) => (follow ? snapshot.near : null));
  if (active === null && held !== null)
    return { index: inWindow(held.index, source.window), near: held.near };
  return { index: inWindow(active, source.window), near };
}
