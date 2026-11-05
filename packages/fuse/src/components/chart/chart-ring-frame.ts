"use client";

/**
 * One radial chart's frame: every ring, track and halo its loop paints, with the measured scale,
 * device pixel ratio and `--chart-ring-fill` they all share. A ring is a stroked centre line over
 * the whole sweep whose `pathLength` is the sweep's width in degrees, and its value is the dash
 * (Q5): round caps sit inside the value's angle, an arc shorter than its stroke draws butt caps at
 * its true length, and every value above 0 keeps one device pixel of arc along its centre line
 * (D24). A dotted ring fills whole dots, `round(40 · share)` of them and at least one above 0,
 * through a mask whose dash carries that count (Q12). Each ring records its angle in a frame, and
 * the frame paints it in the next microtask outside a batch, or once the batch ends, as the pie's
 * does. One loop holds one radial frame, which Bar, Track and Glow reach through `ringFrameOf`.
 */
import { writeAttribute } from "./chart-dom";
import type { ChartMotion, MarkValues } from "./chart-motion";
import type { Sweep } from "./layout/polar-angle";
import { ringStroke } from "./layout/rings";

/** How many dots a dotted ring holds over its sweep (Q12). */
export const RING_DOTS = 40;

/** A dash long enough to cover any sweep, in the sweep's degrees. */
const GAP = 1e4;

/** What the frame measures from the chart: CSS pixels per unit, the dpr and the ring fill. */
export type RingMeasure = { readonly scale: number; readonly dpr: number; readonly fill: number };

/** How one ring or track paints: a dash along its sweep, or a count of whole dots. */
export type RingMode = "dash" | "dots";

/** A ring's place: its centre line's radius and its band, the space its stroke and gap share. */
export type RingPlace = { readonly radius: number; readonly band: number; readonly mode: RingMode };

/** The dash attributes that draw an angle along a ring. */
export type RingDash = {
  readonly dasharray: string;
  readonly dashoffset: string;
  readonly linecap: "round" | "butt";
};

/**
 * The dash that draws an angle along a ring of the sweep.
 *
 * @param angle - The filled angle in degrees.
 * @param place - The ring's radius and band, and whether it fills whole dots.
 * @param sweep - The sweep.
 * @param measure - The scale, the dpr and the fill, or null where nothing measures, as on the
 *   server, which reads the default fill and keeps no pixel floor.
 * @returns The dash.
 */
export function ringDash(
  angle: number,
  place: RingPlace,
  sweep: Sweep,
  measure: RingMeasure | null
): RingDash {
  if (place.mode === "dots") {
    const cell = sweep.width / RING_DOTS;
    // A value above 0 keeps one whole dot, as a dashed ring keeps a device pixel (D24).
    const share = Math.round((RING_DOTS * Math.min(angle, sweep.width)) / sweep.width);
    const dots = angle > 0 ? Math.max(1, share) : 0;
    return { dasharray: `${short(dots * cell)} ${String(GAP)}`, dashoffset: "0", linecap: "butt" };
  }
  const fill = measure?.fill ?? 0.7;
  const scale = measure?.scale ?? 1;
  const stroke = ringStroke(angle, {
    radius: place.radius * scale,
    width: place.band * fill * scale,
    dpr: measure?.dpr ?? 0,
  });
  if (stroke.cap === "none") return { dasharray: `0 ${String(GAP)}`, dashoffset: "0", linecap: "butt" };
  return {
    dasharray: `${short(stroke.length)} ${String(GAP)}`,
    dashoffset: short(-stroke.start),
    linecap: stroke.cap,
  };
}

/** A number for an attribute, kept short. */
function short(value: number): string {
  return String(Math.round(value * 1e4) / 1e4);
}

/** Write a dash onto a ring's path. */
function writeDash(node: Element, dash: RingDash): void {
  writeAttribute(node, "stroke-dasharray", dash.dasharray);
  writeAttribute(node, "stroke-dashoffset", dash.dashoffset);
  writeAttribute(node, "stroke-linecap", dash.linecap);
}

