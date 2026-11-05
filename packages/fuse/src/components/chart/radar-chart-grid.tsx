"use client";

/**
 * The radar's frame of reference: the Grid's rings and spokes, the AngleAxis's spoke labels and the
 * RadiusAxis's ring values. Rings sit at the radius domain's ticks, and when the domain reaches below
 * 0 the zero ring draws solid, as the bar's zero line does (R4). A ring is a polygon through the
 * spokes or a circle. Labels are HTML in the cell (S12), placed in percentages of the sweep's box,
 * so the server's markup holds at any width. The first paint draws all of it at rest (D18), and only
 * a chart nothing painted before, a client mount or one that leaves its empty state, scales its
 * rings and spokes out and fades its labels in as the entrance starts. The Grid's hand turns to the
 * active spoke the short way round.
 */
import { useRef } from "react";
import type { ReactElement } from "react";

import { useLocale } from "../../intl/locale-context";
import { writeAttribute, writeStyle } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import { viewBoxOf } from "./chart-pie-frame";
import { radarDrawingIn, usePolarContext } from "./chart-polar-context";
import type { RadarDrawing } from "./chart-polar-context";
import { springTiming } from "./chart-spring";
import type { ChartLayerProps, ValueFormat } from "./chart-types";
import { formatValue } from "./format/value-format";
import { fitStridedLabels } from "./layout/clock-labels";
import { labelWidth } from "./layout/label-width";
import { CHART_SPRINGS } from "./layout/motion";
import { polarPoint } from "./layout/polar-angle";
import type { SweepBox } from "./layout/polar-angle";
import { angleLabel } from "./layout/polar-labels";
import { radarRadius, spokeAngle } from "./layout/radar";
import { fitRingLabels, ringAnchor } from "./layout/ring-labels";
import type { MarkCover } from "./layout/ring-labels";
import { pathNumber } from "./layout/rounding";
import { springEasing } from "./layout/spring";

/**
 * Props for `RadarChart.Grid`, a closed part.
 *
 * @beta
 */
export type RadarChartGridProps = ChartLayerProps & {
  /** The ring shape. "polygon" by default. */
  variant?: "polygon" | "circle";
};

/**
 * Props for `RadarChart.AngleAxis`, a closed part.
 *
 * @beta
 */
export type RadarChartAngleAxisProps = ChartLayerProps;

/**
 * Props for `RadarChart.RadiusAxis`, a closed part.
 *
 * @beta
 */
export type RadarChartRadiusAxisProps = ChartLayerProps & {
  /** The tick label format. The first series' `format` is the default. */
  format?: ValueFormat;
};

const GROW = springEasing(CHART_SPRINGS.grow);
const EXTEND = springEasing(CHART_SPRINGS.extend);

/** How far past the rim a spoke label's point sits, as a share of the radius. */
const LABEL_REACH = 1.1;

/** Each radar's spoke labels as the angle axis thins them, made once per drawing. */
const spokeFits = new WeakMap<RadarDrawing, readonly (number | "always" | "none")[]>();

/**
 * The narrowest container width each spoke label shows at. The labels thin by a stride that divides
 * the spoke count, so the labels that show stay evenly spaced round the dial, and the first spoke's
 * label always shows.
 */
function spokeLabelFit(radar: RadarDrawing): readonly (number | "always" | "none")[] {
  const known = spokeFits.get(radar);
  if (known !== undefined) return known;
  const strides = Array.from({ length: radar.count }, (_, index) => index + 1).filter(
    (stride) => radar.count % stride === 0
  );
  const fit = fitStridedLabels(
    radar.labels.map((_, index) => ({ angle: spokeAngle(index, radar.count), unit: index })),
    radar.labels.map((label) => labelWidth(label.text)),
    strides,
    LABEL_REACH
  );
  spokeFits.set(radar, fit);
  return fit;
}

/** How near a series' edge or vertex a point counts as covered, in CSS pixels: half the stroke and a dot. */
const EDGE_REACH = 4;

/** Whether a radar's series at rest cover a point: within reach of any polygon edge or vertex. */
function radarCover(radar: RadarDrawing): MarkCover {
  const radius = radarRadius(radar.domain, 1);
  return (x, y, dial) =>
    radar.series.some((series) => {
      const points = series.values.map((value, index) =>
        value === null ? null : polarPoint(spokeAngle(index, radar.count), radius(value))
      );
      return points.some((point, index) => {
        if (point === null) return false;
        const next = points[(index + 1) % points.length] ?? null;
        const ax = point.x * dial;
        const ay = point.y * dial;
        if (next === null) return Math.hypot(x - ax, y - ay) <= EDGE_REACH;
        return segmentDistance(x, y, ax, ay, next.x * dial, next.y * dial) <= EDGE_REACH;
      });
    });
}

