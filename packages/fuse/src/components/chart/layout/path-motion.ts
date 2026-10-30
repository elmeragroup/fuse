/**
 * How a path reaches new data, after `.scratch/charts-v1/reviews/motion-decision.md` and ticket
 * 06's F10. Root's loop moves every path on one clock, and this module only decides the mode from
 * the window's slots, never from the vertices a decimated path happens to draw, so `pathStep` in
 * `chart-path-draw.ts` lays out each vertex's route for that mode. Slot keys come from
 * `pairSlotKeys`, which keeps a slot's key across updates and pairs slots by position when an
 * update shares no slot at the same interval, so the four modes read off the keys and the slot
 * identities alone.
 *
 * 1. The window holds the same keys: each vertex tweens from its old place to its new one.
 * 2. The window shifts by whole slots, keeps its length and shares a slot, as an append that drops
 *    the first reading does: the path slides along the axis. A vertex that leaves slides out past
 *    the plot's edge, and one that arrives slides in from beyond the other edge.
 * 3. The update shares no slot but keeps the grid, so the keys pair by position: each vertex tweens
 *    from the old vertex at its position, and the shorter window pads with its end vertex, so extra
 *    vertices grow out of the end or shrink into it.
 * 4. Any other change of slots crossfades the old path into the new one.
 */

/** The slots of a window, in window order. */
export type PathSlots = {
  /** The key each slot renders under, from `pairSlotKeys`. */
  readonly keys: readonly string[];
  /** Each slot's identity: its start instant on a time axis or its name on a category axis. */
  readonly ids: readonly string[];
};

/**
 * How a path reaches new data: a route of vertices for the loop, with how many slots the window
 * moved along the axis, positive when it starts later and 0 unless it slides, or a crossfade.
 */
export type PathMotion =
  | { readonly mode: "tween" | "slide" | "pair"; readonly by: number }
  | { readonly mode: "crossfade" };

/** Whether two lists hold the same strings in the same order. */
function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * How far a window of the same length moved along the axis, in slots: positive when the new window
 * starts later, as an append that drops the first reading does. Null unless every key the two
 * windows share sits that many slots apart and every other new key is new.
 */
function shiftOf(previous: readonly string[], next: readonly string[]): number | null {
  if (previous.length !== next.length) return null;
  const before = new Map(previous.map((key, index) => [key, index]));
  let by: number | null = null;
  for (const [index, key] of next.entries()) {
    const old = before.get(key);
    if (old === undefined) continue;
    const step = old - index;
    if (by !== null && step !== by) return null;
    by = step;
  }
  if (by === null || by === 0) return null;
  // The keys that arrive sit at the end the window moved toward, and the ones that leave at the other.
  const count = next.length;
  const shift = by;
  const arrives = (index: number) => (shift > 0 ? index >= count - shift : index < -shift);
  return next.every((key, index) => before.has(key) !== arrives(index)) ? shift : null;
}

/**
 * Decide how a path reaches new data.
 *
 * @param previous - The slots of the window the path rests on now.
 * @param next - The slots of the new data's window.
 * @returns The mode, and how far a slide moves.
 */
export function pathMotion(previous: PathSlots, next: PathSlots): PathMotion {
  const { keys } = next;
  if (sameList(previous.keys, keys)) return { mode: "tween", by: 0 };
  const oldIds = new Set(previous.ids);
  if (next.ids.some((id) => oldIds.has(id))) {
    const by = shiftOf(previous.keys, keys);
    return by === null ? { mode: "crossfade" } : { mode: "slide", by };
  }
  // With no slot shared, the keys pair by position on the same grid, or start fresh on another.
  const paired = Math.min(previous.keys.length, keys.length);
  if (paired === 0 || !sameList(previous.keys.slice(0, paired), keys.slice(0, paired)))
    return { mode: "crossfade" };
  return { mode: "pair", by: 0 };
}