/** One radial chart's frame. */
export type RingFrame = {
  /**
   * Record a ring's angle for this frame, and have the frame paint it.
   *
   * @param key - The ring's key.
   * @param node - The path its dash draws on: the ring, or the mask that reveals its paint.
   * @param values - Its filled angle in degrees.
   * @param place - Its radius, its band and its mode.
   */
  readonly record: (key: string, node: Element, values: MarkValues, place: RingPlace) => void;
  /**
   * Paint a track: a ring's whole sweep, with the ring's caps.
   *
   * @returns The track's removal.
   */
  readonly track: (node: Element, place: RingPlace) => () => void;
  /**
   * Paint a node with a ring's dash in every frame, as Glow's halo does.
   *
   * @returns The mirror's removal.
   */
  readonly mirror: (key: string, node: Element) => () => void;
  /** Take the sweep and the measurement, and paint every ring again. */
  readonly update: (sweep: Sweep, measure: RingMeasure | null) => void;
  /**
   * Hear the loop's batches, so a frame's rings paint once together.
   *
   * @returns The frame's leave.
   */
  readonly attach: () => () => void;
};

/**
 * The frame of one radial chart on its Root's loop.
 *
 * @param motion - The Root's loop.
 * @param sweep - The chart's sweep as it first renders.
 * @returns The frame.
 */
export function createRingFrame(motion: ChartMotion, sweep: Sweep): RingFrame {
  const rings = new Map<string, { node: Element; angle: number; place: RingPlace }>();
  const tracks = new Map<Element, RingPlace>();
  const mirrors = new Map<string, Set<Element>>();
  let current = sweep;
  let measure: RingMeasure | null = null;
  let batching = 0;
  let queued = false;
  const paint = (): void => {
    queued = false;
    for (const [key, ring] of rings) {
      if (!ring.node.isConnected) {
        rings.delete(key);
        continue;
      }
      const dash = ringDash(ring.angle, ring.place, current, measure);
      writeDash(ring.node, dash);
      for (const mirror of mirrors.get(key) ?? [])
        writeDash(mirror, ringDash(ring.angle, { ...ring.place, mode: "dash" }, current, measure));
    }
    for (const [node, place] of tracks) writeDash(node, ringDash(current.width, place, current, measure));
  };
  const schedule = (): void => {
    if (batching > 0 || queued) return;
    queued = true;
    queueMicrotask(paint);
  };
  const party = {
    begin: () => {
      batching += 1;
    },
    end: () => {
      batching -= 1;
      if (batching === 0 && !queued) paint();
    },
  };
  return {
    record: (key, node, values, place) => {
      rings.set(key, { node, angle: values[0] ?? 0, place });
      schedule();
    },
    track: (node, place) => {
      tracks.set(node, place);
      schedule();
      return () => {
        tracks.delete(node);
      };
    },
    mirror: (key, node) => {
      const known = mirrors.get(key) ?? new Set<Element>();
      known.add(node);
      mirrors.set(key, known);
      schedule();
      return () => {
        known.delete(node);
      };
    },
    update: (next, measured) => {
      current = next;
      measure = measured;
      schedule();
    },
    attach: () => {
      batching = 0;
      return motion.batches(party);
    },
  };
}

const frames = new WeakMap<ChartMotion, RingFrame>();

/**
 * The radial chart's frame on a Root's loop, made on first use.
 *
 * @param motion - The Root's loop.
 * @param sweep - The sweep, for a frame made here.
 * @returns The frame.
 */
export function ringFrameOf(motion: ChartMotion, sweep: Sweep): RingFrame {
  const known = frames.get(motion);
  if (known !== undefined) return known;
  const made = createRingFrame(motion, sweep);
  frames.set(motion, made);
  return made;
}
