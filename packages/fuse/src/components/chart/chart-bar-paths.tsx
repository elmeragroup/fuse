"use client";

/**
 * The path form of one Bar above 100 slots: one path per colour step, then the projected span, the
 * estimated outlines, the missing ticks and the emphasised overlays. The series grows from the zero
 * line in Root's entrance as one transform, which holds one registration with Root's loop.
 */
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { ReactElement } from "react";

import { COLUMN_AXES, COLUMN_STRIDE, columnKind, columnsDrawing, layoutColumns } from "./chart-bar-columns";
import type { ColumnTopology } from "./chart-bar-columns";
import { pastSpanEnd } from "./chart-bar-draw";
import { ListFills } from "./chart-bar-fills";
import type { SeriesDraw } from "./chart-bar-series";
import type { MarkValues } from "./chart-motion";
import { placementOf, useCommitMotion, useMotionMark } from "./chart-motion-mark";
import { placePath, topologyAt } from "./chart-path-draw";
import type { PathMemory } from "./chart-path-draw";
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

/** What the columns' writer reads besides the numbers: the frame and the topology. */
type ColumnsLook = {
  readonly frame: PlotFrame;
  readonly topology: ColumnTopology;
  /** The topology of the route a data update tweens, while it runs. */
  readonly moving: { current: ColumnTopology | null };
};

/** Draw the columns, their quality paths, the missing ticks and the emphasis boxes from the loop's numbers. */
function drawColumns(group: SVGGElement, look: ColumnsLook, values: MarkValues): void {
  const topology = topologyAt(look.moving.current, look.topology, values.length / COLUMN_STRIDE);
  const drawing = columnsDrawing(look.frame, topology, values);
  for (const path of group.querySelectorAll('[data-slot="chart-bar-path"]')) {
    const part = path.getAttribute("data-part");
    const fill = Number(path.getAttribute("data-fill") ?? "-1");
    const d =
      part === "fill"
        ? (drawing.fills[fill] ?? "")
        : part === "estimated"
          ? drawing.estimated
          : part === "projected"
            ? drawing.projected
            : drawing.missing;
    if (path.getAttribute("d") !== d) path.setAttribute("d", d);
  }
  let index = 0;
  for (const rect of group.querySelectorAll('[data-slot="chart-bar-emphasis"]')) {
    const box = drawing.emphasis[index];
    if (box !== undefined) {
      for (const [name, value] of Object.entries(box)) rect.setAttribute(name, String(value));
    }
    index += 1;
  }
}

/**
 * One series as paths. The gradient look fades through one mask, and `data-fade="past"` dims the
 * past span through one more. On a data update the columns move through the modes of
 * `layout/path-motion.ts`, as a line's vertices do.
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
  const { motion, update, paths } = context;
  const { box } = frame;
  const pastEnd = useMemo(() => pastSpanEnd(context, series, frame), [context, series, frame]);
  // The snapped zero line, where the entrance grows from and the list gradient ends.
  const zero = snapY(box, valueAt(frame, 0));
  const columns = useMemo(
    () => layoutColumns(context, series, frame, metrics, sub, paint, emphasised),
    [context, series, frame, metrics, sub, paint, emphasised]
  );
  const { topology, fills } = columns;
  const listFill = paint.stops === undefined ? undefined : `url(#${prefix}-list)`;
  // The grow's scale is a size, which a resize leaves alone.
  const growLook = useMemo(() => ({ frame }), [frame]);
  const { ref: growRef, place: placeGrow } = useMotionMark(motion, drawGrow, growLook, ["size"]);
  const growCommit = useCommitMotion(update, plot, frame.orientation);
  const grows = entering && context.intro !== "none";
  useLayoutEffect(() => {
    // The whole series grows from the zero line, once. Every commit places the grow through the
    // shared owner: a data update or a new layout ends it at full scale, so the columns' own tween
    // takes over, and a resize keeps its scale and redraws it about the columns' new zero line.
    const entrance = grows ? ({ kind: "enter", from: [0], delay: 0 } as const) : undefined;
    const asked = growCommit();
    placeGrow([1], asked.kind === "move" ? { kind: "snap" } : placementOf(asked, { entrance }));
  });
  const moving = useRef<ColumnTopology | null>(null);
  const look = useMemo((): ColumnsLook => ({ frame, topology, moving }), [frame, topology]);
  const { ref: columnsRef, node, drawn, place } = useMotionMark(motion, drawColumns, look, COLUMN_AXES);
  const commit = useCommitMotion(update, plot, frame.orientation);
  const memoryRef = useRef<PathMemory<ColumnTopology> | null>(null);
  const lastLookRef = useRef<ColumnsLook | null>(null);
  const outgoingRef = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    placePath(commit(), {
      mark: { ref: columnsRef, node, drawn, place },
      motion,
      paths,
      seriesIndex: series.seriesIndex,
      drawn: "columns",
      kind: columnKind(box.width / frame.count, valueAt(frame, 0)),
      look,
      path: columns,
      topology,
      rest: columns.values,
      memory: memoryRef,
      lastLook: lastLookRef,
      outgoing: outgoingRef.current,
      draw: drawColumns,
    });
  });
  useLayoutEffect(() => () => paths.delete(series.seriesIndex, "columns"), [paths, series.seriesIndex]);
  const resting = useMemo(
    () => columnsDrawing(frame, topology, columns.values),
    [frame, topology, columns.values]
  );
  const setRefs = useCallback(
    (element: SVGGElement | null) => {
      growRef(element);
      columnsRef(element);
    },
    [growRef, columnsRef]
  );
  const emphasisSlots = topology.entries.flatMap((entry, index) =>
    entry.emphasis ? [columns.keys[index] ?? String(index)] : []
  );
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
        ref={setRefs}
        data-slot="chart-bar-marks"
        mask={pastEnd === null ? undefined : `url(#${prefix}-past)`}>
        {/* Every paint and quality path stays mounted, its data empty at rest when nothing draws in
            it, so a route that still draws a leaving column in it finds it. */}
        <g mask={variant === "gradient" ? `url(#${prefix}-fade)` : undefined}>
          {fills.map((fill, index) => (
            <path
              key={fill === "" ? "series" : fill}
              data-slot="chart-bar-path"
              data-part="fill"
              data-fill={index}
              data-series={series.seriesIndex}
              d={resting.fills[index] ?? ""}
              style={{
                "--chart-bar-paint": fill === "" ? undefined : fill,
                "--_fill": fill === "" ? listFill : undefined,
              }}
            />
          ))}
          <path
            data-slot="chart-bar-path"
            data-part="projected"
            data-series={series.seriesIndex}
            data-projected=""
            d={resting.projected}
          />
        </g>
        <path
          data-slot="chart-bar-path"
          data-part="estimated"
          data-series={series.seriesIndex}
          data-quality="estimated"
          d={resting.estimated}
        />
        <path
          data-slot="chart-bar-path"
          data-part="missing"
          data-series={series.seriesIndex}
          data-quality="missing"
          style={{ "--_tick-width": `${String(tickWidth(box))}px` }}
          d={resting.missing}
        />
        {emphasisSlots.map((key, index) => (
          <rect
            key={key}
            data-slot="chart-bar-emphasis"
            data-series={series.seriesIndex}
            {...resting.emphasis[index]}
          />
        ))}
      </g>
      <g ref={outgoingRef} data-part="outgoing" />
    </>
  );
}

Object.assign(SeriesPaths, { displayName: "Chart.Bar.Paths" });
