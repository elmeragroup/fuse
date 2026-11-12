"use client";

/**
 * What a gauge's track, fill and glow draw alike: the notches, every one the same path turned to its
 * place, and the solid band along the sweep. Each layer is an SVG over the cell in the sweep's box,
 * whose dial group the stylesheet scales in by the room the rim layers take. The Root's frame lays
 * the notches out again for the measured dial, so every gap is the same whole number of device
 * pixels, and lights them as the reading's offset passes each one.
 */
import { useMemo, useRef } from "react";
import type { ReactElement } from "react";

import { writeAttribute } from "./chart-dom";
import { useGaugeContext } from "./chart-gauge-context";
import type { GaugeGeometry } from "./chart-gauge-context";
import type { ChartLayerProps } from "./chart-types";
import { useGaugePainter } from "./gauge-chart-painter";
import type { GaugeDrawing } from "./gauge-chart-painter";
import { arcPath } from "./layout/arc-path";
import { bandPath, GAUGE_RADII, NOMINAL_PIXELS, notchCentre, notchLayout, rimBand } from "./layout/gauge";
import type { DialPixels, NotchLayout } from "./layout/gauge";
import { viewBoxOf } from "./layout/polar-angle";
import type { Sweep } from "./layout/polar-angle";
import { DIAL_MARKS, litMarks } from "./layout/rings";
import { pathNumber } from "./layout/rounding";

/** The solid band, from its inner radius to the rim. */
const SOLID = rimBand(GAUGE_RADII.solidInner);

/** The path every notch draws, centred on 12 o'clock, which each notch turns to its place. */
function notchPath(layout: NotchLayout): string {
  return arcPath({
    innerRadius: GAUGE_RADII.notchInner,
    outerRadius: 1,
    startAngle: -layout.width / 2,
    endAngle: layout.width / 2,
    cornerRadius: layout.corner,
  });
}

/** The turn that carries a notch from 12 o'clock to its place on the sweep. */
function notchTurn(sweep: Sweep, layout: NotchLayout, index: number): string {
  return `rotate(${pathNumber(sweep.start + notchCentre(layout, index) * sweep.direction)})`;
}

/** A dial layer's notches and band, as its group holds them. */
type DialNodes = { readonly notches: readonly Element[]; readonly band: Element | null };

/** The notches and the band in a dial layer's group. */
function dialNodes(group: SVGGElement): DialNodes {
  return {
    notches: [...group.querySelectorAll(":scope > [data-part='notches'] > path")],
    band: group.querySelector(":scope > [data-part='solid']"),
  };
}

/** Lay the notches out for a measured dial, every gap the same whole number of device pixels. */
function layNotches(notches: readonly Element[], sweep: Sweep, pixels: DialPixels): void {
  const layout = notchLayout(sweep, notches.length, pixels);
  const path = notchPath(layout);
  notches.forEach((notch, index) => {
    writeAttribute(notch, "d", path);
    writeAttribute(notch, "transform", notchTurn(sweep, layout, index));
  });
}

/** The track's drawing: every notch, and the band over the whole sweep, laid out for the dial. */
function trackDrawing(group: SVGGElement, { sweep }: GaugeGeometry): GaugeDrawing {
  const { notches, band } = dialNodes(group);
  return {
    layout: (pixels) => {
      layNotches(notches, sweep, pixels);
      if (band !== null) writeAttribute(band, "d", bandPath(sweep.width, SOLID, sweep, pixels));
    },
  };
}

/** A reading layer's drawing: the notches the offset passes lit, and the band up to it. */
function readingDrawing(group: SVGGElement, { sweep }: GaugeGeometry): GaugeDrawing {
  const { notches, band } = dialNodes(group);
  let measured: DialPixels | null = null;
  return {
    layout: (pixels) => {
      measured = pixels;
      layNotches(notches, sweep, pixels);
    },
    paint: (offset) => {
      const lit = litMarks(offset, sweep.width, notches.length);
      notches.forEach((notch, index) => {
        writeAttribute(notch, "data-lit", index < lit ? "" : null);
      });
      if (band !== null) writeAttribute(band, "d", bandPath(offset, SOLID, sweep, measured));
    },
  };
}

/** Props of one dial layer. */
type DialLayerProps = ChartLayerProps & {
  /** The part's display name, which a misplaced part's error names. */
  readonly part: "GaugeChart.Track" | "GaugeChart.Fill" | "GaugeChart.Glow";
  /** The layer's slot. */
  readonly slot: "gauge-chart-track" | "gauge-chart-fill" | "gauge-chart-glow";
  /** Whether the layer draws the whole track or follows the reading. */
  readonly reach: "track" | "reading";
  /** The layer's own attributes, such as the Track's variant. */
  readonly attributes?: Readonly<Record<`data-${string}`, string>>;
};

/**
 * One dial layer: the notches and the solid band, which the stylesheet shows one of by the Track's
 * variant. The server and the first render draw the nominal dial at the reading's rest, so the page
 * shows the reading with JavaScript off, and the frame takes over once Root measures.
 *
 * @param props - The layer's part, slot, reach, attributes, class and style.
 * @returns The layer.
 */
export function GaugeDialLayer({
  part,
  slot,
  reach,
  attributes,
  className,
  style,
}: DialLayerProps): ReactElement {
  const gauge = useGaugeContext(part);
  const { geometry } = gauge.model;
  const { sweep, box } = geometry;
  const group = useRef<SVGGElement>(null);
  const rest = useGaugePainter(gauge, group, geometry, reach === "track" ? trackDrawing : readingDrawing);
  // The markup keys on the geometry and the first rest alone, so a new reading writes nothing here.
  const first = useMemo(() => {
    const layout = notchLayout(sweep, DIAL_MARKS, NOMINAL_PIXELS);
    return {
      path: notchPath(layout),
      turns: Array.from({ length: DIAL_MARKS }, (_, index) => notchTurn(sweep, layout, index)),
      lit: reach === "track" ? 0 : litMarks(rest, sweep.width, DIAL_MARKS),
      band: bandPath(reach === "track" ? sweep.width : rest, SOLID, sweep, null),
    };
  }, [sweep, rest, reach]);
  return (
    <svg
      data-slot={slot}
      data-polar-layer=""
      data-polar-mark={reach === "reading" ? "" : undefined}
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={className}
      style={style}
      {...attributes}>
      <g ref={group} data-part="gauge-dial">
        <g data-part="notches">
          {first.turns.map((turn, index) => (
            <path
              key={index}
              data-slot="gauge-chart-notch"
              data-lit={index < first.lit ? "" : undefined}
              d={first.path}
              transform={turn}
            />
          ))}
        </g>
        <path data-part="solid" d={first.band} />
      </g>
    </svg>
  );
}

Object.assign(GaugeDialLayer, { displayName: "GaugeChart.DialLayer" });
