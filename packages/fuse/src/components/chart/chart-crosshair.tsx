"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { useChartRoot, usePlotLayout } from "./chart-context";
import { writeAttribute } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import { useChartFrame } from "./chart-plot";
import { usePlotRead } from "./chart-plot-measure";
import { ChartCrosshairContext } from "./chart-scope-contexts";
import { glideFrom, snapGlide, stepSpring } from "./chart-spring";
import { sameShallow, useSteady } from "./chart-steady";
import type { ChartLayerProps } from "./chart-types";
import { coarsestOf, ownSlot } from "./layout/coarse-slots";
import { optionBand, slotLine, wholeWidth } from "./layout/plot-frame";

/**
 * Props for `Chart.Crosshair`, a closed part. The Crosshairs of several Panels share one active
 * slot, so they move as one crosshair.
 *
 * @beta
 */
export type ChartCrosshairProps = ChartLayerProps & {
  /**
   * A band over the active slot or a line through it. The default follows `xScale`. A band spans
   * the active slot of the coarsest series in its layout, so an hourly bar's band covers its hour.
   */
  variant?: "line" | "band";
  /**
   * The ends of the line that fade out, over 10% of the plot each. "both" by default. "top" is the
   * end at the value axis's maximum, the right end under `orientation="horizontal"`. A band never
   * fades.
   */
  fade?: "both" | "top" | "bottom" | "none";
  /** A `SlotLabel` adds the active slot's label as a pill on the x axis. */
  children?: ReactNode;
};

/**
 * The marker of the active slot, a band for `xScale="band"` and a line for `"point"` by default.
 * Write one in each Panel that needs one. Root moves it with the pointer by writing its geometry,
 * so a pointer move renders nothing in React. The band covers the same pixel columns as the
 * focused option and the tooltip's anchor. The line glides from slot to slot on a spring that
 * quickens with the pointer, so it keeps up with a fast sweep and eases after a slow one, unless the
 * reader prefers reduced motion, and fades at both ends by default. Active dots glide with it.
 *
 * @beta
 */
export function ChartCrosshair({
  variant,
  fade = "both",
  className,
  style,
  children,
}: ChartCrosshairProps): ReactElement {
  const { xScale, model, motion, store } = useChartRoot("Chart.Crosshair");
  const layout = usePlotLayout("Chart.Crosshair");
  const { keys } = layout;
  const drawn = useChartFrame("Chart.Crosshair", layout);
  // A band spans the active slot of the layout's coarsest series, so an hourly bar's band covers its hour.
  const coarsest = coarsestOf(model.series.filter(({ key }) => keys.includes(key)));
  const look = variant ?? (xScale === "band" ? "band" : "line");
  const layer = useRef<SVGSVGElement>(null);
  const mark = useRef<SVGRectElement>(null);
  // `--chart-crosshair-width` in CSS pixels, read in the plot's probe phase, never on a step.
  const [token, setToken] = useState(1);
  const steadyStyle = useSteady(style, sameShallow);
  usePlotRead(() => {
    const svg = layer.current;
    if (svg === null) return false;
    const read = Number.parseFloat(getComputedStyle(svg).getPropertyValue("--chart-crosshair-width"));
    setToken(Number.isFinite(read) ? read : 1);
    return true;
  }, [className, steadyStyle]);
  // Where the line showed along the slot axis, which the next step glides from.
  const shown = useRef<number | null>(null);
  useChartFollower("Chart.Crosshair", (active, cause) => {
    const node = mark.current;
    const window = model.window;
    if (node === null || drawn === null || active === null || window === null) {
      shown.current = null;
      if (layer.current !== null) snapGlide(layer.current);
      return;
    }
    const { frame } = drawn;
    const { box } = frame;
    const vertical = frame.orientation === "vertical";
    const position = active.slot - window.first;
    const [first, last] =
      coarsest === undefined ? [active.slot, active.slot] : ownSlot(coarsest, active.slot);
    // A band covers the focused option's columns, or its coarse slot's, and a line marks the slot.
    const [start, end] =
      look === "band"
        ? [
            optionBand(frame, Math.max(first, window.first) - window.first, xScale)[0],
            optionBand(frame, Math.min(last, window.last) - window.first, xScale)[1],
          ]
        : slotLine(frame, position, xScale, wholeWidth(box, token));
    writeAttribute(node, vertical ? "x" : "y", start);
    writeAttribute(node, vertical ? "width" : "height", end - start);
    // The cross axis spans the plot, which a step leaves alone, so only a resize writes it.
    writeAttribute(node, vertical ? "y" : "x", 0);
    writeAttribute(node, vertical ? "height" : "width", vertical ? box.height : box.width);
    // A step glides the line from where it showed. Showing, a commit and reduced motion place it.
    const from = shown.current;
    shown.current = start;
    const svg = layer.current;
    if (svg === null) return;
    // Only a step glides, and only the line. Root repaints with a commit on a resize, a change of
    // look and a change of the reader's motion preference, which all place the line at once.
    if (look !== "line" || cause !== "step" || from === null || motion.snaps()) {
      snapGlide(svg);
      return;
    }
    // The layer glides, not the line, so the compositor moves it without restyling the line.
    glideFrom(svg, vertical ? [from - start, 0] : [0, from - start], stepSpring(store));
  });
  useLayoutEffect(() => {
    const svg = layer.current;
    return () => {
      if (svg !== null) snapGlide(svg);
    };
  }, []);
  return (
    <>
      <svg
        ref={layer}
        data-slot="chart-crosshair"
        data-variant={look}
        data-fade={look === "line" ? fade : undefined}
        aria-hidden="true"
        className={className}
        style={style}>
        {drawn === null ? null : <rect ref={mark} data-slot="chart-crosshair-mark" />}
      </svg>
      {children === undefined ? null : <ChartCrosshairContext value={true}>{children}</ChartCrosshairContext>}
    </>
  );
}

Object.assign(ChartCrosshair, { displayName: "Chart.Crosshair" });
