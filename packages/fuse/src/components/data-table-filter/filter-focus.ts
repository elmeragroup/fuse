/**
 * The filter's DOM focus algorithms, which read and move focus by what the browser reports, in
 * shadow roots and same-origin frames too. The Root owns when they run.
 */
import { deepActiveElement, hasFocus } from "../../internal/active-element";

const FOCUSABLE = "input:not([type=hidden]), button, [tabindex]:not([tabindex='-1'])";

/**
 * Resolves an editor's first control. An editor marks it with `data-dtf-initial-focus`, on the
 * control itself or on a wrapper around it, since a Fuse NumberField takes no ref.
 *
 * @param scope - The element to search in.
 * @returns The focusable control, or null.
 */
export function resolveFocusTarget(scope: HTMLElement): HTMLElement | null {
  const marked = scope.matches("[data-dtf-initial-focus]")
    ? scope
    : scope.querySelector<HTMLElement>("[data-dtf-initial-focus]");
  const start = marked ?? scope;
  return start.matches(FOCUSABLE) ? start : start.querySelector<HTMLElement>(FOCUSABLE);
}

/**
 * Whether focus left a closing overlay for somewhere else. Base UI leaves focus alone in that
 * case only for a boolean `finalFocus`. A function counts as explicit and always wins
 * (`FloatingFocusManager.tsx`), so each overlay's `finalFocus` asks this first. A press on a
 * chip's Value with the menu open, or on the Trigger with the popover open, moves focus into the
 * other overlay, and the closing one must not pull it back. The Root passes the elements it
 * registered, so another Root's overlay never counts as this one's.
 *
 * @param popup - The closing overlay's popup.
 * @param owned - The elements that count as the overlay: its popup, its own nested popups, and
 *   any ghost chip, whose segments unmount.
 * @returns Whether focus moved elsewhere.
 */
export function focusMovedElsewhere(popup: HTMLElement | null, owned: Iterable<Element>): boolean {
  // Read through shadow roots, since the document names only the host of a focused control there.
  const active = popup === null ? null : deepActiveElement(popup.ownerDocument);
  if (active === null || active === active.ownerDocument.body) {
    return false;
  }
  for (const element of owned) {
    if (element.contains(active)) {
      return false;
    }
  }
  return true;
}

/**
 * Focuses a chip's first or last segment that takes focus, from the segments the chip registered,
 * else the fallback. Each candidate is focused in turn, and the first that its own root then
 * reports as active wins, so the browser decides what can take focus: CSS visibility, `inert`, a
 * disabled native button, and Base UI's `focusableWhenDisabled` alike.
 *
 * @returns The element that took focus, or null when nothing did.
 */
export function focusEdge(
  segments: ReadonlySet<HTMLElement> | undefined,
  edge: "first" | "last",
  fallback: HTMLElement | null
): HTMLElement | null {
  const ordered = [...(segments ?? [])].sort((left, right) =>
    left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  );
  const candidates = edge === "first" ? ordered : ordered.reverse();
  for (const candidate of [...candidates, fallback]) {
    if (candidate === null) {
      continue;
    }
    candidate.focus();
    if (hasFocus(candidate)) {
      return candidate;
    }
  }
  return null;
}
