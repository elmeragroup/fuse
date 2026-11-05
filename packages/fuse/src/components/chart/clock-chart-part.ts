"use client";

/**
 * What every clock series part shares: the series a part names, its placement on the Root's loop
 * through the classifier, the slots a datum selects, the reveal and path writers, the value glow's
 * retuning, and the curve each Line registers for an ActiveDot.
 */
import { useLayoutEffect, useRef } from "react";

import { writeAttribute } from "./chart-dom";
import type { PATH_GLOW } from "./chart-glow-filter";
import type { ChartMotion, MarkValues, Placement } from "./chart-motion";
import { seriesPaintOf } from "./chart-paint";
import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ClockDrawing, ClockSeries, PolarContextValue } from "./chart-polar-context";
import type { usePolarCommit } from "./chart-polar-motion";
import { useChartReadout } from "./chart-readout";
import type { ChartCurve, ChartDatum, ChartX } from "./chart-types";
import { ownerSlot, revealPath } from "./layout/clock-path";
import { keywordSlots, listedSlots } from "./layout/datum";
import { ChartCompositionError } from "./layout/errors";

/** The dial's nominal radius in CSS pixels, half of the 12.5rem cell, which a value glow's blur reads. */
export const NOMINAL_RADIUS = 100;

/** The glow region of a dial: its whole box past the rim, in the dial's units. */
export const DIAL_REGION = { x: -1.5, y: -1.5, width: 3, height: 3, unit: NOMINAL_RADIUS } as const;

/**
 * The slots a datum selects on a clock: a keyword over a series' drawn values, or the slots holding
 * explicit instants, each resolved to the slot that owns its reading.
 *
 * @param clock - The clock's drawing.
 * @param part - The selecting part's display name, which an x of the wrong type names.
 * @param series - The series.
 * @param datum - A keyword or explicit x values.
 * @returns The selected slots, ascending.
 * @throws {ChartCompositionError} `x-type-mismatch` for an x string, since a dial reads instants.
 */
export function clockDatumSlots(
  clock: ClockDrawing,
  part: string,
  series: ClockSeries,
  datum: ChartDatum
): number[] {
  const window = clock.text.model.window;
  if (window === null) return [];
  // A slot a coarse reading covers selects the slot that owns the reading, where its wedge, its
  // vertex and its value sit, and a reading two selected slots share is selected once.
  const owned = (picked: readonly number[]): number[] =>
    [...new Set(picked.map((slot) => ownerSlot(series.slots.states, slot)))].toSorted((a, b) => a - b);
  if (datum === "first" || datum === "last" || datum === "min" || datum === "max" || datum === "now") {
    return owned(keywordSlots(datum, { values: series.values, window, nowSlot: clock.now?.slot ?? -1 }));
  }
  const xs: readonly ChartX[] = Array.isArray(datum.x) ? datum.x : [datum.x];
  return owned(
    listedSlots(
      xs.map((x) => {
        // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned union: an x is a string, a number or a Date
        if (typeof x === "string") {
          throw new ChartCompositionError(
            part,
            "x-type-mismatch",
            "received a string x on a clock dial. Pass a Date or epoch milliseconds, because a date-only string parses as UTC midnight and lands on the wrong day."
          );
        }
        return clock.slotOf(x);
      }),
      window
    )
  );
}

/** What a clock part reads of its Root: the polar context, the drawing and its series, if it exists. */
export type ClockPart = {
  readonly polar: PolarContextValue;
  readonly clock: ClockDrawing;
  readonly series: ClockSeries | undefined;
};

export function useClockSeries(part: string, dataKey: string): ClockPart {
  const polar = usePolarContext(part, ["clock"]);
  const readout = useChartReadout(part);
  readout.assertKey(part, dataKey);
  const clock = clockDrawingIn(polar.model, part);
  return { polar, clock, series: clock.series.find(({ key }) => key === dataKey) };
}

/**
 * The numbers a series' old slots draw in, paired with the new slots by their wall clock offsets
 * from the cycle's start, so a change of slot count tweens each slot from where it stood and the
 * dial turns. A slot with no old twin, as the repeated hour of a 25-hour day, opens from zero width
 * at the end of the slot before it, at that slot's base and tip.
 */
