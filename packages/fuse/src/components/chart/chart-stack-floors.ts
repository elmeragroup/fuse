"use client";

/**
 * The stack floors of one motion loop: the bookkeeping around `settleFloors`, which holds the
 * floor's whole policy. Each segment of a stack draws in a mark of its own, a bar or a series' path,
 * so no one writer sees a whole stack. Every stacked mark hands the registry the spans it draws in a
 * frame and leaves its painting to it. While the loop writes a batch of marks, such as one frame's
 * moving marks, the registry only records, and once the batch ends it settles each changed stack
 * once, in its marks' frame, paints each mark that recorded or whose floors changed once, and then
 * redraws whatever reads the stack's floors, such as the active overlay. A mark that draws or
 * leaves outside a batch, as every mark a commit places or unmounts does, only records too, and its
 * stack settles once for the commit: in Root's first layout effect when Root renders in it, after
 * every mark's, and otherwise in the next microtask, before the browser paints, as when the draw
 * gate opens or a Bar mounts or changes on its own. Root's unmount discards that work, so nothing
 * settles or paints into a chart that is gone.
 */
import { useId, useLayoutEffect, useMemo } from "react";

import type { ChartMotion } from "./chart-motion";
import { settleFloors, zeroSide } from "./layout/floor-settle";
import type { FloorAxis, FloorSpan } from "./layout/floor-settle";
import type { StackPlace } from "./layout/plot-frame";
import { sameItems } from "./layout/same-items";

/** The stack floors of one motion loop's marks. */
export type StackFloors = {
  /**
   * Record a mark's spans, replacing what it recorded before, and have the registry paint it once
   * the batch ends, or in the next microtask outside one.
   *
   * @param mark - The mark's name, unique among the loop's mounted marks.
   * @param stack - The stack the mark draws in.
   * @param spans - The mark's spans in this frame, each named by its position in the list.
   * @param frame - The floor axis the mark draws along: a frame's, from `floorAxisOf`, or a dial's.
   * @param paint - Paint the mark from the numbers it recorded, given for each span 1 where it
   *   keeps its floor and 0 where it does not.
   */
  readonly draw: (
    mark: string,
    stack: string,
    spans: readonly FloorSpan[],
    frame: FloorAxis,
    paint: (kept: Uint8Array) => void
  ) => void;
  /**
   * The place a reader takes over a series' spans, as an emphasis box or the active overlay over
   * them does: `"outer"` where every span of its series on its side of zero under the device pixel
   * columns it covers keeps its floor, `"inner"` where one does not, and undefined where the series
   * draws no span there or the reader has no length.
   *
   * @param stack - The stack.
   * @param reader - The reader's own span, built as a mark's is.
   * @param frame - The floor axis the reader draws along.
   * @returns The place, or undefined.
   */
  readonly placeOver: (stack: string, reader: FloorSpan, frame: FloorAxis) => StackPlace | undefined;
  /**
   * Redraw something that reads a stack's floors whenever they change, even while its own numbers
   * rest.
   *
   * @param stack - The stack.
   * @param redraw - Draw it again.
   * @returns A function that stops it.
   */
  readonly watch: (stack: string, redraw: () => void) => () => void;
  /**
   * Drop a mark that unmounts, and repaint the marks whose spans take the floors it held, once the
   * batch ends, or in the next microtask outside one.
   *
   * @param mark - The mark's name.
   */
  readonly forget: (mark: string) => void;
  /**
   * Settle now what marks drew or left outside a batch, as Root does in its first layout effect of
   * each commit, after every layout effect of the marks it rendered, so the commit's marks show
   * their floors before any later layout effect reads them. Inside a batch, or with nothing to
   * settle, it does nothing.
   */
  readonly flush: () => void;
  /**
   * Throw away the work marks left behind, as Root does when it unmounts, so nothing settles or
   * paints until a mark draws again.
   */
  readonly discard: () => void;
};

/** One loop's registry, created with the first stacked mark that draws in it. */
const registries = new WeakMap<ChartMotion, StackFloors>();

/**
 * The stack floors of a motion loop, shared by every stacked mark it draws.
 *
 * @param motion - The loop.
 * @returns Its registry.
 */
export function stackFloorsOf(motion: ChartMotion): StackFloors {
  const known = registries.get(motion);
  if (known !== undefined) return known;
  const created = createStackFloors(motion);
  registries.set(motion, created);
  return created;
}

