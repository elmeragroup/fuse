"use client";

import { createContext, createElement, Fragment, use } from "react";
import type { ComponentType, ReactElement } from "react";

/**
 * True inside a Root whose family has no readout yet, such as the polar Roots before their layers
 * land. The shared parts render nothing there, and every other child renders as written. It lives
 * apart from the cartesian context, so a polar Root imports no cartesian module.
 */
export const ChartPendingRootContext = createContext(false);

/**
 * Render a shared part's body, or nothing inside a Root whose family has no readout yet.
 *
 * @param props - The part's props.
 * @param Body - The part's body, which reads the cartesian Root.
 * @returns The body, or an empty fragment under a pending Root.
 */
export function usePendingOr<P extends object>(props: P, Body: ComponentType<P>): ReactElement {
  return use(ChartPendingRootContext) ? createElement(Fragment) : createElement(Body, props);
}
