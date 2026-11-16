"use client";

// A picker's focus boundary: its inputs and its popup are one place for focus. Two jobs live here,
// each its own hook: where focus returns when the popup closes (`usePickerOpener`), and when focus
// leaves the picker (`usePickerFocusBoundary`), which ends the blur an input defers while focus is
// in the popup and reports the leave to the Root.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { FocusEvent, RefObject } from "react";

import { documentOrder, isElement, isHTMLElement, isNode, rootNodeChain } from "../../internal/dom-node";
import type { DateInputBoundary, DateInputBoundaryMember } from "../date-field/date-input-boundary";
import type { DateInputNeighbor } from "../date-field/date-input-neighbors";
import type { PickerOpenRequest } from "./picker-change-details";

/**
 * Whether focus lands on one of Base UI's focus guards: the tabbable spans a non-modal popup
 * renders around itself, outside its own element, which pass focus straight on to the trigger, a
 * segment or past the picker. Focus on one is in transit, neither inside nor outside the picker.
 */
function isFocusGuard(node: Node | null): boolean {
  return isElement(node) && node.hasAttribute("data-base-ui-focus-guard");
}

/**
 * Whether a blur the picker Root saw leaves the picker: focus goes neither into the Root, which is
 * the group, nor into the popup, nor onto a focus guard on its way back to one of them. React bubbles the
 * popup's blurs to the Root through its portal. A blur from inside the popup to nowhere is the popup
 * closing with focus in it, which focus restoration follows, so it does not leave either. The node
 * checks in `internal/dom-node.ts` work in any realm.
 */
function isFocusLeavingPicker(event: FocusEvent<HTMLElement>, popup: HTMLElement | null): boolean {
  const next = event.relatedTarget;
  if (isNode(next)) {
    return !isFocusGuard(next) && !event.currentTarget.contains(next) && popup?.contains(next) !== true;
  }
  return !(isElement(event.target) && event.target.closest('[data-slot="date-picker-popup"]') !== null);
}

/** What `usePickerOpener` gives a Root. */
export type PickerOpener = {
  /** The segment focus was on when the popup opened. */
  readonly openerRef: RefObject<HTMLElement | null>;
  /** The Root's open request, remembering the segment focus opens the popup from. */
  readonly withOpener: (requestOpen: PickerOpenRequest) => PickerOpenRequest;
};

/**
 * Where focus returns when the popup closes: the segment the popup opened from. A popup the parent
 * opens through `open` has no such segment, so Base UI's own focus return applies.
 *
 * @param containsInput - Whether a node is inside one of the picker's inputs.
 * @param open - Whether the popup is open.
 * @returns The opener and the open request that records it.
 */
export function usePickerOpener(containsInput: (node: Node) => boolean, open: boolean): PickerOpener {
  const openerRef = useRef<HTMLElement | null>(null);
  // Whether the last open came through the picker's own request, which recorded its opener.
  const requested = useRef(false);
  const withOpener = useCallback(
    (requestOpen: PickerOpenRequest): PickerOpenRequest =>
      (next, reason, event, trigger) => {
        if (!next) {
          return requestOpen(next, reason, event, trigger);
        }
        const target = event.target;
        const active = isNode(target) ? (target.ownerDocument?.activeElement ?? null) : null;
        const opener = isHTMLElement(active) && containsInput(active) ? active : null;
        const changed = requestOpen(next, reason, event, trigger);
        if (changed) {
          openerRef.current = opener;
          requested.current = true;
        }
        return changed;
      },
    [containsInput]
  );
  // Runs when `open` changes: an open the picker did not request forgets the last opener.
  useLayoutEffect(() => {
    if (open && !requested.current) {
      openerRef.current = null;
    }
    requested.current = false;
  }, [open]);
  return { openerRef, withOpener };
}

/** What `usePickerFocusBoundary` gives a Root. */
export type PickerFocusBoundary = {
  /** The inputs' focus boundary. It contains the popup, and each input registers with it. */
  readonly inputBoundary: DateInputBoundary;
  /** Whether a node is inside one of the registered inputs. */
  readonly containsInput: (node: Node) => boolean;
  /** The registered input beside an input's element in document order, which focus crosses to. */
  readonly adjacentInput: DateInputNeighbor;
  /** The Root element's focus handler. */
  readonly onFocus: (event: FocusEvent<HTMLElement>) => void;
  /** The Root element's blur handler. */
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
};

/**
 * When focus leaves the picker. An input whose focus moves into the popup defers its blur, and so
 * its Field validation; see `date-input-boundary.ts`. The Root calls the input's `leave` once focus
 * lands anywhere outside that input and the popup, such as the trigger, another input or out of the
 * picker. It calls `onFocusLeave` when focus leaves the group and the popup together. Focus that
 * passes through one of Base UI's focus guards triggers neither call. The hook waits for the next
 * focus target before calling `leave` or `onFocusLeave`.
 *
 * @param popupRef - The popup element.
 * @param onFocusLeave - The Root's `onFocusLeave`, called with the `blur` that started the leave.
 * @returns The inputs' boundary and the Root's handlers.
 */