/** A point's distance from a segment. */
function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/** A ring's path: a polygon through every spoke, or a circle. */
function ringPath(radius: number, count: number, variant: "polygon" | "circle"): string {
  if (variant === "circle" || count < 3) {
    const r = pathNumber(radius);
    return `M0,${pathNumber(-radius)}A${r},${r} 0 1 1 0,${r}A${r},${r} 0 1 1 0,${pathNumber(-radius)}Z`;
  }
  return `${Array.from({ length: count }, (_, index) => {
    const { x, y } = polarPoint(spokeAngle(index, count), radius);
    return `${index === 0 ? "M" : "L"}${pathNumber(x)},${pathNumber(y)}`;
  }).join("")}Z`;
}

/** The rings a radar draws: each tick's radius past the centre, the zero ring among them. */
function ringsOf(radar: RadarDrawing): readonly { readonly radius: number; readonly zero: boolean }[] {
  const radius = radarRadius(radar.domain, 1);
  return radar.ticks.flatMap((tick) => {
    const r = radius(tick);
    return r > 1e-9 ? [{ radius: r, zero: radar.zero !== null && tick === 0 }] : [];
  });
}

/** The angle a hand shows now, a running glide included, in its rest's turn. */
function shownAngle(node: SVGLineElement, rest: number): number {
  const shown = Number.parseFloat(getComputedStyle(node).rotate);
  if (!Number.isFinite(shown)) return rest;
  // The computed angle may come back in another turn than the one the hand keeps.
  return rest + ((((shown - rest) % 360) + 540) % 360) - 180;
}

/** A point's place in the cell, as percentages of the sweep's box. */
function percent(box: SweepBox, x: number, y: number): readonly [string, string] {
  const left = ((x - box.left) / (box.right - box.left)) * 100;
  const top = ((y - box.top) / (box.bottom - box.top)) * 100;
  return [`${left.toFixed(3)}%`, `${top.toFixed(3)}%`];
}

/**
 * The rings and spokes. When the radius domain reaches below 0 it draws the zero ring solid. Its
 * hand marks the active spoke and turns to the next one the short way round.
 *
 * @beta
 */
export function RadarChartGrid({ variant = "polygon", className, style }: RadarChartGridProps): ReactElement {
  const { model, motion, box } = usePolarContext("RadarChart.Grid", ["radar"]);
  const radar = radarDrawingIn(model, "RadarChart.Grid");
  const hand = useRef<SVGLineElement>(null);
  const turned = useRef<number | null>(null);
  const count = radar.count;
  // The hand turns to the active spoke by the short way, so it keeps an angle that never wraps.
  useChartFollower("RadarChart.Grid", (active, cause) => {
    const node = hand.current;
    if (node === null) return;
    writeAttribute(node, "data-shown", active === null ? null : "");
    if (active === null || count === 0) return;
    const target = spokeAngle(active.slot, count);
    const from = turned.current;
    const shown = from === null ? null : shownAngle(node, from);
    for (const animation of node.getAnimations()) animation.cancel();
    const rest = shown === null ? target : shown + ((((target - shown) % 360) + 540) % 360) - 180;
    turned.current = rest;
    writeStyle(node, "rotate", `${String(rest)}deg`);
    if (shown === null || cause !== "step" || motion.reduced() || Math.abs(rest - shown) < 1e-6) return;
    const timing = springTiming(CHART_SPRINGS.hand);
    if (!timing.spring) return;
    node.animate([{ rotate: `${String(shown)}deg` }, { rotate: `${String(rest)}deg` }], {
      duration: timing.duration,
      easing: timing.easing,
    });
  });
  return (
    <svg
      data-slot="radar-chart-grid"
      data-variant={variant}
      data-polar-layer=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={className}
      style={{
        "--_grow-duration": `${String(GROW.duration)}ms`,
        "--_grow-easing": GROW.easing,
        "--_extend-duration": `${String(EXTEND.duration)}ms`,
        "--_extend-easing": EXTEND.easing,
        ...style,
      }}>
      {ringsOf(radar).map(({ radius, zero }, index) => (
        <path
          key={radius}
          data-slot="radar-chart-grid-ring"
          data-zero={zero ? "" : undefined}
          d={ringPath(radius, count, variant)}
          style={{ "--chart-slot": index }}
        />
      ))}
      {Array.from({ length: count }, (_, index) => {
        const { x, y } = polarPoint(spokeAngle(index, count), 1);
        return (
          <line
            key={index}
            data-slot="radar-chart-spoke"
            x1="0"
            y1="0"
            x2={pathNumber(x)}
            y2={pathNumber(y)}
            style={{ "--chart-slot": index }}
          />
        );
      })}
      <line ref={hand} data-slot="radar-chart-spoke" data-part="hand" x1="0" y1="0" x2="0" y2="-1" />
    </svg>
  );
}

