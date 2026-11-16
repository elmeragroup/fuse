"use client";

// This module is the private interface between a DateInput and a control that runs the native form
// reset of the value the input shows, such as a date picker. A controlled input's reset drops its
// draft and starts its Field's validity over, but the parent puts its value back. Both resets must
// run in the same task. The Field treats only the change of value that renders with the reset as
// the reset's own, and no validation follows that change; see `date-input-field.ts`. Two separate
// reset tasks may render in separate commits. Under such a control, the input does not subscribe to
// native reset events itself. It registers its reset with the control, which runs it beside the
// reset of its value.

import { createContext } from "react";

/** The interface through which a control runs an input's form reset. */
export type DateInputResetOwner = {
  /**
   * Registers a mounted input's reset with the control, which runs it in the task in which it puts
   * its own value back.
   *
   * @param reset - Drops the input's draft and starts its Field's validity over.
   * @returns The unregistration, called when the input unmounts or the control changes.
   */
  readonly register: (reset: () => void) => () => void;
};

/** The control that runs a DateInput's form reset, or `undefined` outside such a control. */
export const DateInputResetContext = createContext<DateInputResetOwner | undefined>(undefined);
