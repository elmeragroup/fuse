/**
 * Root's one animation loop, after `.scratch/charts-v1/reviews/motion-decision.md`. A mark hands
 * its final numbers to `place` in a layout effect, before the browser paints, and the loop writes
 * them to the DOM, at once or frame by frame. A tween rewinds the mark to what it last drew and walks it to
 * the target in requestAnimationFrame, writing attributes straight to the DOM, so React commits
 * nothing while marks move. A second update during a tween starts from the drawn numbers, so the
 * mark continues without a jump.
 */
import { cubicBezier } from "./layout/ease";
import { CHART_UPDATE_CURVE, CHART_UPDATE_MS } from "./layout/motion";

/** A mark's drawn numbers in a fixed order, such as a bar's x, y, width and height. */
export type MarkValues = readonly number[];

/** Writes a mark's numbers to its DOM nodes. */
export type MarkWriter = (values: MarkValues) => void;

/**
 * What one of a mark's numbers measures: CSS pixels from the plot's left edge, "x", or from its top
 * edge, "y", or a size the plot's box does not scale, such as a seam, a weight or a rule's width.
 */
export type ValueAxis = "x" | "y" | "size";

/**
 * How a resize scales the plot's box: its new width over its old, and its new height over its old,
 * and the new measurement, which names the resize, so the loop maps its marks once for each.
 */
export type PlotScale = { readonly x: number; readonly y: number; readonly to?: object };

/** The scale of a commit that leaves the plot's box alone. */
export const SAME_PLOT: PlotScale = { x: 1, y: 1 };

/**
 * How a mark reaches its target. "snap" draws it at once, as a pointer step, a range step and
 * reduced motion do. "move" tweens from what the mark last drew, as a data update does, and
 * restarts every other running tween with it. "settle" retargets a running tween on its own clock
 * and otherwise snaps, as a resize or a re-render does, so a box that resizes during an update never
 * cuts the update short. It carries the resize's scale, which maps every running tween into the new
 * box, so each mark keeps its place on the axes. "enter" tweens from a start of its own after a
 * delay, as the entrance wipe does. "join" takes the running tween of the mark at an anchor, as a
 * follower stepping onto a bar mid-update does, so it draws that bar's numbers in every frame, and
 * snaps when that bar rests.
 */
export type Placement =
  | { readonly kind: "snap" }
  | { readonly kind: "move" }
  | { readonly kind: "settle"; readonly scale: PlotScale }
  | {
      readonly kind: "join";
      /** The anchor the joined mark placed itself under. */
      readonly anchor: string;
      /** The follower's numbers from the joined mark's. */
      readonly pick: (values: MarkValues) => MarkValues;
    }
  | { readonly kind: "enter"; readonly from: MarkValues; readonly delay: number };

/** What the loop needs from its host, so a test can drive it frame by frame. */
export type MotionHost = {
  readonly now: () => number;
  readonly requestFrame: (callback: (time: number) => void) => number;
  readonly cancelFrame: (handle: number) => void;
};

/** Root's animation loop. */
export type ChartMotion = {
  /**
   * Draw a mark at its target. The mark's id stays the same across renders, so a later placement
   * finds what it drew.
   */
  readonly place: (
    id: string,
    target: MarkValues,
    write: MarkWriter,
    placement: Placement,
    axes?: readonly ValueAxis[],
    anchor?: string
  ) => void;
  /** Forget a mark that left the plot. */
  readonly forget: (id: string) => void;
  /** Draw every moving mark at its target at once, as a range step does. */
  readonly finish: () => void;
  /** Follow the reader's motion preference. Reduced motion snaps every placement. */
  readonly setReduced: (reduced: boolean) => void;
  /** How many marks the loop holds, which falls back as marks unmount. */
  readonly size: () => number;
  /** Whether any mark still tweens, so the baseline and every other coordinate may be moving. */
  readonly running: () => boolean;
};

type Tween = {
  readonly from: MarkValues;
  readonly to: MarkValues;
  readonly start: number;
  readonly delay: number;
};

/**
 * A mark's last drawn numbers, the eased progress they were drawn at, its running tween, and what
 * each of its numbers measures.
 */
type Mark = {
  drawn: MarkValues;
  eased: number;
  write: MarkWriter;
  tween: Tween | null;
  axes: readonly ValueAxis[];
};

const ease = cubicBezier(CHART_UPDATE_CURVE);

