"use client";

/**
 * The marker a clock ValueLabel sits beside, in a light leaf of its own, so every Root's own scope
 * resets it without importing the clock's placement or geometry.
 */
import { createContext } from "react";

import type { ClockSeries } from "./chart-polar-context";

/**
 * The marker a clock ValueLabel sits beside: its series and the slots it marks. A Marker sets it for
 * its children, and every Root's own scope resets it, so a nested Root's ValueLabel never reads an
 * outer chart's Marker.
 */
export const ClockMarkerContext = createContext<{
  readonly series: ClockSeries;
  readonly slots: readonly number[];
} | null>(null);
