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
import { sameItems } from "./layout/same-items";

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
 * delay, as the entrance wipe does. "join" draws the follower from the marks at its leads' anchors,
 * as a follower stepping onto a bar mid-update does: in every frame the loop moves those marks
 * first, each on its own clock and delay, then writes the follower from what they drew, one lead's
 * numbers after another's, and when they all rest it rests. A join whose leads say how to
 * read their marks' rest rests where those marks rest, under reduced motion too, so a follower
 * lands on its bars inside a BarGroup's sub-band and never on a target it worked out apart from
 * them.
 */
export type Placement =
  | { readonly kind: "snap" }
  | {
      readonly kind: "move";
      /**
       * A path's own route to its resting target, when the two lists differ in length, as a line
       * that slides in a reading and slides the first one out does. The tween walks `from` to `to`,
       * one number per entry, and its last frame draws the resting target the mark placed.
       */
      readonly via?: { readonly from: MarkValues; readonly to: MarkValues };
    }
  | { readonly kind: "settle"; readonly scale: PlotScale }
  | { readonly kind: "join"; readonly leads: readonly JoinLead[] }
  | { readonly kind: "enter"; readonly from: MarkValues; readonly delay: number };

/**
 * One mark a follower joins. A lead either reads the follower's numbers from that mark's, or lends
 * only its clock: the follower's own numbers for it then move from what the follower drew to its
 * target on that mark's progress, as a mark on a slot that a decimated column stands for does.
 */
export type JoinLead =
  | {
      /** The anchor the joined mark placed itself under. */
      readonly anchor: string;
      /** The follower's numbers from the joined mark's. */
      readonly pick: (values: MarkValues) => MarkValues;
      /**
       * The follower's resting numbers from the joined mark's resting ones, which it rests on in
       * place of its own target. Without it the follower rests on its own target for this lead.
       */
      readonly rest?: (values: MarkValues) => MarkValues;
    }
  | {
      readonly anchor: string;
      /** How many of the follower's own numbers move on the mark's clock. */
      readonly clock: number;
    };

/**
 * A token that names one measured frame, Root's default layout or one Panel, for the frame's life.
 * Two frames are two tokens, compared by identity, so make each with `createFrameOwner`.
 */
export type FrameOwner = { readonly frame: "root" | "panel" | "loop" };

/**
 * Make the token of one measured frame.
 *
 * @param frame - What draws in the frame.
 * @returns A token no other frame holds.
 */
export function createFrameOwner(frame: FrameOwner["frame"]): FrameOwner {
  return { frame };
}

/**
 * What a mark tells the loop about itself when it places: what each of its numbers measures, the
 * anchor a follower joins it under, and the frame it draws in.
 */
export type MarkInfo = {
  /** What each number measures, so a resize maps it into the new box. */
  readonly axes?: readonly ValueAxis[];
  /** The anchor a follower joins the mark under, such as a bar's series and slot. */
  readonly anchor?: string;
  /**
   * The measured frame the mark draws in: Root's default layout or one Panel, a token that stays
   * the same for the frame's life. A resize maps the running tweens of its own frame only, so two
   * Panels whose heights change apart each map their own marks.
   */
  readonly owner?: FrameOwner | undefined;
};

/** The frame of a mark that names none, as the loop's own tests place them. */
const ANY_FRAME = createFrameOwner("loop");

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
    mark?: MarkInfo
  ) => void;
  /** Forget a mark that left the plot. */
  readonly forget: (id: string) => void;
  /**
   * The numbers a mark drew last, or null for a mark the loop does not hold, so a path can align
   * its old vertices with its new ones by slot.
   */
  readonly drawn: (id: string) => MarkValues | null;
  /** Draw every moving mark at its target at once, as a range step does. */
  readonly finish: () => void;
  /** Follow the reader's motion preference. Reduced motion snaps every placement. */
  readonly setReduced: (reduced: boolean) => void;
  /** Whether the reader asked for reduced motion, which also skips a path's crossfade. */
  readonly reduced: () => boolean;
  /** How many marks the loop holds, which falls back as marks unmount. */
  readonly size: () => number;
  /** Whether any mark still tweens, so the baseline and every other coordinate may be moving. */
  readonly running: () => boolean;
};

