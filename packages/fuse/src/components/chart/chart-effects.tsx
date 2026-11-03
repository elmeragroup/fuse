"use client";

import { useLayoutEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import { useChartRoot, usePlotLayout } from "./chart-context";
import { writeStyle } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import { useChartFrame } from "./chart-plot";
import { glideLength, snapGlide, stepSpring } from "./chart-spring";
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
 * shape. Each bar series casts a halo of its own colour at half alpha, and each line or area series
 * one at full alpha.
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

/** The series a Reveal masks, which each take the active slot's place. */
const MASKED: ReadonlySet<string> = new Set(["chart-line-series", "chart-area-series", "chart-dots"]);

/** The series a Reveal's wrapper holds that its mask dims. */
function masked(element: Element): SVGElement[] {
  return [...element.children].flatMap((series) =>
    series instanceof SVGElement && MASKED.has(series.getAttribute("data-slot") ?? "") ? [series] : []
  );
}

/**
 * Wraps lines, areas and dots and shows them at full strength up to the active slot, as a hover
 * trace. Past the active slot they draw at `--chart-hover-dim`, in their own colour, so forced
 * colours and colour-vision deficiency keep each series apart. With no slot active they draw
 * whole. Root writes the active slot's place on each series it masks, and a step glides the edge
 * there on the crosshair's spring, so it moves with the crosshair and the active dot. Showing, a
 * commit and reduced motion place it at once, and a pointer move renders nothing in React.
 *
 * @beta
 */
export function ChartReveal({ className, style, children }: ChartRevealProps): ReactElement {
  const context = useChartRoot("Chart.Reveal");
  const drawn = useChartFrame("Chart.Reveal", usePlotLayout("Chart.Reveal"));
  const node = useRef<HTMLDivElement>(null);
  // Where the edge rested, which the next step glides from.
  const shown = useRef<number | null>(null);
  useChartFollower("Chart.Reveal", (active, cause) => {
    const element = node.current;
    const window = context.model.window;
    if (element === null) return;
    const at =
      active === null || drawn === null || window === null
        ? null
        : pointAlong(
            drawn.frame,
            slotCentreAt(drawn.frame, active.slot - window.first, context.xScale),
            context.xScale
          );
    const from = shown.current;
    shown.current = at;
    // A step glides the edge from where it rested. Showing, hiding, a commit and reduced motion,
    // which Root repaints as a commit, place it at once.
    const glides = at !== null && from !== null && cause === "step" && !context.motion.snaps();
    const spring = glides ? stepSpring(context.store) : null;
    for (const series of masked(element)) {
      // The property does not inherit, so it goes on each series the mask dims and no deeper.
      writeStyle(series, "--chart-active-x", at === null ? null : `${String(at)}px`);
      if (at === null || from === null || spring === null) snapGlide(series);
      else glideLength(series, "--chart-active-x", at, from - at, spring);
    }
  });
  useLayoutEffect(() => {
    const element = node.current;
    return () => {
      if (element !== null) for (const series of masked(element)) snapGlide(series);
    };
  }, []);
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
