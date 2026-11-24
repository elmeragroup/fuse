// This module moves focus across a Root's segments, as React Aria's field focus manager does. It
// finds the focusable segments inside the Root element by `SEGMENT_SELECTOR`, in document order, so
// a `render` or `children` that wraps a segment in more elements keeps working, and a segment
// portaled out of the Root takes no part. Past the first or last segment, focus crosses to the input
// beside this one through the boundary in `date-input-boundary.ts`.

import type { PointerEvent } from "react";

import { isElement, isNode } from "../../internal/dom-node";
import type { DateInputBoundary } from "./date-input-boundary";
import type { DateInputFocusDirection } from "./date-input-session";

/**
 * The empty attribute `DateInput.Segment` writes on every segment that is not a literal. The
 * lookups here key on it rather than on `data-slot`, because a consumer may give a segment its own
 * `data-slot` as a styling hook.
 */
export const SEGMENT_ATTRIBUTE = "data-date-segment";

/** The selector that finds a Root's focusable segments, in document order. */
const SEGMENT_SELECTOR = `[${SEGMENT_ATTRIBUTE}][tabindex]`;

/** A Root element's focusable segments, in document order. */
function focusableSegments(root: Element | null): HTMLElement[] {
  return [...(root?.querySelectorAll<HTMLElement>(SEGMENT_SELECTOR) ?? [])];
}

/**
 * A Root element's first or last focusable segment. A Form focuses the first for an error and the
 * hidden input hands its focus to it.
 *
 * @param root - The Root element, `null` before it mounts.
 * @param edge - Which end.
 * @returns The segment, or `null` when there is none.
 */
export function edgeSegment(root: Element | null, edge: "first" | "last"): HTMLElement | null {
  const list = focusableSegments(root);
  return (edge === "first" ? list[0] : list.at(-1)) ?? null;
}

/** Focuses the last segment before `target`, then back over empty ones; see `boxPressHandlers`. */
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
 * @param boundary - The surrounding control's focus boundary, if any.
 */
export function focusSibling(
  root: HTMLElement | null,
  from: Element,
  direction: DateInputFocusDirection,
  boundary: DateInputBoundary | undefined
): void {
  const list = focusableSegments(root);
  const index = list.findIndex((element) => element === from);
  if (root === null || index < 0) {
    return;
  }
  const sibling = list[index + (direction === "next" ? 1 : -1)];
  (sibling ?? boundary?.neighborSegment(root, direction))?.focus();
}

/**
 * Moves focus off a focused segment that is leaving the DOM, as a granularity change removes it.
 * Focus moves to the segment before it, or after it when it was the first, as React Aria's
 * `useDateSegment` does. A segment outside the Root element hands focus to nothing.
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
 * segment before the press, or the last segment when none comes before it. When that segment is
 * empty, the press focuses the first of the empty segments that run up to it, as React Aria's field
 * does. For a mouse, the handler focuses on press and prevents the browser from focusing anything
 * else. For touch and pen, it focuses on release, unless the release is on a segment, which focuses
 * itself, or outside the Root element, as on an element portaled out of it.
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
      const { currentTarget, target } = event;
      if (
        disabled ||
        event.pointerType === "mouse" ||
        !isElement(target) ||
        !currentTarget.contains(target) ||
        target.closest(SEGMENT_SELECTOR) !== null
      ) {
        return;
      }
      focusBefore(currentTarget, target);
    },
  };
}
