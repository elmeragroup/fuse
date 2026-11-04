"use client";

import { useState } from "react";
import type { MouseEvent } from "react";

/**
 * A plot surface's record of a touch or pen lift. It answers two questions. Whether a click is a
 * lift's compatibility click, which acts not, since the lift already did: Chromium's reports the
 * touch's pointer type, and WebKit's reads "mouse" after the lift, and the next press ends the
 * record. And whether focus that moves now is a press's own: a mouse press or a tap moves focus in
 * its mousedown, before its click picks or pins, so the focus activates nothing and the click
 * reads the pin as it was. The guard starts at the mousedown and ends with that task. A scrub
 * sends no mousedown and no click, so a later Tab or Shift+Tab acts as a keyboard's does whether
 * or not a click came. Chart's and ScatterChart's surfaces both keep one.
 */
export type TapLift = {
  /** A press landed, or the surface went away mid-press, which ends the record. */
  readonly press: () => void;
  /** A touch or pen lift acted. */
  readonly lift: () => void;
  /** A mousedown reached the surface, a mouse press's or a tap's, which moves focus in its task. */
  readonly mouseDown: () => void;
  /** Whether focus that moves now is a press's own, in the task of its mousedown. */
  readonly tapFocus: () => boolean;
  /**
   * Whether a click acts. A compatibility click acts not, since its lift already did, and it ends
   * the record. A keyboard or assistive click, which reports a detail of 0, acts.
   *
   * @param event - The click.
   * @returns Whether the surface acts on the click.
   */
  readonly clickActs: (event: MouseEvent) => boolean;
};

/**
 * Create a surface's lift record.
 *
 * @returns The record, with no lift.
 */
function createTapLift(): TapLift {
  let lifted = false;
  let focusing = false;
  return {
    press() {
      lifted = false;
      focusing = false;
    },
    lift() {
      lifted = true;
    },
    mouseDown() {
      focusing = true;
      // The focus a mousedown moves lands in its own task, so the guard ends once that task does.
      setTimeout(() => {
        focusing = false;
      }, 0);
    },
    tapFocus: () => focusing,
    clickActs(event) {
      const native = event.nativeEvent;
      const touch = native instanceof globalThis.PointerEvent && native.pointerType !== "mouse";
      const compatibility = event.detail > 0 && (touch || lifted);
      lifted = false;
      return !compatibility;
    },
  };
}

/**
 * A surface's lift record for its life.
 *
 * @returns The record.
 */
export function useTapLift(): TapLift {
  const [lift] = useState(createTapLift);
  return lift;
}
