"use client";

/**
 * How a gauge part draws on its Root's frame. A part hands over its drawing once per layout, keyed
 * on the geometry it lays out from, so a new reading, which leaves the geometry as it is, never
 * registers a part again. The hook owns the registration and turns the loop's share into the offset
 * along the sweep every part draws at, and the part's first render reads the reading's rest from
 * it, so the server and a page with JavaScript off show the reading.
 */
import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { writeAttribute } from "./chart-dom";
import type { GaugeContextValue } from "./chart-gauge-context";
import { reached } from "./layout/gauge";
import type { DialPixels } from "./layout/gauge";
import type { Sweep } from "./layout/polar-angle";

/** A part's drawing on the frame: its layout for a measured dial, its paint for an offset, or both. */
export type GaugeDrawing = {
  /** Lay the part out again for a new measurement, before it paints. */
  readonly layout?: (pixels: DialPixels) => void;
  /** Draw the reading at an offset in degrees from the sweep's start, as the loop shows it now. */
  readonly paint?: (offset: number) => void;
};

/**
 * Register a part's drawing with its Root's frame for as long as the part shows the same layout.
 *
 * @param gauge - The Root's context.
 * @param ref - The node the part draws into.
 * @param source - What the part lays out from, its sweep among it, memoised so a new reading keeps
 *   it.
 * @param draw - The part's drawing for its node and layout.
 * @returns The reading's offset at rest when the part first rendered, which its markup draws at.
 */
export function useGaugePainter<T extends Element, L extends { readonly sweep: Sweep }>(
  gauge: GaugeContextValue,
  ref: RefObject<T | null>,
  source: L,
  draw: (node: T, source: L) => GaugeDrawing
): number {
  const { frame } = gauge;
  const latest = useRef(draw);
  useLayoutEffect(() => {
    latest.current = draw;
  });
  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) return undefined;
    const { layout, paint } = latest.current(node, source);
    const { sweep } = source;
    return frame.register({
      layout,
      paint:
        paint === undefined
          ? undefined
          : (share) => {
              paint(share * sweep.width);
            },
    });
  }, [frame, ref, source]);
  // React writes the part at the reading's rest once, and the frame writes it from then on, so a
  // commit never puts a sweep back to its rest.
  const [rest] = useState(() => gauge.model.rest * source.sweep.width);
  return rest;
}

/** A mark the reading lights once it reaches it: its node and its offset along the sweep. */
export type ReachedMark = { readonly node: Element; readonly offset: number };

/**
 * Mark every mark the reading has reached with an attribute, and clear it from the rest, as the
 * ruler's ticks and the dots light.
 *
 * @param marks - The marks.
 * @param attribute - The attribute a reached mark carries.
 * @param offset - The offset the dial shows.
 */
export function lightReached(
  marks: readonly ReachedMark[],
  attribute: `data-${string}`,
  offset: number
): void {
  for (const mark of marks) writeAttribute(mark.node, attribute, reached(mark.offset, offset) ? "" : null);
}
