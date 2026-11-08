"use client";

/**
 * The marker a clock ValueLabel sits beside, in a light leaf of its own, so every Root's own scope
 * resets it without importing the clock's placement or geometry.
 */
import { createContext } from "react";

import type { ClockSeries } from "./chart-polar-context";

/**
 * A Marker's ValueLabels and whether its dots moved in the frame its writer drew last. A label
 * takes the flag as it registers and drops it as it leaves, so a label that mounts or returns
 * between frames matches its dots.
 */
export type MarkerLabels = {
  readonly nodes: Set<Element>;
  moving: boolean;
};

/**
 * The marker a clock ValueLabel sits beside: its series, the slots it marks and the labels its
 * ValueLabels register in, so its writer flags them while its dots move. A Marker sets it for
 * its children, and every Root's own scope resets it, so a nested Root's ValueLabel never reads an
 * outer chart's Marker.
 */
export const ClockMarkerContext = createContext<{
  readonly series: ClockSeries;
  readonly slots: readonly number[];
  readonly labels: MarkerLabels;
} | null>(null);
