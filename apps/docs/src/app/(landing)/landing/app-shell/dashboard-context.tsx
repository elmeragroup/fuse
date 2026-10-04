"use client";

import { createContext, use } from "react";
import type { RefCallback } from "react";

import type { OrderId } from "./dashboard-orders";
import type { DashboardAction, DashboardState } from "./dashboard-state";

/** The actions that fetch a new list. Revealing an order goes through `openOrder` instead. */
export type Navigation = Extract<DashboardAction, { _tag: "Open" | "Scope" }>;

/** A toast the window raises inside its own viewport. */
export type Notice = {
  readonly title: string;
  readonly description: string;
  readonly type: "success" | "error" | "info";
};

/**
 * An order a reveal asked for. Each reveal is a new request, so asking for the same order again
 * turns Order search's page again.
 */
export type Reveal = { readonly id: OrderId };

/** What every part of the window reads and calls; the window component owns it. */
export type DashboardApi = {
  readonly state: DashboardState;
  readonly dispatch: (action: DashboardAction) => void;
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
  /**
   * The pending reveal, which Order search turns its page to. It ends once its row has scrolled
   * into view, or on any other navigation.
   */
  readonly revealing: Reveal | undefined;
  /** The ref for the pending reveal's row: scrolls the row into view and ends the reveal. */
  readonly revealed: RefCallback<HTMLElement>;
  readonly openPalette: () => void;
  readonly openNewOrder: () => void;
  readonly toggleSidebar: () => void;
  /** Whether the detail pane sits beside the list rather than in a Sheet. */
  readonly splitView: boolean;
};

/** The window's API, provided by `DashboardApp`. */
export const DashboardContext = createContext<DashboardApi | undefined>(undefined);

/**
 * @returns The window's state and actions.
 * @throws Outside `DashboardApp`, a wiring defect.
 */
export function useDashboard(): DashboardApi {
  const api = use(DashboardContext);
  if (api === undefined) {
    throw new Error("useDashboard must be used within DashboardApp");
  }
  return api;
}
