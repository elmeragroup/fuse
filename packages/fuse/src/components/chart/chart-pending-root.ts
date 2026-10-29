"use client";

import { createContext } from "react";

/**
 * True inside a Root whose family has no readout yet, such as the polar Roots before their layers
 * land. The shared parts render nothing there, and every other child renders as written. It lives
 * apart from the cartesian context, so a polar Root imports no cartesian module.
 */
export const ChartPendingRootContext = createContext(false);