/**
 * Settle what a loop's marks drew or left outside a batch, if it has stack floors, as Root does in
 * each commit.
 *
 * @param motion - The loop.
 */
export function flushStackFloors(motion: ChartMotion): void {
  registries.get(motion)?.flush();
}

/**
 * Throw away the pending work of a loop's stack floors, if it has any, as Root does when it unmounts.
 *
 * @param motion - The loop.
 */
export function discardStackFloors(motion: ChartMotion): void {
  registries.get(motion)?.discard();
}

/** A stacked mark's seat among its loop's stack floors: the registry, the mark's name, its stack and its series' key. */
export type StackSeat = {
  readonly floors: StackFloors;
  readonly mark: string;
  readonly stack: string;
  readonly series: string;
};

/**
 * A stacked mark's seat among the stack floors for as long as it is mounted, or null for a loose
 * series' mark. A mark that unmounts, or moves to another seat, leaves its stack, whose floors may
 * pass to another segment.
 *
 * @param motion - Root's loop.
 * @param stack - The series' stack, or undefined for a loose series.
 * @param series - The series' config key, which names the mark's spans.
 * @returns The seat, or null.
 */
export function useStackSeat(
  motion: ChartMotion,
  stack: string | undefined,
  series: string
): StackSeat | null {
  const mark = useId();
  const seat = useMemo(
    () => (stack === undefined ? null : { floors: stackFloorsOf(motion), mark, stack, series }),
    [motion, mark, stack, series]
  );
  useLayoutEffect(() => {
    if (seat === null) return undefined;
    return () => seat.floors.forget(seat.mark);
  }, [seat]);
  return seat;
}

/** What a mark recorded last: its stack, its spans and the frame it draws in. */
type Recorded = { readonly stack: string; readonly spans: readonly FloorSpan[]; readonly frame: FloorAxis };

/** A series' places by device pixel column on each side: -1 none, 0 a span without its floor, 1 with. */
type Cover = { readonly from: number; readonly above: Int8Array; readonly below: Int8Array };

