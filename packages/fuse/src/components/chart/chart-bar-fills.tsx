"use client";

/**
 * The SVG paint servers a Bar's looks need, after evilcharts' bar patterns. A pattern or gradient
 * paints its content in the colours it was defined with, never the colours of the bar that uses
 * it, so each look gets one server per distinct bar paint, and a scale-coloured series gets one per
 * colour step it draws. A plain fill needs no server, and `chart.css` paints it from `--_paint`.
 * Each server's content names its paint through `--chart-fill` or `--chart-stop`, which
 * `chart.css` reads, so no colour sits in an inline style.
 */
import type { ReactElement } from "react";

import type { BarVariant } from "./layout/bar-shapes";
import { escapeColorKey } from "./layout/color-key";

/** Which paint server a bar fills from. */
export type FillKind = "hatched" | "projected" | "gradient" | "duotone" | "duotone-reverse";

/**
 * The paint server a bar fills from, or null for a plain fill.
 *
 * @param variant - The bar's look.
 * @param projected - Whether the bar draws a projected reading, which is hatched in every look.
 * @returns The server's kind.
 */
export function fillKind(variant: BarVariant, projected: boolean): FillKind | null {
  if (projected) return "projected";
  switch (variant) {
    case "hatched":
    case "gradient":
    case "duotone":
    case "duotone-reverse":
      return variant;
    default:
      return null;
  }
}

/** The geometry the plot-anchored servers read. */
export type FillPlot = {
  readonly orientation: "vertical" | "horizontal";
  /** The plot's width and height in CSS pixels. */
  readonly width: number;
  readonly height: number;
};

/**
 * One paint server's id. The paint escapes one to one into id characters, so a bar and the active
 * overlay name the same server for the same paint.
 *
 * @param prefix - The series' id prefix.
 * @param kind - The server's look.
 * @param paint - The paint the server draws in.
 * @returns The id.
 */
export function fillId(prefix: string, kind: FillKind, paint: string): string {
  return `${prefix}-${kind}-${escapeColorKey(paint)}`;
}

/** A pale tint of a paint, as the tinted looks fill most of a bar. */
function tint(paint: string, share: number): string {
  return `color-mix(in oklab, ${paint} ${String(share)}%, transparent)`;
}

/** The period of a hatch across its stripes, in CSS pixels. */
const HATCH = 5;

/**
 * A 45° hatch of a solid line and a tint, as CSS draws `repeating-linear-gradient(45deg, …)`: a
 * gradient that repeats every 5 px toward the top right, with hard stops, so the stripes run from
 * top left to bottom right and step from pixel to pixel as the CSS gradient's do.
 */
function Hatch({
  id,
  paint,
  line,
  shade,
}: {
  readonly id: string;
  readonly paint: string;
  readonly line: number;
  readonly shade: number;
}): ReactElement {
  const reach = HATCH / Math.SQRT2;
  const split = line / HATCH;
  return (
    <linearGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      spreadMethod="repeat"
      x1="0"
      y1="0"
      x2={reach}
      y2={-reach}>
      <stop offset="0" style={{ "--chart-stop": paint }} />
      <stop offset={split} style={{ "--chart-stop": paint }} />
      <stop offset={split} style={{ "--chart-stop": tint(paint, shade) }} />
      <stop offset="1" style={{ "--chart-stop": tint(paint, shade) }} />
    </linearGradient>
  );
}

/** One server of one kind for one paint. */
function Fill({
  id,
  kind,
  paint,
  plot,
}: {
  readonly id: string;
  readonly kind: FillKind;
  readonly paint: string;
  readonly plot: FillPlot;
}): ReactElement {
  const vertical = plot.orientation === "vertical";
  switch (kind) {
    case "hatched":
      return <Hatch id={id} paint={paint} line={1.5} shade={30} />;
    case "projected":
      return <Hatch id={id} paint={paint} line={1} shade={20} />;
    case "gradient":
      // The fade runs over the whole plot from the far edge, as evilcharts' user-space mask does.
      return (
        <linearGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          x1={vertical ? 0 : plot.width}
          y1="0"
          x2="0"
          y2={vertical ? plot.height : 0}>
          <stop offset="0.2" style={{ "--chart-stop": paint }} />
          <stop offset="0.9" style={{ "--chart-stop": paint, "--chart-stop-opacity": 0 }} />
        </linearGradient>
      );
    case "duotone":
    case "duotone-reverse": {
      const [first, second] = kind === "duotone" ? [tint(paint, 40), paint] : [paint, tint(paint, 40)];
      return (
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.5" style={{ "--chart-stop": first }} />
          <stop offset="0.5" style={{ "--chart-stop": second }} />
        </linearGradient>
      );
    }
  }
}

/**
 * The paint servers of one series.
 *
 * @param props - The id prefix, each kind's distinct paints in index order, and the plot.
 * @returns The servers, for a `defs` element.
 */
export function BarFills({
  prefix,
  needs,
  plot,
}: {
  readonly prefix: string;
  readonly needs: ReadonlyMap<FillKind, ReadonlySet<string>>;
  readonly plot: FillPlot;
}): ReactElement {
  return (
    <>
      {[...needs].flatMap(([kind, paints]) =>
        [...paints].map((paint) => (
          <Fill
            key={fillId(prefix, kind, paint)}
            id={fillId(prefix, kind, paint)}
            kind={kind}
            paint={paint}
            plot={plot}
          />
        ))
      )}
    </>
  );
}

/**
 * The two role-list gradients of a series, from the bar's tip, the list's first role, to its base.
 * A negative bar's tip is its far end below zero, so it takes the reversed one.
 *
 * @param props - The id prefix, the colour stops and the orientation.
 * @returns The gradients, for a `defs` element.
 */
export function ListFills({
  prefix,
  stops,
  orientation,
}: {
  readonly prefix: string;
  readonly stops: readonly string[];
  readonly orientation: "vertical" | "horizontal";
}): ReactElement {
  const vertical = orientation === "vertical";
  // Each direction runs from the tip of a bar of that sign to its base.
  const directions = [
    ["positive", vertical ? [0, 0, 0, 1] : [1, 0, 0, 0]],
    ["negative", vertical ? [0, 1, 0, 0] : [0, 0, 1, 0]],
  ] as const;
  return (
    <>
      {directions.map(([sign, [x1, y1, x2, y2]]) => (
        <linearGradient key={sign} id={`${prefix}-list-${sign}`} x1={x1} y1={y1} x2={x2} y2={y2}>
          {stops.map((stop, index) => (
            <stop
              // The roles never reorder, so the position is the stop's identity.
              key={index}
              offset={stops.length === 1 ? 0 : index / (stops.length - 1)}
              style={{ "--chart-stop": stop }}
            />
          ))}
        </linearGradient>
      ))}
    </>
  );
}

Object.assign(BarFills, { displayName: "Chart.Bar.Fills" });
Object.assign(ListFills, { displayName: "Chart.Bar.ListFills" });
