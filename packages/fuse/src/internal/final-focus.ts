import { activeElementFrom } from "./active-element";

/**
 * A closing overlay's `finalFocus`, unless the user moved focus out of it for somewhere else, in
 * which case focus stays where it went. Base UI leaves focus alone in that case only for a boolean
 * `finalFocus`. A function counts as explicit and always wins, in `FloatingFocusManager.tsx`, so an
 * overlay that computes its return target passes it through this guard.
 *
 * Focus on nothing or on the body did not move anywhere, so the target applies. Each overlay decides
 * what counts as focus still in it, because DOM containment misses its portaled popups and only
 * the React tree can place them.
 *
 * @template T - The `finalFocus` target the overlay returns.
 * @param scope - The element whose root the guard reads focus from, or `null` when there is none,
 *   which leaves the target to apply.
 * @param inOverlay - Whether the focused element still belongs to the closing overlay.
 * @param target - Returns the overlay's own `finalFocus` target. The guard calls it only when focus
 *   did not move.
 * @returns `false` to leave focus alone when it moved elsewhere, else the target.
 */
export function finalFocusUnlessMoved<T>(
  scope: Element | null,
  inOverlay: (active: Element) => boolean,
  target: () => T
): T | false {
  const active = scope === null ? null : activeElementFrom(scope);
  if (active !== null && active !== active.ownerDocument.body && !inOverlay(active)) {
    return false;
  }
  return target();
}