export function usePickerFocusBoundary(
  popupRef: RefObject<HTMLElement | null>,
  onFocusLeave: ((event: FocusEvent<Element>) => void) | undefined
): PickerFocusBoundary {
  const inputs = useRef(new Set<DateInputBoundaryMember>());
  const handled = useRef(new WeakSet<Event>());
  const containsInput = useCallback(
    (node: Node) => [...inputs.current].some((input) => input.element()?.contains(node) === true),
    []
  );
  const adjacentInput = useCallback<DateInputNeighbor>((element, direction) => {
    const elements = [...inputs.current]
      .flatMap((input) => {
        const root = input.element();
        return root === null ? [] : [root];
      })
      .sort(documentOrder);
    const index = elements.indexOf(element);
    return index < 0 ? null : (elements[index + (direction === "next" ? 1 : -1)] ?? null);
  }, []);
  const inPopup = useCallback((node: Node) => popupRef.current?.contains(node) === true, [popupRef]);
  const register = useCallback((input: DateInputBoundaryMember) => {
    inputs.current.add(input);
    return () => {
      inputs.current.delete(input);
    };
  }, []);
  const inputBoundary = useMemo(
    (): DateInputBoundary => ({ contains: inPopup, register }),
    [inPopup, register]
  );
  // Runs the deferred blur of each input that focus has landed outside of, and passes the event that
  // moved focus there.
  const leaveOutside = useCallback(
    (next: Element | null, event: Event) => {
      if (next !== null && (isFocusGuard(next) || inPopup(next))) {
        return;
      }
      for (const input of inputs.current) {
        if (next === null || input.element()?.contains(next) !== true) {
          input.leave(event);
        }
      }
    },
    [inPopup]
  );
  // Focus on a guard is in transit: where it lands next decides. Base UI may unmount the guard with
  // the popup before it blurs, so the landing is read from the next `focusin`; a blur the Root sees
  // from the guard, or a focus inside the Root, settles it first. The root node holding the Root
  // reads a landing inside a shadow root the picker renders into, and each root node out to the
  // document reads a landing in its own tree, so exactly one of them decides.
  const settleTransit = useRef<(() => void) | null>(null);
  useEffect(() => () => settleTransit.current?.(), []);
  function awaitTransit(event: FocusEvent<HTMLElement>): void {
    const root = event.currentTarget;
    const landed = (focus: Event): void => {
      const { target } = focus;
      if (isNode(target) && isFocusGuard(target)) {
        return;
      }
      settle();
      if (isNode(target) && (root.contains(target) || inPopup(target))) {
        return;
      }
      leaveOutside(isElement(target) ? target : null, focus);
      onFocusLeave?.(event);
    };
    // A listener on a root node sees a focus inside a shadow root it hosts as a focus on the host,
    // so only the listener on the root node holding the picker reads where in the picker it landed.
    const listeners = rootNodeChain(root).map(({ root: boundary, innerHost }) => {
      const listener = (focus: Event): void => {
        // Through the next root node in: its listener, later in this capture pass, decides.
        if (innerHost !== undefined && focus.composedPath().includes(innerHost)) {
          return;
        }
        landed(focus);
      };
      boundary.addEventListener("focusin", listener, true);
      return () => boundary.removeEventListener("focusin", listener, true);
    });
    const settle = (): void => {
      for (const remove of listeners) {
        remove();
      }
      settleTransit.current = null;
    };
    settleTransit.current = settle;
  }
  return {
    inputBoundary,
    containsInput,
    adjacentInput,
    onFocus(event) {
      settleTransit.current?.();
      if (isElement(event.target)) {
        leaveOutside(event.target, event.nativeEvent);
      }
    },
    onBlur(event) {
      // A popup portaled into a container inside the app's root reaches React through both
      // containers' listeners, so one native blur can arrive twice; it counts once.
      if (handled.current.has(event.nativeEvent)) {
        return;
      }
      handled.current.add(event.nativeEvent);
      // A blur from a focus guard decides where the transit ends itself.
      settleTransit.current?.();
      const next = event.relatedTarget;
      if (isNode(next) && isFocusGuard(next)) {
        awaitTransit(event);
        return;
      }
      if (isElement(next) && !event.currentTarget.contains(next)) {
        leaveOutside(next, event.nativeEvent);
      }
      if (onFocusLeave !== undefined && isFocusLeavingPicker(event, popupRef.current)) {
        if (!isNode(next)) {
          leaveOutside(null, event.nativeEvent);
        }
        onFocusLeave(event);
      }
    },
  };
}
