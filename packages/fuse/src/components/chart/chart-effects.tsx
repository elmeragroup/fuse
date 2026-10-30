"use client";

import { useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import { useChartRoot } from "./chart-context";
import { useChartFollower } from "./chart-followers";
import { useChartFrame } from "./chart-plot";
import type { ChartLayerProps } from "./chart-types";
import { pointAlong, slotCentreAt } from "./layout/plot-frame";

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
 * shape. Each bar series casts a halo of its own colour at half alpha, after evilcharts' glowing
 * bars, and each line or area series one at full alpha, after evilcharts' glowing line.
 *
 * @beta
 */
export function ChartGlow({ className, style, children }: ChartGlowProps): ReactElement {
  return (
    <div data-slot="chart-glow" aria-hidden="true" className={className} style={style}>
      {children}
    </div>
  );
}

/**
 * Wraps lines, areas and dots and shows them at full strength up to the active slot, as a hover
 * trace. Past the active slot they draw at `--chart-hover-dim`, in their own colour, so forced
 * colours and colour-vision deficiency keep each series apart. With no slot active they draw
 * whole. Root writes the active slot's place on the wrapper at pointer rate, so a pointer move
 * renders nothing in React.
 *
 * @beta
 */
export function ChartReveal({ className, style, children }: ChartRevealProps): ReactElement {
  const context = useChartRoot("Chart.Reveal");
  const drawn = useChartFrame("Chart.Reveal");
  const node = useRef<HTMLDivElement>(null);
  useChartFollower("Chart.Reveal", (active) => {
    const element = node.current;
    const window = context.model.window;
    if (element === null) return;
    if (active === null || drawn === null || window === null) {
      element.style.removeProperty("--chart-active-x");
      return;
    }
    const { frame } = drawn;
    const at = pointAlong(
      frame,
      slotCentreAt(frame, active.slot - window.first, context.xScale),
      context.xScale
    );
    element.style.setProperty("--chart-active-x", `${String(at)}px`);
  });
  return (
    <div
      ref={node}
      data-slot="chart-reveal"
      data-follow=""
      aria-hidden="true"
      className={className}
      style={style}>
      {children}
    </div>
  );
}

Object.assign(ChartGlow, { displayName: "Chart.Glow" });
Object.assign(ChartReveal, { displayName: "Chart.Reveal" });
