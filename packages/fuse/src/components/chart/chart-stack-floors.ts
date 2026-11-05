"use client";

/**
 * The stack floors of one motion loop: the bookkeeping around `settleFloors`, which holds the
 * floor's whole policy. Each segment of a stack draws in a mark of its own, a bar or a series' path,
 * so no one writer sees a whole stack. Every stacked mark hands the registry the spans it draws in a
 * frame and leaves its painting to it. While the loop writes a batch of marks, one frame's moving
 * marks or one commit's placements, the registry only records. Once the batch ends it settles each
 * changed stack once, in its marks' frame, paints each mark that recorded or whose floors changed
 * once, and then redraws whatever reads the stack's floors, such as the active overlay, all before
 * the browser paints. A write outside a batch settles at once. A mark that leaves outside a batch, as
 * every mark of a removed series or an unmounting chart does before Root's commit batch opens, only
 * records too, and its stack settles once the commit's batch ends or in the next microtask, so a
 * removal of many marks settles each stack once. Root's unmount discards that work, so nothing
 * settles or paints into a chart that is gone.
 */
import type { ChartMotion } from "./chart-motion";
import { segmentSide, settleFloors } from "./layout/floor-settle";
import type { FloorSpan } from "./layout/floor-settle";
import type { PlotFrame, StackPlace } from "./layout/plot-frame";

/** The stack floors of one motion loop's marks. */
export type StackFloors = {
  /**
   * Record a mark's spans, replacing what it recorded before, and have the registry paint it, at
   * once outside a batch and once the batch ends inside one.
   *
   * @param mark - The mark's name, unique among the loop's mounted marks.
   * @param stack - The stack the mark draws in.
   * @param spans - The mark's spans in this frame, each named by its position in the list.
   * @param frame - The layout's frame the mark draws in.
   * @param paint - Paint the mark from the numbers it recorded, reading `place`.
   */
  readonly draw: (
    mark: string,
    stack: string,
    spans: readonly FloorSpan[],
    frame: PlotFrame,
    paint: () => void
  ) => void;
  /**
   * Whether a mark's span keeps its floor.
   *
   * @param mark - The mark's name.
   * @param index - The span's position in the mark's last recorded spans.
   * @returns The place, or undefined where the mark recorded no such span.
   */
  readonly place: (mark: string, index: number) => StackPlace | undefined;
  /**
   * The place of a series' spans on one side of zero under some device pixel columns, as an emphasis
   * box or the active overlay over them takes it: `"outer"` where every such span keeps its floor,
   * `"inner"` where one does not, and undefined where the series draws no span there.
   *
   * @param stack - The stack.
   * @param series - The series' key.
   * @param from - The first device pixel column.
   * @param to - The device pixel column past the last.
   * @param side - The side of zero.
   * @returns The place, or undefined.
   */
  readonly placeOver: (
    stack: string,
    series: string,
    from: number,
    to: number,
    side: "above" | "below"
  ) => StackPlace | undefined;
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
   * batch ends inside one and in the next microtask outside one.
   *
   * @param mark - The mark's name.
   */
  readonly forget: (mark: string) => void;
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
 * Throw away the pending work of a loop's stack floors, if it has any, as Root does when it unmounts.
 *
 * @param motion - The loop.
 */
export function discardStackFloors(motion: ChartMotion): void {
  registries.get(motion)?.discard();
}

/** What a mark recorded last: its stack, its spans and the frame it draws in. */
type Recorded = { readonly stack: string; readonly spans: readonly FloorSpan[]; readonly frame: PlotFrame };

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
  const paints = new Map<string, () => void>();
  const watchers = new Map<string, Set<() => void>>();
  const dirty = new Set<string>();
  const pending = new Set<string>();
  let depth = 0;
  /** Whether a microtask that settles the marks that left is queued. */
  let queued = false;
  /** Whether Root threw the pending work away, so no mark that leaves after it settles anything. */
  let discarded = false;

  /** Settle a stack's spans in its marks' frame, and note the marks whose places change. */
  const settleStack = (stack: string): boolean => {
    const names = [...(stacks.get(stack) ?? [])];
    const records = names.flatMap((name) => {
      const recorded = marks.get(name);
      return recorded === undefined ? [] : [recorded];
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
    names.forEach((name, index) => {
      const count = records[index]?.spans.length ?? 0;
      const next = keeps.slice(offset, offset + count);
      offset += count;
      const last = places.get(name);
      places.set(name, next);
      if (last !== undefined && last.length === next.length && last.every((value, at) => value === next[at]))
        return;
      pending.add(name);
      changed = true;
    });
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
    for (const name of painting) paints.get(name)?.();
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
        const side = segmentSide(span.segment, recorded.frame);
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

  /** Drop a mark from its stack, which settles again. */
  const leave = (name: string): void => {
    const stack = marks.get(name)?.stack;
    if (stack === undefined) return;
    const members = stacks.get(stack);
    members?.delete(name);
    if (members?.size === 0) stacks.delete(stack);
    dirty.add(stack);
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
      dirty.add(stack);
      paints.set(name, paint);
      pending.add(name);
      discarded = false;
      if (depth === 0) settle();
    },
    place: (name, index) => {
      const kept = places.get(name);
      if (kept === undefined || index < 0 || index >= kept.length) return undefined;
      return kept[index] === 1 ? "outer" : "inner";
    },
    placeOver: (stack, series, from, to, side) => {
      const cover = coverOf(stack, series);
      if (cover === undefined) return undefined;
      const cells = side === "above" ? cover.above : cover.below;
      let place: StackPlace | undefined;
      for (let at = from; at < to; at += 1) {
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
    discard: () => {
      discarded = true;
      dirty.clear();
      pending.clear();
      covers.clear();
    },
  };
}
