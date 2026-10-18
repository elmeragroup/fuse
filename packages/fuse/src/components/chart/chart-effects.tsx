"use client";

import type { ReactElement, ReactNode } from "react";

import type { ChartLayerProps } from "./chart-types";

/**
 * Props for `Chart.Glow`, a closed part.
 *
 * @beta
 */
export type ChartGlowProps = ChartLayerProps & {
  /** The marks to glow. */
  children?: ReactNode;
};

/**
 * Props for `Chart.Reveal`, a closed part.
 *
 * @beta
 */
export type ChartRevealProps = ChartLayerProps & {
  /** The marks to reveal. */
  children?: ReactNode;
};

/**
 * Wraps marks and glows their drawn layer, so the glow follows the mark's curve, group slot and
 * shape.
 *
 * @beta
 */
export function ChartGlow(_props: ChartGlowProps): ReactElement {
  return <></>;
}

/**
 * Wraps marks and shows them only up to the active slot, as a hover trace.
 *
 * @beta
 */
export function ChartReveal(_props: ChartRevealProps): ReactElement {
  return <></>;
}

Object.assign(ChartGlow, { displayName: "Chart.Glow" });
Object.assign(ChartReveal, { displayName: "Chart.Reveal" });