/** Whether two lists hold the same numbers. */
function same(a: MarkValues, b: MarkValues): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Map a mark's numbers into a resized box. Every number is a pixel from the plot's left or top edge
 * or a size, and the scales map pixels from an edge affinely, so a tween mapped this way draws in
 * every frame what the old tween drew, mapped: interpolation commutes with an affine map.
 */
function rescaled(values: MarkValues, axes: readonly ValueAxis[], scale: PlotScale): MarkValues {
  return values.map((value, index) => {
    const axis = axes[index] ?? "size";
    return axis === "size" ? value : value * scale[axis];
  });
}

/** Whether two numbers agree to within float error, as a mapped target and a fresh one do. */
function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * The start a tween needs to reach a new target on its own clock, passing through what it drew at
 * the eased progress it drew it at: `drawn = from + (to - from) * eased`, solved for `from`. The
 * tween, which a resize has already mapped into the commit's box, keeps every number whose target
 * is its mapped target, so marks with equal numbers keep drawing equal numbers. A number the tween
 * wasn't moving starts at a new target of its own, as a mark at rest snaps there.
 */
function retargeted(tween: Tween, drawn: MarkValues, target: MarkValues, eased: number): MarkValues {
  return target.map((to, index) => {
    const start = tween.from[index] ?? to;
    const end = tween.to[index] ?? to;
    if (close(to, end)) return start;
    if (start === end) return to;
    return ((drawn[index] ?? to) - to * eased) / (1 - eased);
  });
}

/**
 * Create a Root's animation loop. The marks move as one group. Every mark a commit places starts
 * on one clock, a data update restarts every running tween together from what it drew, and a
 * resize retargets running tweens on the clock they share, so marks with equal numbers, such as a
 * bar's top and a guide at its value, draw equal numbers in every frame.
 *
 * @param host - The clock and the frame scheduler.
 * @param reducedAtStart - Whether the reader asked for reduced motion when Root mounted.
 * @returns The loop.
 */