type Tween = {
  readonly from: MarkValues;
  readonly to: MarkValues;
  /** Where the mark rests once the tween ends, when its route draws more numbers than that. */
  readonly rest?: MarkValues;
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
  /** The frame the mark draws in, whose resizes alone map its tween. */
  readonly owner: FrameOwner;
  /** The marks a joined follower draws from while any of them moves, and where it then rests. */
  joined?: Joined | null;
  /**
   * The two lists a tween's frames draw into, in turn, so a frame allocates nothing and a writer
   * that compares lists by identity still sees each frame as new.
   */
  frames?: [number[], number[]];
};

/**
 * A joined follower's leads, each with the id of the mark at its anchor, and for a lead that lends
 * its clock the follower's own numbers from and to, then the follower's rest.
 */
type Joined = {
  readonly leads: readonly {
    readonly lead: JoinLead;
    readonly id: string;
    readonly own: { readonly from: MarkValues; readonly to: MarkValues };
  }[];
  readonly resting: MarkValues;
};

const ease = cubicBezier(CHART_UPDATE_CURVE);

/**
 * Map a mark's numbers into a resized box. Every number is a pixel from the plot's left or top edge
 * or a size, and the scales map pixels from an edge affinely, so a tween mapped this way draws in
 * every frame what the old tween drew, mapped: interpolation commutes with an affine map. A mark
 * with more numbers than axes repeats its declaration, as a path declares one vertex's axes for all.
 */