export function pairedFrom(
  previous: { readonly pairs: readonly string[]; readonly values: MarkValues },
  pairs: readonly string[]
): number[] {
  const at = new Map(previous.pairs.map((pair, slot) => [pair, slot]));
  const from: number[] = [previous.values[0] ?? 1];
  // The slot before, whose end angle, base and tip an unpaired slot opens from.
  let before: readonly [number, number, number] = [0, previous.values[3] ?? 0, previous.values[4] ?? 0];
  pairs.forEach((pair) => {
    const old = at.get(pair);
    if (old !== undefined) {
      const base = 1 + old * 4;
      const numbers = [
        previous.values[base] ?? 0,
        previous.values[base + 1] ?? 0,
        previous.values[base + 2] ?? 0,
        previous.values[base + 3] ?? 0,
      ];
      from.push(...numbers);
      before = [numbers[1] ?? 0, numbers[2] ?? 0, numbers[3] ?? 0];
      return;
    }
    const [end, base, tip] = before;
    from.push(end, end, base, tip);
  });
  return from;
}

/**
 * Place a series mark for a commit through the classifier: the entrance, an update, or a turn of
 * the dial when the slot count changes, along the route that pairs the old slots with the new.
 */
export function useClockPlacement(
  clock: ClockDrawing,
  series: ClockSeries | undefined,
  commit: ReturnType<typeof usePolarCommit>,
  place: (target: MarkValues, placement: Placement) => void
): void {
  const last = useRef<{ readonly pairs: readonly string[]; readonly values: MarkValues } | null>(null);
  useLayoutEffect(() => {
    if (series === undefined) return;
    const previous = last.current;
    last.current = { pairs: clock.pairs, values: series.rest };
    const turns = previous !== null && previous.pairs.length !== clock.pairs.length;
    const via = turns ? { from: pairedFrom(previous, clock.pairs), to: series.rest } : undefined;
    place(series.rest, commit(series.index, [0, ...series.rest.slice(1)], via));
  });
}

/** Write the entrance's open wedge onto a mark's clip path, or none once the dial is whole. */
export function writeReveal(group: SVGGElement, reveal: number): void {
  const clip = group.ownerSVGElement?.querySelector('[data-part="reveal"]');
  if (clip !== null && clip !== undefined) writeAttribute(clip, "d", revealPath(reveal));
  writeAttribute(group, "clip-path", reveal >= 360 ? null : (group.getAttribute("data-clip") ?? null));
}

/** Write each named path of a group from a map of paths by part. */
export function writeParts(group: SVGGElement, paths: ReadonlyMap<string, string>): void {
  for (const path of group.querySelectorAll("path[data-part]")) {
    const part = path.getAttribute("data-part");
    if (part === null || part === "reveal") continue;
    writeAttribute(path, "d", paths.get(part) ?? "");
  }
}

/** The series paint of a drawing's series, its config colour over its model. */
export function paintOf(clock: ClockDrawing, series: ClockSeries) {
  const model = clock.text.model.series.find(({ key }) => key === series.key);
  return seriesPaintOf(series.key, clock.text.config[series.key]?.color ?? "chart-1", model);
}

/** The group a wedge or a dot paints in: its step, and past or now under `data-fade="past"`. */
export function groupOf(series: ClockSeries, clock: ClockDrawing, slot: number): string {
  const past = clock.now !== null && slot < clock.now.slot ? "-past" : "";
  return `step-${String(series.stepAt[slot] ?? 0)}${past}`;
}

/**
 * Tune a value glow's blur to the dial as it draws: the halo's CSS pixels over the dial's pixels per
 * unit, and the filter's region past the dial by three of them.
 */
export function retuneGlow(svg: SVGSVGElement, unit: number, halo: typeof PATH_GLOW): void {
  if (!(unit > 0)) return;
  const deviation = halo.deviation / unit;
  const margin = 3 * deviation;
  for (const filter of svg.querySelectorAll("filter")) {
    writeAttribute(filter, "x", -1.5 - margin);
    writeAttribute(filter, "y", -1.5 - margin);
    writeAttribute(filter, "width", 3 + 2 * margin);
    writeAttribute(filter, "height", 3 + 2 * margin);
    const blur = filter.querySelector("feGaussianBlur");
    if (blur !== null) writeAttribute(blur, "stdDeviation", deviation);
  }
}

/** CSS pixels per unit of the outer radius, as the layer shows now. */
export function pixelsPerUnit(svg: SVGSVGElement, box: PolarContextValue["box"]): number {
  const width = box.right - box.left;
  return width > 0 ? svg.getBoundingClientRect().width / width : 0;
}

/** Each loop's Lines' curves by series, which an ActiveDot rides between slots. */
export const curves = new WeakMap<ChartMotion, Map<string, ChartCurve>>();

/** Note the curve a Line draws its series in, for as long as it is mounted. */
export function useLineCurve(motion: ChartMotion, key: string, curve: ChartCurve): void {
  useLayoutEffect(() => {
    const byKey = curves.get(motion) ?? new Map<string, ChartCurve>();
    curves.set(motion, byKey);
    byKey.set(key, curve);
    return () => {
      if (byKey.get(key) === curve) byKey.delete(key);
    };
  }, [motion, key, curve]);
}
