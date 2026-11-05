"use client";

/**
 * One pie's frame: the slices its loop draws, painted together. Each slice is a mark of its own on
 * the loop, so it can enter on its own stagger and leave as a ghost, but the rim floor (D24) takes
 * angle from the widest slice, so no one slice's writer can floor alone. While the loop writes a
 * batch, such as one frame's moving slices, each slice only records its angles, and once the batch
 * ends the frame floors every slice that stays, writes each path and each slice's pop, the unit
 * vector along its bisector scaled to `--chart-slice-pop`, in the dial's units. A slice that draws
 * outside a batch, as a commit's placements do, records too, and the frame paints in the next
 * microtask, before the browser paints. A leaving slice's ghost draws as it is, with no floor, as it
 * collapses to nothing. A mirror, such as `PieChart.Glow`'s halo, takes a slice's path and pop in
 * every frame, so it follows the slice with no writer of its own, and a listener, such as
 * `PieChart.Labels`, hears every slice's angles once each frame paints. One loop holds one pie's
 * frame, which the Pie, the Glow and the Labels reach through `pieFrameOf`.
 */
import { writeStyle } from "./chart-dom";
import type { ChartMotion, MarkValues } from "./chart-motion";
import { sharePainted } from "./chart-polar-painted";
import { arcPath } from "./layout/arc-path";
import { CHART_SPRINGS } from "./layout/motion";
import { floorSlices } from "./layout/pie";
import type { SliceAngles } from "./layout/pie";
import type { Sweep, SweepBox } from "./layout/polar-angle";
import { polarPoint } from "./layout/polar-angle";
import { springEasing } from "./layout/spring";

/** What every slice of a frame shares: the radii, the corner, the sweep and the measured scale. */
export type PieLook = {
  readonly innerRadius: number;
  /** The corner radius as a share of the outer radius. */
  readonly cornerRadius: number;
  /** The sweep the slices fill. */
  readonly sweep: Sweep;
  /** The whole sweep, which the Track fills with the slices' corners. */
  readonly track: Sweep;
};

/** What the frame measures from the pie's element: CSS pixels per unit, the pop, the seam and the dpr. */
export type PieMeasure = {
  readonly scale: number;
  readonly pop: number;
  readonly seam: number;
  readonly dpr: number;
};

/** One slice the frame holds: the node it paints, its angles this frame and its place in the sweep. */
type Entry = {
  readonly key: string;
  node: Element;
  start: number;
  end: number;
  pad: number;
  order: number;
  kind: "slice" | "ghost";
};

/** One pie's frame. */
export type PieFrame = {
  /**
   * Record a slice's angles for this frame, and have the frame paint it.
   *
   * @param key - The slice's key, or its ghost's.
   * @param node - The slice's path, or its ghost's.
   * @param values - Its start and end angles in degrees.
   * @param place - Its pad, its place in the sweep, and whether it is a slice or a leaving ghost.
   */
  readonly record: (
    key: string,
    node: Element,
    values: MarkValues,
    place: { readonly pad: number; readonly order: number; readonly kind: "slice" | "ghost" }
  ) => void;
  /** The angles a slice drew last, or null for one the frame does not hold. */
  readonly last: (key: string) => readonly [number, number] | null;
  /** Take the pie's look and its measurement, and paint every slice again. */
  readonly update: (look: PieLook, measure: PieMeasure | null) => void;
  /**
   * Paint the Track's path over the whole sweep, with the slices' corners.
   *
   * @returns The track's removal.
   */
  readonly track: (node: Element) => () => void;
  /**
   * Paint a node with a slice's path and pop in every frame.
   *
   * @returns The mirror's removal.
   */
  readonly mirror: (key: string, node: Element) => () => void;
  /**
   * Hear the angles every slice draws, floored, keyed by the slice's key, after each frame paints. A
   * slice that draws no arc this frame maps to null.
   *
   * @returns The listener's removal.
   */
  readonly listen: (listener: PieListener) => () => void;
  /**
   * Hear the loop's batches, so a frame's slices paint once together.
   *
   * @returns The frame's leave, as the pie unmounts.
   */
  readonly attach: () => () => void;
};

/** Hears a frame's slices, each key's angles as it painted them. */
export type PieListener = (drawn: ReadonlyMap<string, SliceAngles | null>) => void;

/** A number for a style, kept short. */
function short(value: number): string {
  return String(Math.round(value * 1e4) / 1e4);
}

/**
 * The frame of one pie on its Root's loop.
 *
 * @param motion - The Root's loop.
 * @param look - The pie's look as it first renders.
 * @returns The frame.
 */
