"use client";

import { createContext, use } from "react";

import type { OrderId } from "./funnel-orders";
import type { FunnelAction, FunnelState } from "./funnel-state";

/** The actions that fetch a new list. Revealing an order goes through `openOrder` instead. */
export type Navigation = Extract<FunnelAction, { _tag: "Open" | "Scope" }>;

/** A toast the window raises inside its own viewport. */
export type Notice = {
  readonly title: string;
  readonly description: string;
  readonly type: "success" | "error" | "info";
};

/** What every part of the window reads and calls; the window component owns it. */
export type FunnelApi = {
  readonly state: FunnelState;
  readonly dispatch: (action: FunnelAction) => void;
  /** Opens a view, tab or order behind a short simulated fetch, so the list shows it loading. */
  readonly navigate: (action: Navigation) => void;
  /** True while the simulated fetch runs. */
  readonly loading: boolean;
  /** The demo clock: the demo's fixed now plus the time since the window mounted, as ISO. */
  readonly now: () => string;
  readonly notify: (notice: Notice) => void;
  /**
   * Reveals an order wherever it was picked, from a row or the palette: selects it, opens Order
   * search behind a fetch when the current list does not show it, scrolls its row into view and,
   * where the detail is a Sheet, opens it.
   */
  readonly openOrder: (id: OrderId) => void;
  readonly openPalette: () => void;
  readonly openNewOrder: () => void;
  readonly toggleSidebar: () => void;
  /** Whether the detail pane sits beside the list rather than in a Sheet. */
  readonly splitView: boolean;
};

/** The window's API, provided by `FunnelWindow`. */
export const FunnelContext = createContext<FunnelApi | undefined>(undefined);

/**
 * @returns The window's state and actions.
 * @throws Outside `FunnelWindow`, a wiring defect.
 */
export function useFunnel(): FunnelApi {
  const api = use(FunnelContext);
  if (api === undefined) {
    throw new Error("useFunnel must be used within FunnelWindow");
  }
  return api;
}