export function createChartMotion(host: MotionHost, reducedAtStart = false): ChartMotion {
  const marks = new Map<string, Mark>();
  // The mark each anchor names, such as a bar at its series and slot, which a follower can join.
  const anchors = new Map<string, string>();
  let handle: number | null = null;
  let reduced = reducedAtStart;
  // The commit's instant holds until the next frame or the end of the task, so every placement of
  // one commit reads it.
  let commitTime: number | null = null;
  // The commit whose data update last restarted the group.
  let restartedAt: number | null = null;
  // The measurement the group was last mapped into, or the commit that mapped it.
  let rescaledFor: object | number | null = null;
  const startTime = (): number => {
    if (commitTime === null) {
      commitTime = host.now();
      queueMicrotask(() => {
        commitTime = null;
      });
    }
    return commitTime;
  };

  const step = (time: number): void => {
    handle = null;
    commitTime = null;
    let running = false;
    for (const mark of marks.values()) {
      const tween = mark.tween;
      if (tween === null) continue;
      const progress = Math.min(1, Math.max(0, (time - tween.start - tween.delay) / CHART_UPDATE_MS));
      mark.eased = progress >= 1 ? 1 : ease(progress);
      // The last frame writes the target itself, so the DOM ends on the numbers React rendered.
      mark.drawn =
        progress >= 1
          ? tween.to
          : tween.to.map((to, index) => {
              const from = tween.from[index] ?? to;
              return from + (to - from) * mark.eased;
            });
      mark.write(mark.drawn);
      if (progress < 1) running = true;
      else mark.tween = null;
    }
    if (running) handle = host.requestFrame(step);
  };

  /** Draw a mark at its target at once. */
  const snap = (id: string, target: MarkValues, write: MarkWriter, axes: readonly ValueAxis[]): void => {
    marks.set(id, { drawn: target, eased: 1, write, tween: null, axes });
    // A follower's geometry never comes from React, and a tween may have left a bar between two
    // values, so a snap always writes.
    write(target);
  };

  /** Start a tween and draw its first numbers before the browser paints. */
  const run = (id: string, write: MarkWriter, tween: Tween, axes: readonly ValueAxis[]): void => {
    marks.set(id, { drawn: tween.from, eased: 0, write, tween, axes });
    write(tween.from);
    handle ??= host.requestFrame(step);
  };

  return {
    place(id, target, write, placement, axes = [], anchor) {
      if (anchor !== undefined) anchors.set(anchor, id);
      if (reduced || placement.kind === "snap") {
        snap(id, target, write, axes);
        return;
      }
      if (placement.kind === "join") {
        // A follower joins the running tween of the mark at its anchor, on that mark's clock, from
        // and to that mark's numbers, so the two draw alike in every frame. A resting mark, or none,
        // leaves the follower to snap.
        const leadId = anchors.get(placement.anchor);
        const lead = leadId === undefined ? undefined : marks.get(leadId);
        const tween = lead?.tween ?? null;
        if (lead === undefined || tween === null) {
          snap(id, target, write, axes);
          return;
        }
        const drawn = placement.pick(lead.drawn);
        const joined = { ...tween, from: placement.pick(tween.from), to: target };
        marks.set(id, { drawn, eased: lead.eased, write, tween: joined, axes });
        write(drawn);
        handle ??= host.requestFrame(step);
        return;
      }
      if (placement.kind === "settle" && (placement.scale.x !== 1 || placement.scale.y !== 1)) {
        // A resize maps every running tween into the new box once, when the first mark of its
        // measurement settles, and redraws it there before the browser paints, so every mark stays
        // on the axes, marks this commit leaves alone among them. The tweens keep their clock. Two
        // resizes in one task are two measurements, so each maps the group.
        const resize = placement.scale.to ?? startTime();
        if (rescaledFor !== resize) {
          rescaledFor = resize;
          for (const running of marks.values()) {
            if (running.tween === null) continue;
            const { axes: kinds, tween } = running;
            const { scale } = placement;
            running.tween = {
              ...tween,
              from: rescaled(tween.from, kinds, scale),
              to: rescaled(tween.to, kinds, scale),
            };
            running.drawn = rescaled(running.drawn, kinds, scale);
            running.write(running.drawn);
          }
        }
      }
      if (placement.kind === "move") {
        // A data update restarts every running tween with it, from what each drew, so the group
        // keeps one progress, marks this commit leaves alone among them.
        const start = startTime();
        if (restartedAt !== start) {
          restartedAt = start;
          for (const mark of marks.values()) {
            if (mark.tween === null) continue;
            mark.tween = { from: mark.drawn, to: mark.tween.to, start, delay: 0 };
            mark.eased = 0;
          }
        }
      }
      const mark = marks.get(id);
      const tween = mark?.tween ?? null;
      if (mark !== undefined && tween !== null && same(tween.to, target)) {
        // The mark already heads for this target, so the tween runs on. A re-render or a new node
        // may have drawn the target meanwhile, so the mark redraws where the tween has it.
        mark.write = write;
        write(mark.drawn);
        return;
      }
      if (placement.kind === "enter") {
        const tween = { from: placement.from, to: target, start: startTime(), delay: placement.delay };
        run(id, write, tween, axes);
        return;
      }
      if (mark === undefined || mark.drawn.length !== target.length || same(mark.drawn, target)) {
        snap(id, target, write, axes);
        return;
      }
      if (placement.kind === "move") {
        run(id, write, { from: mark.drawn, to: target, start: startTime(), delay: 0 }, axes);
        return;
      }
      // A resize retargets a running tween on its own clock, so the mark keeps the progress it
      // shares with every other mark. Without a running tween, or at its very end, it snaps.
      if (tween === null || 1 - mark.eased < 1e-6) {
        snap(id, target, write, axes);
        return;
      }
      // The tween, already mapped into the commit's box with its group, retargets.
      const from = retargeted(tween, mark.drawn, target, mark.eased);
      mark.axes = axes;
      mark.tween = { ...tween, from, to: target };
      // The numbers redraw where the mapped tween has them, and the numbers the tween wasn't moving
      // at targets of their own, before the browser paints.
      mark.drawn = target.map((to, index) => (from[index] ?? to) + (to - (from[index] ?? to)) * mark.eased);
      mark.write = write;
      write(mark.drawn);
    },
    forget(id) {
      marks.delete(id);
      for (const [anchor, named] of anchors) if (named === id) anchors.delete(anchor);
      if (handle !== null && ![...marks.values()].some((mark) => mark.tween !== null)) {
        host.cancelFrame(handle);
        handle = null;
      }
    },
    finish() {
      for (const mark of marks.values()) {
        if (mark.tween === null) continue;
        mark.drawn = mark.tween.to;
        mark.eased = 1;
        mark.tween = null;
        mark.write(mark.drawn);
      }
      if (handle !== null) host.cancelFrame(handle);
      handle = null;
    },
    setReduced(value) {
      reduced = value;
      if (value) this.finish();
    },
    size: () => marks.size,
    running: () => [...marks.values()].some((mark) => mark.tween !== null),
  };
}
