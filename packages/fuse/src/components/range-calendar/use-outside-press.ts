"use client";

// Which presses fall outside a RangeCalendar's days and month buttons, across shadow roots, settled
// in the capture phase so a press whose target stops propagation still settles.
//
// A press settles on `pointerup`, as React Aria's `useRangeCalendar` commits on the window's
// `pointerup`: a touch that starts a scroll or a pinch ends in `pointercancel`, never `pointerup`,
// so it leaves the range open. Also as React Aria does, a release after a zero-size `pointerdown`
// is skipped: iOS VoiceOver fires such virtual pointer events with the wrong target (WebKit bugs
// 222627 and 223202), and the day's own click or the focus leaving settles that press instead.
//
// A listener sees a press's `composedPath()` only down to its own tree: a document listener sees a
// press inside a shadow root as a press on the shadow host, and a closed root hides its nodes from
// it entirely. The listener that can classify a press is the one on the root node that holds the
// calendar (its document, or the shadow root it renders into), which sees the full path down to the
// pressed node, closed roots included. But capture runs from the document inward, so the outer
// listeners fire first and cannot wait for it. Each boundary therefore listens: the root node that
// holds the calendar, and every root node above it up to the document. An outer boundary settles a
// press that does not pass through the next inner boundary's host (it cannot be inside the
// calendar), and leaves one that does to the inner listener, which fires later in the same capture
// pass, so exactly one listener decides each press. The innermost boundary classifies by whether
// the path holds the Root and a control between the target and the Root. Nothing waits for the
// dispatch to end, so the range settles before the target's own handlers run.
//
// Three presses go unsettled, each left open until focus moves or the user picks the other end:
// - An ancestor that stops the press in its own capture listener, between two boundaries, hides it
//   from the inner listeners.
// - A press on a shadow host's own box (its padding, or area its shadow content leaves uncovered)
//   has the host in its path but never enters the shadow root, so the outer boundary leaves it to
//   an inner listener that never fires.
// - A press in the parent document of a calendar portaled into a same-origin frame reaches no
//   boundary, since the chain ends at the calendar's own document.

import { useLayoutEffect } from "react";

import { isElement, rootNodeChain } from "../../internal/dom-node";

const CONTROL = "button, [role=button]";

/** Whether a pointer event is iOS VoiceOver's virtual one, which has no size. */
function isVirtual(event: Event): boolean {
  return "width" in event && "height" in event && event.width === 0 && event.height === 0;
}

/**
 * Calls `onOutside` once for every pointer press released outside the Root's buttons: anywhere
 * outside the Root, or inside it but not on a button, also when the Root sits in an open or closed
 * shadow root or in a same-origin frame, and also when the pressed element stops the press's
 * propagation. The module header lists the presses it cannot see.
 *
 * @param root - The Root element, as its callback ref last set it, or `null` to listen nowhere,
 *   such as while no range is open; listeners follow it.
 * @param onOutside - Settles the open range, with the release and the element it landed on.
 */
export function useOutsidePress(
  root: HTMLElement | null,
  onOutside: (event: Event, trigger: Element | undefined) => void
): void {
  // A layout effect, so the listeners are in place before the next press once a range opens.
  useLayoutEffect(() => {
    if (root === null) {
      return;
    }
    const chain = rootNodeChain(root);
    // The document sees every press first in the capture phase, so it alone notes the virtual one.
    const outermost = chain.at(-1)?.root;
    let virtualPress = false;
    const onDown = (event: Event) => {
      virtualPress = isVirtual(event);
    };
    outermost?.addEventListener("pointerdown", onDown, true);
    const listeners = chain.map(({ root: boundary, innerHost }) => {
      const listener = (event: Event) => {
        if (virtualPress) {
          return;
        }
        const path = event.composedPath();
        if (innerHost === undefined) {
          const at = path.indexOf(root);
          if (at !== -1 && path.slice(0, at).some((node) => isElement(node) && node.matches(CONTROL))) {
            return;
          }
        } else if (path.includes(innerHost)) {
          // Through the inner boundary: the inner listener, later in this capture pass, decides.
          return;
        }
        const first = path[0] ?? null;
        onOutside(event, isElement(first) ? first : undefined);
      };
      boundary.addEventListener("pointerup", listener, true);
      return () => boundary.removeEventListener("pointerup", listener, true);
    });
    return () => {
      outermost?.removeEventListener("pointerdown", onDown, true);
      for (const remove of listeners) {
        remove();
      }
    };
  }, [root, onOutside]);
}