function rescaled(values: MarkValues, axes: readonly ValueAxis[], scale: PlotScale): MarkValues {
  return values.map((value, index) => {
    const axis = axes.length === 0 ? "size" : (axes[index % axes.length] ?? "size");
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
  // The marks whose tween runs, so a frame, an unmount and `running` visit none of the rest.
  const moving = new Set<Mark>();
  /** Hold a mark under its id, in place of the one it replaces. */
  const hold = (id: string, mark: Mark): void => {
    const old = marks.get(id);
    if (old !== undefined) moving.delete(old);
    marks.set(id, mark);
    if (mark.tween !== null) moving.add(mark);
  };
  // The marks each anchor names, such as a bar at its series and slot, which a follower can join.
  // A Line and an Area on one series share an anchor, so each anchor lists its marks, the latest
  // to place last, and a follower joins the latest mark still mounted.
  const anchors = new Map<string, string[]>();
  // The anchor each mark last placed under.
  const anchorOf = new Map<string, string>();
  const leave = (id: string): void => {
    const anchor = anchorOf.get(id);
    if (anchor === undefined) return;
    anchorOf.delete(id);
    const named = anchors.get(anchor)?.filter((other) => other !== id) ?? [];
    if (named.length === 0) anchors.delete(anchor);
    else anchors.set(anchor, named);
  };
  const name = (anchor: string, id: string): void => {
    if (anchors.get(anchor)?.at(-1) === id) return;
    leave(id);
    anchors.set(anchor, [...(anchors.get(anchor) ?? []), id]);
    anchorOf.set(id, anchor);
  };
  let handle: number | null = null;
  let reduced = reducedAtStart;
  // The commit's instant holds until the next frame or the end of the task, so every placement of
  // one commit reads it.
  let commitTime: number | null = null;
  // The commit whose data update last restarted the group.
  let restartedAt: number | null = null;
  // The measurement each frame's marks were last mapped into, or the commit that mapped them.
  const rescaledFor = new WeakMap<FrameOwner, object | number>();
  const startTime = (): number => {
    if (commitTime === null) {
      commitTime = host.now();
      queueMicrotask(() => {
        commitTime = null;
      });
    }
    return commitTime;
  };

  /**
   * Write a joined follower from what its leads drew, a resting lead's rest where it reads one, and
   * its own rest once no lead moves or a lead left.
   */
  const project = (mark: Mark): void => {
    const { joined } = mark;
    if (joined === null || joined === undefined) return;
    const sources = joined.leads.map(({ lead, id, own }) => ({ lead, own, source: marks.get(id) }));
    const moving = sources.some(({ source }) => source?.tween !== null && source?.tween !== undefined);
    if (!moving || sources.some(({ source }) => source === undefined)) {
      mark.joined = null;
      mark.drawn = joined.resting;
    } else {
      mark.drawn = sources.flatMap(({ lead, own, source }) => {
        const drawn = source?.drawn ?? [];
        if ("clock" in lead) {
          const eased = source?.tween === null ? 1 : (source?.eased ?? 1);
          return own.to.map((to, index) => {
            const from = own.from[index] ?? to;
            return from + (to - from) * eased;
          });
        }
        return source?.tween === null && lead.rest !== undefined ? lead.rest(drawn) : lead.pick(drawn);
      });
    }
    mark.write(mark.drawn);
  };

  /** Write every joined follower after the marks it follows moved. */
  const projectAll = (): void => {
    for (const mark of marks.values()) if (mark.joined) project(mark);
  };

  const step = (time: number): void => {
    handle = null;
    commitTime = null;
    let running = false;
    for (const mark of moving) {
      const tween = mark.tween;
      if (tween === null) {
        moving.delete(mark);
        continue;
      }
      const progress = Math.min(1, Math.max(0, (time - tween.start - tween.delay) / CHART_UPDATE_MS));
      mark.eased = progress >= 1 ? 1 : ease(progress);
      // The last frame writes the target itself, so the DOM ends on the numbers React rendered.
      if (progress >= 1) mark.drawn = tween.rest ?? tween.to;
      else {
        mark.frames ??= [[], []];
        const [frame, other] = mark.frames;
        mark.frames = [other, frame];
        frame.length = tween.to.length;
        tween.to.forEach((to, index) => {
          const from = tween.from[index] ?? to;
          frame[index] = from + (to - from) * mark.eased;
        });
        mark.drawn = frame;
      }
      mark.write(mark.drawn);
      if (progress < 1) running = true;
      else {
        mark.tween = null;
        moving.delete(mark);
      }
    }
    projectAll();
    if (running) handle = host.requestFrame(step);
  };

  /** Draw a mark at its target at once. */
  const snap = (
    id: string,
    target: MarkValues,
    write: MarkWriter,
    axes: readonly ValueAxis[],
    owner: FrameOwner
  ): void => {
    hold(id, { drawn: target, eased: 1, write, tween: null, axes, owner });
    // A follower's geometry never comes from React, and a tween may have left a bar between two
    // values, so a snap always hands its target to the writer, which skips what changes nothing.
    write(target);
  };

  /** Start a tween and draw its first numbers before the browser paints. */
  const run = (
    id: string,
    write: MarkWriter,
    tween: Tween,
    axes: readonly ValueAxis[],
    owner: FrameOwner
  ): void => {
    hold(id, { drawn: tween.from, eased: 0, write, tween, axes, owner });
    write(tween.from);
    handle ??= host.requestFrame(step);
  };

  return {
    place(id, target, write, placement, info: MarkInfo = {}) {
      const { axes = [], anchor, owner = ANY_FRAME } = info;
      if (anchor !== undefined) name(anchor, id);
      if (placement.kind === "join") {
        // A follower draws from the marks at its anchors in every frame, each on its own clock, so
        // they draw alike. Its rest is theirs where its leads read it, which reduced motion keeps,
        // as it changes only the timing. A lead that never placed leaves it on its own target.
        const leads = placement.leads.map((lead) => {
          const leadId = anchors.get(lead.anchor)?.at(-1) ?? "";
          return { lead, id: leadId, mark: marks.get(leadId) };
        });
        const found = leads.flatMap(({ lead, id, mark }) => (mark === undefined ? [] : [{ lead, id, mark }]));
        if (found.length < leads.length) {
          snap(id, target, write, axes, owner);
          return;
        }
        // Each lead stands for a run of the follower's numbers, in order: what its pick reads, or
        // the count of the follower's own numbers it moves.
        const previous = marks.get(id)?.drawn ?? null;
        let offset = 0;
        const parts = found.map(({ lead, id: leadId, mark }) => {
          const size = "clock" in lead ? lead.clock : lead.pick(mark.drawn).length;
          const to = target.slice(offset, offset + size);
          const from = previous?.length === target.length ? previous.slice(offset, offset + size) : to;
          offset += size;
          const source = mark.tween === null ? mark.drawn : (mark.tween.rest ?? mark.tween.to);
          const rest = "clock" in lead ? to : (lead.rest?.(source) ?? to);
          return { lead, id: leadId, own: { from, to }, rest };
        });
        const resting = parts.flatMap(({ rest }) => rest);
        if (reduced || found.every(({ mark }) => mark.tween === null)) {
          snap(id, resting, write, axes, owner);
          return;
        }
        const follower: Mark = {
          drawn: resting,
          eased: 0,
          write,
          tween: null,
          axes,
          owner,
          joined: { leads: parts.map(({ lead, id: leadId, own }) => ({ lead, id: leadId, own })), resting },
        };
        hold(id, follower);
        project(follower);
        return;
      }
      if (reduced || placement.kind === "snap") {
        snap(id, target, write, axes, owner);
        return;
      }
      if (placement.kind === "settle" && (placement.scale.x !== 1 || placement.scale.y !== 1)) {
        // A resize maps every running tween of its frame into the new box once, when the first
        // mark of its measurement settles, and redraws it there before the browser paints, so every
        // mark stays on the axes, marks this commit leaves alone among them. The tweens keep their
        // clock. Two resizes in one task are two measurements, so each maps the group, and another
        // frame's tweens keep their own box, as a Panel whose height holds does.
        const resize = placement.scale.to ?? startTime();
        if (rescaledFor.get(owner) !== resize) {
          rescaledFor.set(owner, resize);
          for (const running of moving) {
            if (running.tween === null || running.owner !== owner) continue;
            const { axes: kinds, tween } = running;
            const { scale } = placement;
            const from = rescaled(tween.from, kinds, scale);
            const to = rescaled(tween.to, kinds, scale);
            running.tween =
              tween.rest === undefined
                ? { ...tween, from, to }
                : { ...tween, from, to, rest: rescaled(tween.rest, kinds, scale) };
            running.drawn = rescaled(running.drawn, kinds, scale);
            running.write(running.drawn);
          }
          projectAll();
        }
      }
      if (placement.kind === "move") {
        // A data update restarts every running tween with it, from what each drew, so the group
        // keeps one progress, marks this commit leaves alone among them.
        const start = startTime();
        if (restartedAt !== start) {
          restartedAt = start;
          for (const mark of moving) {
            if (mark.tween === null) continue;
            // A frame's list is drawn into again, so the restart keeps a copy.
            mark.tween = { ...mark.tween, from: [...mark.drawn], start, delay: 0 };
            mark.eased = 0;
          }
        }
      }
      const mark = marks.get(id);
      const tween = mark?.tween ?? null;
      if (placement.kind === "move" && placement.via !== undefined) {
        // A path's route starts from what it drew, entry by entry, which its caller aligned.
        const { from, to } = placement.via;
        if (from.length !== to.length || sameItems(from, to)) {
          snap(id, target, write, axes, owner);
          return;
        }
        run(id, write, { from, to, rest: target, start: startTime(), delay: 0 }, axes, owner);
        return;
      }
      if (placement.kind === "settle" && mark !== undefined && tween?.rest !== undefined) {
        // A route that draws more numbers than its rest runs on while a commit asks for the same
        // rest, mapped into a resized box with the group, and any other target snaps it there.
        const { rest } = tween;
        const kept =
          rest.length === target.length && target.every((to, index) => close(to, rest[index] ?? 0));
        if (kept) {
          mark.write = write;
          write(mark.drawn);
          return;
        }
        snap(id, target, write, axes, owner);
        return;
      }
      if (mark !== undefined && tween !== null && sameItems(tween.to, target)) {
        // The mark already heads for this target, so the tween runs on. A re-render or a new node
        // may have drawn the target meanwhile, so the mark redraws where the tween has it.
        mark.write = write;
        write(mark.drawn);
        return;
      }
      if (placement.kind === "enter") {
        const tween = { from: placement.from, to: target, start: startTime(), delay: placement.delay };
        run(id, write, tween, axes, owner);
        return;
      }
      if (mark === undefined || mark.drawn.length !== target.length || sameItems(mark.drawn, target)) {
        snap(id, target, write, axes, owner);
        return;
      }
      if (placement.kind === "move") {
        run(id, write, { from: mark.drawn, to: target, start: startTime(), delay: 0 }, axes, owner);
        return;
      }
      // A resize retargets a running tween on its own clock, so the mark keeps the progress it
      // shares with every other mark. Without a running tween, or at its very end, it snaps.
      if (tween === null || 1 - mark.eased < 1e-6) {
        snap(id, target, write, axes, owner);
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
      const mark = marks.get(id);
      if (mark !== undefined) moving.delete(mark);
      marks.delete(id);
      leave(id);
      if (handle !== null && moving.size === 0) {
        host.cancelFrame(handle);
        handle = null;
      }
    },
    drawn: (id) => marks.get(id)?.drawn ?? null,
    finish() {
      for (const mark of moving) {
        if (mark.tween === null) continue;
        mark.drawn = mark.tween.rest ?? mark.tween.to;
        mark.eased = 1;
        mark.tween = null;
        mark.write(mark.drawn);
      }
      moving.clear();
      projectAll();
      if (handle !== null) host.cancelFrame(handle);
      handle = null;
    },
    setReduced(value) {
      reduced = value;
      if (value) this.finish();
    },
    reduced: () => reduced,
    size: () => marks.size,
    running: () => moving.size > 0,
  };
}