/**
 * The spoke labels, one per row, each past the rim on its spoke and reading away from the centre.
 * They never rotate, and they take the frame's gutter beside the dial.
 *
 * @beta
 */
export function RadarChartAngleAxis({ className, style }: RadarChartAngleAxisProps): ReactElement {
  const { model, box } = usePolarContext("RadarChart.AngleAxis", ["radar"]);
  const radar = radarDrawingIn(model, "RadarChart.AngleAxis");
  const shown = spokeLabelFit(radar);
  return (
    <div
      data-slot="radar-chart-angle-axis"
      data-polar-layer=""
      data-outside=""
      aria-hidden="true"
      className={className}
      style={style}>
      {radar.labels.map((label, index) => {
        const { point, alignX, alignY } = angleLabel(spokeAngle(index, radar.count), LABEL_REACH);
        const [left, top] = percent(box, point.x, point.y);
        const min = shown[index] ?? "none";
        return (
          <span
            key={index}
            data-slot="radar-chart-angle-label"
            data-min={min === "always" || min === "none" ? undefined : min}
            data-hidden={min === "none" ? "" : undefined}
            style={{
              "--_x": left,
              "--_y": top,
              "--_align-x": `${String(-alignX * 100)}%`,
              "--_align-y": `${String(-alignY * 100)}%`,
              "--chart-slot": index,
            }}>
            {label.text}
          </span>
        );
      })}
    </div>
  );
}

/**
 * The ring values along the first spoke, each beside its ring, 0 among them when the domain spans
 * it.
 *
 * @beta
 */
export function RadarChartRadiusAxis({ format, className, style }: RadarChartRadiusAxisProps): ReactElement {
  const { model, box } = usePolarContext("RadarChart.RadiusAxis", ["radar"]);
  const radar = radarDrawingIn(model, "RadarChart.RadiusAxis");
  const { locale } = useLocale();
  const radius = radarRadius(radar.domain, 1);
  // Values stay clear of the spoke labels the axis shows past the rim, of the series' edges and
  // dots, and off the centre, along whichever of 12 and 6 o'clock leaves them more room.
  const spokes = spokeLabelFit(radar);
  const values = radar.ticks.map((tick) => ({
    radius: radius(tick),
    width: labelWidth(formatValue(locale, tick, format ?? radar.format, "tick").text),
  }));
  const clearance = {
    reach: LABEL_REACH,
    inner: 0,
    angles: radar.labels.map((label, index) => ({
      angle: spokeAngle(index, radar.count),
      width: labelWidth(label.text),
      shownAt: spokes[index] ?? "none",
    })),
    marks: radarCover(radar),
  };
  const anchor = ringAnchor(values, clearance);
  const shown = fitRingLabels(values, { ...clearance, anchor });
  return (
    <div
      data-slot="radar-chart-radius-axis"
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={style}>
      {radar.ticks.map((tick, index) => {
        const [left, top] = percent(box, 0, anchor === 180 ? radius(tick) : -radius(tick));
        const min = shown[index] ?? "none";
        return (
          <span
            key={tick}
            data-slot="radar-chart-radius-label"
            data-min={min === "none" ? undefined : min}
            data-hidden={min === "none" ? "" : undefined}
            style={{ "--_x": left, "--_y": top, "--chart-slot": index }}>
            {formatValue(locale, tick, format ?? radar.format, "tick").text}
          </span>
        );
      })}
    </div>
  );
}

Object.assign(RadarChartGrid, { displayName: "RadarChart.Grid" });
Object.assign(RadarChartAngleAxis, { displayName: "RadarChart.AngleAxis" });
Object.assign(RadarChartRadiusAxis, { displayName: "RadarChart.RadiusAxis" });
