"use client";

/**
 * The path form of one Bar above 100 slots: per colour step a solid path, a projected path and an
 * estimated path, then the missing ticks and the emphasised overlays. The series grows from the zero
 * line in Root's entrance as one transform, which holds one registration with Root's loop.
 */
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { ReactElement } from "react";

import { COLUMN_AXES, COLUMN_STRIDE, columnKind, columnsDrawing, layoutColumns } from "./chart-bar-columns";
import type { ColumnPart, ColumnsDrawing, ColumnTopology } from "./chart-bar-columns";
import { pastSpanEnd } from "./chart-bar-draw";
import { ListFills } from "./chart-bar-fills";
import type { SeriesDraw } from "./chart-bar-series";
import { partsCache, writeAttribute, writeAttributes } from "./chart-dom";
import type { MarkValues } from "./chart-motion";
import { placementOf, useCommitMotion, useFirstDraw, useMotionMark } from "./chart-motion-mark";
import { topologyAt } from "./chart-path-draw";
import { usePathMark } from "./chart-series-path";
import type { ChartBarVariant } from "./chart-types";
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
  writeAttribute(
    node,
    "transform",
    scale === 1
      ? null
      : `translate(0 ${String(zero)}) scale(1 ${String(scale)}) translate(0 ${String(-zero)})`
  );
}

/** What the columns' writer reads besides the numbers: the frame and the topology. */
type ColumnsLook = {
  readonly frame: PlotFrame;
  readonly topology: ColumnTopology;
  /** The topology of the route a data update tweens, while it runs. */
  readonly moving: { current: ColumnTopology | null };
};

/** The parts a paint step's paths take, which a path's `data-part` names. */
const STEP_PARTS: readonly ColumnPart[] = ["fill", "projected", "estimated"];

/** The columns' paths, each with what it draws, and the emphasis boxes, in order. */
const columnParts = partsCache((group) => ({
  paths: [...group.querySelectorAll('[data-slot="chart-bar-path"]')].map((path) => ({
    path,
    // The missing ticks' path names no step part.
    part: STEP_PARTS.find((part) => part === path.getAttribute("data-part")),
    fill: Number(path.getAttribute("data-fill") ?? "-1"),
  })),
  boxes: [...group.querySelectorAll('[data-slot="chart-bar-emphasis"]')],
}));

/** Draw the columns, their quality paths, the missing ticks and the emphasis boxes from the loop's numbers. */
function drawColumns(group: SVGGElement, look: ColumnsLook | null, values: MarkValues): void {
  if (look === null) return;
  const topology = topologyAt(look.moving.current, look.topology, values.length / COLUMN_STRIDE);
  const drawing = columnsDrawing(look.frame, topology, values);
  const { paths, boxes } = columnParts(group);
  for (const { path, part, fill } of paths) {
    writeAttribute(path, "d", (part === undefined ? drawing.missing : drawing[part][fill]) ?? "");
  }
  boxes.forEach((rect, index) => {
    const box = drawing.emphasis[index];
    if (box !== undefined) writeAttributes(rect, box);
  });
}

/** The attribute chart.css draws each quality path by: projected lighter, estimated dashed. */
const PART_QUALITY = {
  fill: {},
  projected: { "data-projected": "" },
  estimated: { "data-quality": "estimated" },
} satisfies Record<ColumnPart, Record<string, string>>;

/**
 * One path per paint step for one part. A step's position is its identity, since a threshold's two
 * sides may share a role, and a projected or estimated reading keeps its step's paint, so each step
 * has a path of each part.
 */
