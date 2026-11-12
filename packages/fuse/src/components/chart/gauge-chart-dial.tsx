"use client";

/**
 * What a gauge's track, fill and glow draw alike: the notches, every one the same path turned to its
 * place, and the solid band along the sweep. Each layer is an SVG over the cell in the sweep's box,
 * whose dial group the stylesheet scales in by the room the rim layers take. The Root's frame lays
 * the notches out again for the measured dial, so every gap is the same whole number of device
 * pixels, and lights them as the reading's offset passes each one.
 */
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { writeAttribute } from "./chart-dom";
import { useGaugeContext } from "./chart-gauge-context";
import type { GaugeContextValue } from "./chart-gauge-context";
import type { GaugePainter } from "./chart-gauge-frame";
import type { ChartLayerProps } from "./chart-types";
import { arcPath } from "./layout/arc-path";
import {
  GAUGE_NOTCHES,
  GAUGE_RADII,
  gaugeAngle,
  litNotches,
  NOMINAL_PIXELS,
  notchCentre,
  notchLayout,
} from "./layout/gauge";
import type { DialPixels, NotchLayout } from "./layout/gauge";
import { toDegrees, viewBoxOf } from "./layout/polar-angle";
import type { Sweep } from "./layout/polar-angle";
import { pathNumber } from "./layout/rounding";

/** A band along the sweep: its inner and outer radius and the corner its ends round by. */
export type GaugeBand = { readonly inner: number; readonly outer: number; readonly corner: number };

/** The solid band, from its inner radius to the rim, its ends rounded by a quarter of its width. */
const SOLID: GaugeBand = {
  inner: GAUGE_RADII.solidInner,
  outer: 1,
  corner: (1 - GAUGE_RADII.solidInner) / 4,
};

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

/**
 * The path of a band from the sweep's start to an offset: a sector of the annulus whose ends are
 * radial lines on the two angles, their corners rounded inside them, so the band ends on the
 * reading's angle at every radius, as the needle, the notches and the sector do. A round cap would
 * end there on the band's centre line only, and short of it at its edges. Any offset above 0 keeps
 * one device pixel of arc at the rim.
 *
 * @param offset - The offset in degrees from the sweep's start.
 * @param band - The band's radii and corner.
 * @param sweep - The sweep.
 * @param pixels - The measured dial, or null where nothing measures, as on the server.
 * @returns The path data, empty at an offset of 0.
 */
export function bandPath(offset: number, band: GaugeBand, sweep: Sweep, pixels: DialPixels | null): string {
  if (!(offset > 0)) return "";
  const rim = band.outer * (pixels?.scale ?? 0) * (pixels?.dpr ?? 0);
  const least = rim > 0 ? toDegrees(1 / rim) : 0;
  return arcPath({
    innerRadius: band.inner,
    outerRadius: band.outer,
    startAngle: sweep.start,
    endAngle: gaugeAngle(sweep, Math.min(sweep.width, Math.max(offset, least))),
    cornerRadius: band.corner,
  });
}

/** What a dial layer draws its notches and band as: all of them, or as far as the reading reaches. */
type DialReach = "track" | "reading";

/**
 * Register a dial layer's notches and band with the Root's frame, which lays them out for the
 * measured dial and, for a layer that follows the reading, lights the notches and stretches the
 * band to the offset the loop shows.
 */
function useDialPainter(
  gauge: GaugeContextValue,
  group: { readonly current: SVGGElement | null },
  reach: DialReach
): void {
  const { frame, model } = gauge;
  const { sweep } = model;
  useLayoutEffect(() => {
    const node = group.current;
    if (node === null) return undefined;
    const notches = [...node.querySelectorAll(":scope > [data-part='notches'] > path")];
    const band = node.querySelector(":scope > [data-part='solid']");
    let pixels: DialPixels | null = null;
    const painter: GaugePainter = {
      layout: (measured) => {
        pixels = measured;
        const layout = notchLayout(sweep, notches.length, measured);
        const path = notchPath(layout);
        notches.forEach((notch, index) => {
          writeAttribute(notch, "d", path);
          writeAttribute(notch, "transform", notchTurn(sweep, layout, index));
        });
        if (reach === "track" && band !== null)
          writeAttribute(band, "d", bandPath(sweep.width, SOLID, sweep, measured));
      },
      paint: (share) => {
        const offset = share * sweep.width;
        if (reach === "track") return;
        const lit = litNotches(offset, sweep.width, notches.length);
        notches.forEach((notch, index) => {
          writeAttribute(notch, "data-lit", index < lit ? "" : null);
        });
        if (band !== null) writeAttribute(band, "d", bandPath(offset, SOLID, sweep, pixels));
      },
    };
    return frame.register(painter);
  }, [frame, sweep, group, reach]);
}

/** Props of one dial layer. */
type DialLayerProps = ChartLayerProps & {
  /** The layer's slot. */
  readonly slot: "gauge-chart-track" | "gauge-chart-fill" | "gauge-chart-glow";
  /** Whether the layer draws the whole track or follows the reading. */
  readonly reach: DialReach;
  /** The layer's own attributes, such as the Track's variant. */
  readonly attributes?: Readonly<Record<`data-${string}`, string>>;
  /** Extra layer content in the dial group, before the notches. */
  readonly children?: ReactNode;
};

/**
 * One dial layer: the notches and the solid band, which the stylesheet shows one of by the Track's
 * variant. The server and the first render draw the nominal dial at the reading's rest, so the page
 * shows the reading with JavaScript off, and the frame takes over once Root measures.
 *
 * @param props - The layer's slot, its reach, its attributes and its class and style.
 * @returns The layer.
 */
export function GaugeDialLayer({
  slot,
  reach,
  attributes,
  className,
  style,
  children,
}: DialLayerProps): ReactElement {
  const gauge = useGaugeContext(
    slot === "gauge-chart-track"
      ? "GaugeChart.Track"
      : slot === "gauge-chart-fill"
        ? "GaugeChart.Fill"
        : "GaugeChart.Glow"
  );
  const { model } = gauge;
  const { sweep, box } = model;
  const group = useRef<SVGGElement>(null);
  useDialPainter(gauge, group, reach);
  // React writes the nominal dial at the reading's rest once, and the frame writes the measured dial
  // at the offset the loop shows from then on, so a commit never puts a sweep back to its rest.
  const [first] = useState(() => {
    const layout = notchLayout(sweep, GAUGE_NOTCHES, NOMINAL_PIXELS);
    const rest = model.reading.kind === "value" ? model.reading.offset : 0;
    return {
      path: notchPath(layout),
      turns: Array.from({ length: GAUGE_NOTCHES }, (_, index) => notchTurn(sweep, layout, index)),
      lit: reach === "track" ? 0 : litNotches(rest, sweep.width, GAUGE_NOTCHES),
      band: bandPath(reach === "track" ? sweep.width : rest, SOLID, sweep, null),
    };
  });
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
        {children}
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
