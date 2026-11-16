// This module moves focus across a Root's segments, as React Aria's field focus manager does. It
// finds the focusable segments inside the Root element by `SEGMENT_SELECTOR`, in document order, so
// a `render` or `children` that wraps a segment in more elements keeps working. Past the first or
// last segment, focus crosses to the input beside this one through the neighbor lookup in
// `date-input-neighbors.ts` and lands on that input's nearest segment.

import type { PointerEvent } from "react";

import { isElement, isNode } from "../../internal/dom-node";
import { SEGMENT_SELECTOR } from "./date-input-context";
import type { DateInputFocusDirection, DateInputNeighbor } from "./date-input-neighbors";

/** A Root element's focusable segments, in document order. */
function focusableSegments(root: Element | null): HTMLElement[] {
  return [...(root?.querySelectorAll<HTMLElement>(SEGMENT_SELECTOR) ?? [])];
}

/**
 * A Root element's first focusable segment, which a Form focuses for an error and the hidden input
 * hands its focus to.
 *
 * @param root - The Root element, `null` before it mounts.
 * @returns The segment, or `null` when there is none.
 */
export function firstFocusableSegment(root: Element | null): HTMLElement | null {
  return root?.querySelector<HTMLElement>(SEGMENT_SELECTOR) ?? null;
}

/** Focuses the last segment before `target`, then back over empty ones, as React Aria's field press. */
function focusBefore(root: Element, target: EventTarget): void {
  const list = focusableSegments(root);
  const before =
    isNode(target) && target !== root
      ? list.filter(
          (element) => (element.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        )
      : list;
  let index = (before.length > 0 ? before : list).length - 1;
  while (
    index > 0 &&
    list[index]?.hasAttribute("data-placeholder") === true &&
    list[index - 1]?.hasAttribute("data-placeholder") === true
  ) {
    index -= 1;
  }
  list[index]?.focus();
}

/**
 * Focuses the segment `direction` places from `from` among the Root's focusable segments. Past the
 * first or last segment, it focuses the nearest segment of the input beside this one, when one
 * control renders both inputs.
 *
 * @param root - The Root element, `null` before it mounts.
 * @param from - The segment focus moves from; nothing moves when it is not one of the Root's.
 * @param direction - Which way focus moves.
 * @param neighbor - The surrounding control's neighbor lookup, if any.
 */
export function focusSibling(
  root: HTMLElement | null,
  from: Element,
  direction: DateInputFocusDirection,
  neighbor: DateInputNeighbor | undefined
): void {
  const list = focusableSegments(root);
  const index = list.findIndex((element) => element === from);
  if (index < 0) {
    return;
  }
  const sibling = list[index + (direction === "next" ? 1 : -1)];
  if (sibling !== undefined) {
    sibling.focus();
    return;
  }
  const next = root === null ? null : (neighbor?.(root, direction) ?? null);
  const segments = focusableSegments(next);
  (direction === "next" ? segments[0] : segments.at(-1))?.focus();
}

/**
 * Moves focus off a focused segment that is leaving the DOM, as a granularity change removes it.
 * Focus moves to the segment before it, or after it when it was the first, as React Aria's
 * `useDateSegment` does.
 *
 * @param root - The Root element, `null` before it mounts.
 * @param element - The leaving segment.
 */
export function focusAroundRemoved(root: HTMLElement | null, element: HTMLElement): void {
  const list = focusableSegments(root);
  const index = list.indexOf(element);
  if (index >= 0) {
    (list[index - 1] ?? list[index + 1])?.focus();
  }
}

/** The Root element's pointer handlers. */
type BoxPressHandlers = {
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void;
};

/**
 * The Root element's pointer handlers. A press on the box, not on a segment, focuses the last
 * filled segment before it. For a mouse, the handler focuses on press and prevents the browser from
 * focusing anything else. For touch and pen, it focuses on release, unless the release is on a
 * segment, which focuses itself.
 *
 * @param disabled - Whether the input is disabled. A press on a disabled input focuses nothing.
 * @returns The handlers.
 */
export function boxPressHandlers(disabled: boolean): BoxPressHandlers {
  return {
    onPointerDown(event) {
      if (disabled || event.pointerType !== "mouse") {
        return;
      }
      event.preventDefault();
      focusBefore(event.currentTarget, event.target);
    },
    onPointerUp(event) {
      if (disabled || event.pointerType === "mouse") {
        return;
      }
      if (isElement(event.target) && event.target.closest(SEGMENT_SELECTOR) !== null) {
        return;
      }
      focusBefore(event.currentTarget, event.target);
    },
  };
}
