"use client";

// The private seam between a DateInput and the inputs beside it in one control, such as a range
// picker's start and end. React Aria moves focus across both of a range's fields with one focus
// manager: typing the start's last segment moves on to the end's first, an empty segment's
// Backspace and the left and right arrows cross back and forth. A DateInput moves focus among its
// own segments and, past its first or last, asks this seam for the input beside it; it then focuses
// that input's first or last segment itself, so only DateInput reads its segments' DOM.

import { createContext } from "react";

/** Which way focus moves among the segments. */
export type DateInputFocusDirection = "next" | "previous";

/**
 * The input element beside `root` in the control that owns both, or `null` at either end.
 *
 * @param root - The asking input's Root element.
 * @param direction - Which way focus is moving.
 * @returns The neighbour's Root element, or `null`.
 */
export type DateInputNeighbour = (
  root: HTMLElement,
  direction: DateInputFocusDirection
) => HTMLElement | null;

/** The neighbour lookup of the control around a DateInput; none outside such a control. */
export const DateInputNeighbourContext = createContext<DateInputNeighbour | undefined>(undefined);