export function createPieFrame(motion: ChartMotion, look: PieLook): PieFrame {
  const entries = new Map<string, Entry>();
  const mirrors = new Map<string, Set<Element>>();
  const tracks = new Set<Element>();
  const listeners = new Set<PieListener>();
  // The floored, unpopped angles each slice painted last, which the Root's pick reads (D24).
  const painted = new Map<string, SliceAngles | null>();
  sharePainted(motion, (key) => painted.get(key));
  let current = look;
  let measure: PieMeasure | null = null;
  let batching = 0;
  let queued = false;
  const paint = (): void => {
    queued = false;
    for (const [key, entry] of entries) if (!entry.node.isConnected) entries.delete(key);
    const ordered = [...entries.values()].sort((a, b) => a.order - b.order);
    const slices = ordered.filter((entry) => entry.kind === "slice");
    const raw = slices.map((entry): SliceAngles | null =>
      entry.start === entry.end ? null : { start: entry.start, end: entry.end, pad: entry.pad }
    );
    const floored =
      measure === null
        ? raw
        : floorSlices(raw, current.sweep, { radius: measure.scale, dpr: measure.dpr, seam: measure.seam });
    const angles = new Map<Entry, SliceAngles | null>(
      slices.map((entry, index) => [entry, floored[index] ?? null])
    );
    painted.clear();
    slices.forEach((entry, index) => painted.set(entry.key, floored[index] ?? null));
    const reach = measure === null || !(measure.scale > 0) ? 0 : measure.pop / measure.scale;
    for (const [key, entry] of entries) {
      const slice =
        entry.kind === "ghost" ? { start: entry.start, end: entry.end, pad: entry.pad } : angles.get(entry);
      const d =
        slice === null || slice === undefined || slice.start === slice.end
          ? ""
          : arcPath({
              innerRadius: current.innerRadius,
              outerRadius: 1,
              startAngle: slice.start,
              endAngle: slice.end,
              padAngle: slice.pad,
              cornerRadius: current.cornerRadius,
            });
      // The pop moves the slice its pop's CSS pixels along its bisector, in the dial's units.
      const way =
        slice === null || slice === undefined ? null : polarPoint((slice.start + slice.end) / 2, reach);
      const targets = entry.kind === "ghost" ? [entry.node] : [entry.node, ...(mirrors.get(key) ?? [])];
      for (const node of targets) {
        node.setAttribute("d", d);
        if (entry.kind === "slice" && way !== null && node instanceof SVGElement) {
          writeStyle(node, "--_px", short(way.x));
          writeStyle(node, "--_py", short(way.y));
        }
      }
    }
    if (listeners.size === 0) return;
    const drawn = new Map(slices.map((entry, index) => [entry.key, floored[index] ?? null]));
    for (const listener of listeners) listener(drawn);
  };
  const paintTracks = (): void => {
    const d = arcPath({
      innerRadius: current.innerRadius,
      outerRadius: 1,
      startAngle: current.track.start,
      endAngle: current.track.end,
      cornerRadius: current.cornerRadius,
    });
    for (const node of tracks) node.setAttribute("d", d);
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
      const [start = 0, end = start] = values;
      const known = entries.get(key);
      if (known === undefined) entries.set(key, { key, node, start, end, ...place });
      else Object.assign(known, { node, start, end, ...place });
      schedule();
    },
    last: (key) => {
      const entry = entries.get(key);
      return entry === undefined ? null : [entry.start, entry.end];
    },
    update: (look, measured) => {
      current = look;
      measure = measured;
      paintTracks();
      schedule();
    },
    track: (node) => {
      tracks.add(node);
      paintTracks();
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
    listen: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    attach: () => {
      batching = 0;
      return motion.batches(party);
    },
  };
}

const frames = new WeakMap<ChartMotion, PieFrame>();

/**
 * The pie's frame on a Root's loop, made on first use.
 *
 * @param motion - The Root's loop.
 * @param look - The pie's look, for a frame made here.
 * @returns The frame.
 */
export function pieFrameOf(motion: ChartMotion, look: PieLook): PieFrame {
  const known = frames.get(motion);
  if (known !== undefined) return known;
  const made = createPieFrame(motion, look);
  frames.set(motion, made);
  return made;
}

/**
 * The viewBox of a sweep's box, which every polar layer draws in.
 *
 * @param box - The sweep's box, in units of the outer radius.
 * @returns The viewBox attribute.
 */
export function viewBoxOf(box: SweepBox): string {
  return `${String(box.left)} ${String(box.top)} ${String(box.right - box.left)} ${String(box.bottom - box.top)}`;
}

const POP = springEasing(CHART_SPRINGS.pop);

/** The pop's spring (D3) duration, which a slice's layer carries for the stylesheet's pop transition. */
export const POP_DURATION = `${String(POP.duration)}ms`;

/** The pop's spring (D3) as a `linear()` easing, sampled once. */
export const POP_EASING = POP.easing;
