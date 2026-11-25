// A Root element is a segment row that scrolls inline when its box is narrower than its segments.
// A browser can leave a focused segment partly clipped at the row's edge, so these handlers scroll
// the row by hand.

import { useEffect, useRef } from "react";
import type { FocusEvent, RefObject } from "react";

import { activeElementFrom } from "../../internal/active-element";
import { isElement } from "../../internal/dom-node";
import { staysInside } from "./date-input-store";

/** The Root element's focus handlers. */
type RowScrollHandlers = {
  readonly onFocus: (event: FocusEvent<HTMLElement>) => void;
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
};

/** The row that holds focus and the observer that watches its layout. */
type Watch = {
  readonly row: HTMLElement;
  readonly observer: ResizeObserver;
};

/** A computed length in pixels, zero when it does not parse. */
function pixels(length: string): number {
  return Number.parseFloat(length) || 0;
}

/** Whether `target` is an element inside `row` other than the row itself. */
function isInside(row: HTMLElement, target: EventTarget | null): target is Element {
  return isElement(target) && target !== row && row.contains(target);
}

/**
 * Scrolls a row the least distance that puts an element inside the row's inline padding. An element
 * wider than that space lines up with the space's left edge.
 *
 * `getBoundingClientRect` reports painted lengths, which a transform on an ancestor such as
 * `scale(0.75)` scales, while `scrollLeft`, `clientWidth` and the computed padding stay in layout
 * lengths. The element's painted offset from the row is divided by the row's painted width over its
 * layout width, as `carousel-measure.ts` converts to scroll coordinates. The layout width comes from
 * the computed style, which keeps the fractions `offsetWidth` rounds. A rotated or skewed ancestor is
 * not supported.
 *
 * @param row - The scrolling row.
 * @param element - The element inside it, a focused segment.
 */
function reveal(row: HTMLElement, element: Element): void {
  const style = getComputedStyle(row);
  const paddingLeft = pixels(style.paddingLeft);
  const paddingRight = pixels(style.paddingRight);
  const layoutWidth =
    pixels(style.width) +
    (style.boxSizing === "border-box"
      ? 0
      : paddingLeft + paddingRight + pixels(style.borderLeftWidth) + pixels(style.borderRightWidth));
  const box = row.getBoundingClientRect();
  const scale = box.width / layoutWidth;
  if (!Number.isFinite(scale) || scale <= 0) {
    return;
  }
  const start = row.clientLeft + paddingLeft;
  const end = row.clientLeft + row.clientWidth - paddingRight;
  const rect = element.getBoundingClientRect();
  const left = (rect.left - box.left) / scale;
  const right = (rect.right - box.left) / scale;
  // A larger scrollLeft moves the content left in either direction, so a delta works under RTL too,
  // where scrollLeft counts down from 0.
  row.scrollLeft += Math.min(Math.max(0, right - end), left - start);
}

/** Disconnects the watched row's observer and clears the watch. */
function stopWatching(watch: { current: Watch | undefined }): void {
  watch.current?.observer.disconnect();
  watch.current = undefined;
}

/** Stops watching a row and scrolls it back to its start, where it rests. */
function release(watch: { current: Watch | undefined }, row: HTMLElement): void {
  if (watch.current?.row === row) {
    stopWatching(watch);
  }
  row.scrollLeft = 0;
}

/**
 * The Root element's focus handlers. Focus on a segment scrolls the row so the whole segment shows
 * inside the row's padding when it fits there. A wider segment lines up with the left edge of that
 * space. While the row holds focus, a change in the size of the row's content box or of one of its
 * children, such as a pasted date that widens the year, scrolls it again for the segment that has
 * focus then. Focus that leaves the row scrolls it back to its start, where it rests, as a text input
 * does. A field disabled while one of its segments has focus loses that focus with no blur event, and
 * a disabled row takes no scrolling from the user, so the row scrolls back to its start when
 * `disabled` turns true, with or without focus.
 *
 * @param state - The field's state.
 * @param state.disabled - Whether the field is disabled.
 * @param state.root - The Root element.
 * @returns The handlers to merge onto the Root element.
 */
export function useRowScroll({
  disabled,
  root,
}: {
  readonly disabled: boolean;
  readonly root: RefObject<HTMLElement | null>;
}): RowScrollHandlers {
  const watch = useRef<Watch | undefined>(undefined);
  useEffect(() => () => stopWatching(watch), []);
  useEffect(() => {
    const row = root.current;
    if (disabled && row !== null) {
      release(watch, row);
    }
  }, [disabled, root]);
  return {
    onFocus(event) {
      const { currentTarget: row, target } = event;
      // React passes focus up through portals; only an element inside the row's own box moves it.
      if (!isInside(row, target)) {
        return;
      }
      reveal(row, target);
      if (watch.current?.row === row) {
        return;
      }
      stopWatching(watch);
      // Observing starts with one report per element, which finds the segment already in view.
      // Each report reveals the element that has focus now: a granularity change can remove the
      // segment focus first landed on.
      const observer = new ResizeObserver(() => {
        const focused = activeElementFrom(row);
        if (isInside(row, focused)) {
          reveal(row, focused);
        } else {
          release(watch, row);
        }
      });
      watch.current = { row, observer };
      // The row's content box, which shrinks when the row's own padding grows inside a box of a
      // fixed width.
      observer.observe(row, { box: "content-box" });
      // The row is a flex container, so each child, a segment, a literal or a consumer's wrapper,
      // is a flex item with a box of its own whose width moves the segments after it. Border boxes,
      // so padding that grows on a consumer's wrapper reports too.
      for (const item of row.children) {
        observer.observe(item, { box: "border-box" });
      }
    },
    onBlur(event) {
      if (!staysInside(event)) {
        release(watch, event.currentTarget);
      }
    },
  };
}