function StepPaths({
  part,
  fills,
  resting,
  seriesIndex,
  listFill,
}: {
  readonly part: ColumnPart;
  readonly fills: readonly string[];
  readonly resting: ColumnsDrawing;
  readonly seriesIndex: number;
  /** The role list's gradient, which only the solid fill takes. */
  readonly listFill: string | undefined;
}): ReactElement {
  return (
    <>
      {fills.map((fill, index) => (
        <path
          key={index}
          data-slot="chart-bar-path"
          data-part={part}
          data-fill={index}
          data-series={seriesIndex}
          {...PART_QUALITY[part]}
          d={resting[part][index] ?? ""}
          style={{
            "--chart-bar-paint": fill === "" ? undefined : fill,
            "--_fill": fill === "" && part === "fill" ? listFill : undefined,
          }}
        />
      ))}
    </>
  );
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
  readonly variant: ChartBarVariant;
  readonly emphasised: ReadonlySet<number>;
}): ReactElement {
  const { motion, update, model, now, fade } = context;
  const { box } = frame;
  const pastEnd = useMemo(
    () => pastSpanEnd({ model, fade, now }, series, frame),
    [model, fade, now, series, frame]
  );
  // The snapped zero line, where the entrance grows from and the list gradient ends.
  const zero = snapY(box, valueAt(frame, 0));
  const columns = useMemo(
    () => layoutColumns({ model, update }, series, frame, metrics, sub, paint, emphasised),
    [model, update, series, frame, metrics, sub, paint, emphasised]
  );
  const { topology, fills } = columns;
  const listFill = paint.stops === undefined ? undefined : `url(#${prefix}-list)`;
  // The grow's scale is a size, which a resize leaves alone.
  const growLook = useMemo(() => ({ frame }), [frame]);
  const { ref: growRef, place: placeGrow } = useMotionMark(motion, drawGrow, growLook, ["size"]);
  const growCommit = useCommitMotion(update, plot, frame.orientation, frame);
  useLayoutEffect(() => {
    // The whole series grows from the zero line, once. Every commit in Root's waiting entrance
    // keeps it flat, to grow once the entrance plays. After that a data update or a new layout
    // ends it at full scale, so the columns' own tween takes over, and a resize keeps its scale
    // and redraws it about the columns' new zero line.
    const asked = growCommit();
    placeGrow(
      [1],
      entering
        ? { kind: "enter", from: [0], delay: 0 }
        : asked.kind === "move"
          ? { kind: "snap" }
          : placementOf(asked)
    );
  });
  const moving = useRef<ColumnTopology | null>(null);
  const look = useMemo((): ColumnsLook => ({ frame, topology, moving }), [frame, topology]);
  const kind = useMemo(() => columnKind(frame.grid.step, valueAt(frame, 0)), [frame]);
  const placed = useMemo(
    () => ({ look, kind, path: columns, topology, rest: columns.values }),
    [look, kind, columns, topology]
  );
  const { markRef: columnsRef, outgoingRef } = usePathMark(drawColumns, {
    context,
    plot,
    frame,
    axes: COLUMN_AXES,
    seriesIndex: series.seriesIndex,
    route: "columns",
    placed,
  });
  // React draws the first rest, and the loop draws every frame after it.
  const resting = useFirstDraw(() => columnsDrawing(frame, topology, columns.values));
  const steps = { fills, resting, seriesIndex: series.seriesIndex, listFill };
  const setRefs = useCallback(
    (element: SVGGElement | null) => {
      growRef(element);
      columnsRef(element);
    },
    [growRef, columnsRef]
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
          <StepPaths part="fill" {...steps} />
          <StepPaths part="projected" {...steps} />
        </g>
        <StepPaths part="estimated" {...steps} />
        <path
          data-slot="chart-bar-path"
          data-part="missing"
          data-series={series.seriesIndex}
          data-quality="missing"
          style={{ "--_tick-width": `${String(tickWidth(box))}px` }}
          d={resting.missing}
        />
        {columns.emphasis.map(({ key, paint: own }, index) => (
          <rect
            key={key}
            data-slot="chart-bar-emphasis"
            data-series={series.seriesIndex}
            {...resting.emphasis[index]}
            style={own === undefined ? undefined : { "--chart-bar-paint": own }}
          />
        ))}
      </g>
      <g ref={outgoingRef} data-part="outgoing" />
    </>
  );
}

Object.assign(SeriesPaths, { displayName: "Chart.Bar.Paths" });
