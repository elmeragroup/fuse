"use client";

// This module is the private interface between a DateInput and a control that widens the input's
// focus boundary, such as a date picker that counts its popup as part of its input for focus. When
// focus moves from the segments to a node inside the boundary, the input does not blur. It confirms
// nothing and leaves the Field focused, and focus that comes back from there is not a new focus.
// The control knows when focus lands outside the input and the rest of the boundary. It then calls
// the input's `leave`, which runs the blur the input deferred. The control dispatches no event for
// it, so nothing outside sees a blur that never happened.
//
// The boundary also joins the inputs one control renders, such as a range picker's start and end,
// into one run of segments. React Aria moves focus across both of a range's fields with one focus
// manager: typing the start's last segment moves on to the end's first, an empty segment's
// Backspace and the left and right arrows cross back and forth. A DateInput moves focus among its
// own segments and, past its first or last, asks the boundary for the segment to cross to.

import { createContext } from "react";

import type { DateInputFocusDirection } from "./date-input-session";

/** A DateInput as it registers with the control that widens its focus boundary. */
export type DateInputBoundaryMember = {
  /** Returns the input's Root element. */
  readonly element: () => HTMLElement | null;
  /**
   * Runs the blur the input deferred while focus was on a node inside the boundary. It does nothing
   * when no blur is deferred.
   *
   * @param event - The real event with which focus landed outside, for the commit's change details.
   */
  readonly leave: (event: Event) => void;
};

/** The widened focus boundary that the control around a DateInput gives it. */
export type DateInputBoundary = {
  /**
   * Returns whether a node outside the input is inside its widened focus boundary.
   *
   * @param node - The node focus moves to.
   * @returns Whether the node is inside the boundary.
   */
  readonly contains: (node: Node) => boolean;
  /**
   * Registers a mounted input with the control.
   *
   * @param member - The input's element and its `leave`.
   * @returns The unregistration, called when the input unmounts or the boundary changes.
   */
  readonly register: (member: DateInputBoundaryMember) => () => void;
  /**
   * Returns the segment focus crosses to past an input's first or last segment: the nearest
   * segment of the registered input beside it in document order.
   *
   * @param root - The asking input's Root element.
   * @param direction - Which way focus moves.
   * @returns The segment, or `null` at either end of the run.
   */
  readonly neighborSegment: (root: HTMLElement, direction: DateInputFocusDirection) => HTMLElement | null;
};

/** The boundary of the control around a DateInput, or `undefined` outside such a control. */
export const DateInputBoundaryContext = createContext<DateInputBoundary | undefined>(undefined);
