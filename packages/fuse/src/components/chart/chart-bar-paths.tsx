"use client";

/**
 * The path form of one Bar above 100 slots: one path per colour step, then the projected span, the
 * estimated outlines, the missing ticks and the emphasised overlays. The series grows from the zero
 * line in Root's entrance as one transform, which holds one registration with Root's loop.
 */
import { useLayoutEffect, useMemo } from "react";
import type { ReactElement } from "react";

import { layoutPaths } from "./chart-bar-draw";
import { ListFills } from "./chart-bar-fills";
import type { SeriesDraw } from "./chart-bar-series";
import type { MarkValues } from "./chart-motion";
import { placementOf, useCommitMotion, useMotionMark } from "./chart-motion-mark";
import { barCellAt, barRect, rectsPath } from "./layout/bar-geometry";
import type { BarVariant } from "./layout/bar-shapes";
import { snapY, tickWidth, valueAt } from "./layout/plot-frame";
import type { PlotFrame } from "./layout/plot-frame";

/**
 * Scale the path form's marks from the zero line by the loop's number. The paths draw the latest
 * frame at once, so the zero line they grow from is that frame's, snapped as the paths snap it.
 */
function drawGrow(node: SVGGElement, look: { readonly frame: PlotFrame }, values: MarkValues): void {
  const [scale = 1] = values;
  const { frame } = look;
  const zero = snapY(frame.box, valueAt(frame, 0));
  if (scale === 1) node.removeAttribute("transform");
  else
    node.setAttribute(
      "transform",
      `translate(0 ${String(zero)}) scale(1 ${String(scale)}) translate(0 ${String(-zero)})`
    );
}

/**
 * One series as paths. The gradient look fades through one mask, and `data-fade="past"` dims the
 * past span through one more. The series snaps to new data until the path tween lands.
 */
export function SeriesPaths({
  context,
  series,
  frame,
  plot,
  metrics,
  sub,
  variant,
  paint,
  emphasised,
  prefix,
  entering,
}: SeriesDraw & {
  /** The look the series draws, "gradient" or the default look in the path form. */
  readonly variant: BarVariant;
  readonly emphasised: ReadonlySet<number>;
}): ReactElement {
  const { model, motion, update } = context;
  const { box } = frame;
  const { steps, estimated, projected, missing, pastEnd, zero } = useMemo(
    () => layoutPaths(context, series, frame, sub, paint),
    [context, series, frame, sub, paint]
  );
  const listFill = paint.stops === undefined ? undefined : `url(#${prefix}-list)`;
  // The grow's scale is a size, which a resize leaves alone.
  const growLook = useMemo(() => ({ frame }), [frame]);
  const { ref: growRef, place: placeGrow } = useMotionMark(motion, drawGrow, growLook, ["size"]);
  const commit = useCommitMotion(update, plot, frame.orientation);
  const grows = entering && context.intro !== "none";
  useLayoutEffect(() => {
    // The whole series grows from the zero line, once. Every commit places the grow through the
    // shared owner: a data update or a new layout ends it at full scale, as the paths draw new data
    // at once, and a resize keeps its scale and redraws it about the paths' new zero line at once.
    const entrance = grows ? ({ kind: "enter", from: [0], delay: 0 } as const) : undefined;
    placeGrow([1], placementOf(commit(), { entrance, form: "path" }));
  });
  return (
    <>
      <defs>
        {paint.stops === undefined ? null : (
          <>
            <linearGradient
              id={`${prefix}-list`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="0"
              y2={zero}>
              {paint.stops.map((stop, index, stops) => (
                <stop
                  // The roles never reorder, so the position is the stop's identity.
                  key={index}
                  offset={index / Math.max(1, stops.length - 1)}
                  style={{ "--chart-stop": stop }}
                />
              ))}
            </linearGradient>
            {/* The active overlay fills one bar, from its tip to its base. */}
            <ListFills prefix={prefix} stops={paint.stops} orientation={frame.orientation} />
          </>
        )}
        {variant === "gradient" ? (
          <>
            <linearGradient
              id={`${prefix}-fade-ramp`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="0"
              y2={box.height}>
              <stop offset="0.2" />
              <stop offset="0.9" style={{ "--chart-stop-opacity": 0 }} />
            </linearGradient>
            <mask
              id={`${prefix}-fade`}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={box.width}
              height={box.height}>
              <rect width={box.width} height={box.height} fill={`url(#${prefix}-fade-ramp)`} />
            </mask>
          </>
        ) : null}
        {pastEnd === null ? null : (
          <mask
            id={`${prefix}-past`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={box.width}
            height={box.height}>
            <rect width={pastEnd} height={box.height} fillOpacity="0.4" />
            <rect x={pastEnd} width={Math.max(box.width - pastEnd, 0)} height={box.height} />
          </mask>
        )}
      </defs>
      <g
        ref={growRef}
        data-slot="chart-bar-marks"
        mask={pastEnd === null ? undefined : `url(#${prefix}-past)`}>
        <g mask={variant === "gradient" ? `url(#${prefix}-fade)` : undefined}>
          {[...steps].map(([fill, rects]) => (
            <path
              key={fill}
              data-slot="chart-bar-path"
              data-series={series.seriesIndex}
              d={rectsPath(rects)}
              style={{
                "--chart-bar-paint": fill === "" ? undefined : fill,
                "--_fill": fill === "" ? listFill : undefined,
              }}
            />
          ))}
          {projected.length > 0 ? (
            <path
              data-slot="chart-bar-path"
              data-series={series.seriesIndex}
              data-projected=""
              d={rectsPath(projected)}
            />
          ) : null}
        </g>
        {estimated.length > 0 ? (
          <path
            data-slot="chart-bar-path"
            data-series={series.seriesIndex}
            data-quality="estimated"
            d={rectsPath(estimated)}
          />
        ) : null}
        {missing === "" ? null : (
          <path
            data-slot="chart-bar-path"
            data-series={series.seriesIndex}
            data-quality="missing"
            style={{ "--_tick-width": `${String(tickWidth(box))}px` }}
            d={missing}
          />
        )}
        {[...emphasised].map((slot) => {
          const cell = barCellAt(model, series, slot);
          return cell === null ? null : (
            <rect
              key={slot}
              data-slot="chart-bar-emphasis"
              data-series={series.seriesIndex}
              {...barRect(frame, cell, metrics, sub, "whole")}
            />
          );
        })}
      </g>
    </>
  );
}

Object.assign(SeriesPaths, { displayName: "Chart.Bar.Paths" });