function createStackFloors(motion: ChartMotion): StackFloors {
  const marks = new Map<string, Recorded>();
  /** Each stack's marks. */
  const stacks = new Map<string, Set<string>>();
  /** Each mark's spans' places, 1 where the span keeps its floor. */
  const places = new Map<string, Uint8Array>();
  /** Each stack's series' covers, built on demand once a settle. */
  const covers = new Map<string, Map<string, Cover>>();
  const paints = new Map<string, (kept: Uint8Array) => void>();
  const watchers = new Map<string, Set<() => void>>();
  const dirty = new Set<string>();
  const pending = new Set<string>();
  let depth = 0;
  /** Whether a microtask that settles the marks written outside a batch is queued. */
  let queued = false;
  /** Whether Root threw the pending work away, so no mark that leaves after it settles anything. */
  let discarded = false;

  /** Settle a stack's spans in its marks' frame, and note the marks whose places change. */
  const settleStack = (stack: string): boolean => {
    const records = [...(stacks.get(stack) ?? [])].flatMap((name) => {
      const recorded = marks.get(name);
      return recorded === undefined ? [] : [{ name, ...recorded }];
    });
    const frame = records[0]?.frame;
    const keeps =
      frame === undefined
        ? new Uint8Array(0)
        : settleFloors(
            records.flatMap(({ spans }) => spans),
            frame
          );
    let changed = false;
    let offset = 0;
    for (const { name, spans } of records) {
      const next = keeps.slice(offset, offset + spans.length);
      offset += spans.length;
      const last = places.get(name);
      places.set(name, next);
      if (sameItems(last, next)) continue;
      pending.add(name);
      changed = true;
    }
    covers.delete(stack);
    return changed;
  };

  /** Settle every changed stack, paint every mark that needs it once, then redraw the readers. */
  const settle = (): void => {
    const moved: string[] = [];
    for (const stack of dirty) if (settleStack(stack)) moved.push(stack);
    dirty.clear();
    const painting = [...pending];
    pending.clear();
    for (const name of painting) {
      const kept = places.get(name);
      if (kept !== undefined) paints.get(name)?.(kept);
    }
    for (const stack of moved) for (const redraw of watchers.get(stack) ?? []) redraw();
  };

  /** Settle in the next microtask, unless a batch ends first and settles for it. */
  const settleSoon = (): void => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (depth === 0 && !discarded) settle();
    });
  };

  /** A series' cover in a stack, built once a settle from its marks' spans and places. */
  const coverOf = (stack: string, series: string): Cover | undefined => {
    const known = covers.get(stack)?.get(series);
    if (known !== undefined) return known;
    const owned: {
      readonly from: number;
      readonly to: number;
      readonly side: "above" | "below";
      readonly keep: number;
    }[] = [];
    for (const name of stacks.get(stack) ?? []) {
      const recorded = marks.get(name);
      const kept = places.get(name);
      if (recorded === undefined || kept === undefined) continue;
      recorded.spans.forEach((span, index) => {
        const side = zeroSide(recorded.frame, span.segment.base, span.segment.tip);
        if (span.series !== series || side === null || span.to <= span.from) return;
        owned.push({ from: span.from, to: span.to, side, keep: kept[index] ?? 0 });
      });
    }
    if (owned.length === 0) return undefined;
    const low = Math.min(...owned.map(({ from }) => from));
    const high = Math.max(...owned.map(({ to }) => to));
    const above = new Int8Array(high - low).fill(-1);
    const below = new Int8Array(high - low).fill(-1);
    for (const { from, to, side, keep } of owned) {
      const cells = side === "above" ? above : below;
      for (let at = from; at < to; at += 1) if ((cells[at - low] ?? -1) !== 0) cells[at - low] = keep;
    }
    const built = { from: low, above, below };
    const byStack = covers.get(stack) ?? new Map<string, Cover>();
    covers.set(stack, byStack);
    byStack.set(series, built);
    return built;
  };

  /**
   * Note a stack whose spans changed, which settles again. A reader before then builds its cover
   * from the spans as they are, so it lags only where the settle changes a place, and the settle
   * redraws it there.
   */
  const touch = (stack: string): void => {
    dirty.add(stack);
    covers.delete(stack);
  };

  /** Drop a mark from its stack, which settles again. */
  const leave = (name: string): void => {
    const stack = marks.get(name)?.stack;
    if (stack === undefined) return;
    const members = stacks.get(stack);
    members?.delete(name);
    if (members?.size === 0) stacks.delete(stack);
    touch(stack);
  };

  motion.batches({
    begin: () => {
      depth += 1;
    },
    end: () => {
      // A batch that began before the registry was made ends without its start.
      if (depth === 0) return;
      depth -= 1;
      if (depth === 0) settle();
    },
  });

  return {
    draw: (name, stack, spans, frame, paint) => {
      if (marks.get(name)?.stack !== stack) leave(name);
      marks.set(name, { stack, spans, frame });
      const members = stacks.get(stack) ?? new Set<string>();
      stacks.set(stack, members);
      members.add(name);
      touch(stack);
      paints.set(name, paint);
      pending.add(name);
      discarded = false;
      if (depth === 0) settleSoon();
    },
    placeOver: (stack, reader, frame) => {
      const side = zeroSide(frame, reader.segment.base, reader.segment.tip);
      const cover = side === null ? undefined : coverOf(stack, reader.series);
      if (side === null || cover === undefined) return undefined;
      const cells = side === "above" ? cover.above : cover.below;
      let place: StackPlace | undefined;
      for (let at = reader.from; at < reader.to; at += 1) {
        const cell = cells[at - cover.from] ?? -1;
        if (cell === 0) return "inner";
        if (cell === 1) place = "outer";
      }
      return place;
    },
    watch: (stack, redraw) => {
      const set = watchers.get(stack) ?? new Set<() => void>();
      watchers.set(stack, set);
      set.add(redraw);
      return () => {
        set.delete(redraw);
        if (set.size === 0) watchers.delete(stack);
      };
    },
    forget: (name) => {
      leave(name);
      marks.delete(name);
      places.delete(name);
      paints.delete(name);
      pending.delete(name);
      if (discarded) dirty.clear();
      else if (depth === 0) settleSoon();
    },
    flush: () => {
      if (depth === 0 && !discarded && dirty.size > 0) settle();
    },
    discard: () => {
      discarded = true;
      dirty.clear();
      pending.clear();
      covers.clear();
    },
  };
}
