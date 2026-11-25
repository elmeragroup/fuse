import type { MouseEvent, PointerEvent } from "react";

import { activeElementFrom } from "../../internal/active-element";

/**
 * A primary press on the strip, from its pointerdown until the pointerup or pointercancel of the
 * contact that started it, matched by `pointerId`.
 */
type Activation = {
  /** Stops listening for the activation's end. */
  readonly stop: () => void;
};

/**
 * The elements a focus may land on without the strip scrolling. A `held` path lasts while its
 * activation runs. A `passing` path covers a mousedown and the focus that follows it, and a
 * `releasing` path counts only while its activation's pointerup `release` dispatches. Each of these
 * paths clears at the first focus the strip handles, even one on an element outside the path, and
 * at a click the strip captures. A `passing` or `releasing` path also clears when its timer runs on
 * the next task.
 */
type FocusPath =
  | { readonly _tag: "none" }
  | { readonly _tag: "held"; readonly elements: ReadonlyArray<EventTarget> }
  | { readonly _tag: "passing"; readonly elements: ReadonlyArray<EventTarget> }
  | { readonly _tag: "releasing"; readonly elements: ReadonlyArray<EventTarget>; readonly release: Event };

const NO_PATH: FocusPath = { _tag: "none" };

/** A chip strip's press tracking, which the strip's handlers drive. */
export type StripPress = {
  /**
   * Starts an activation at a primary pointerdown captured on the strip. A pointerdown that is not
   * primary, such as a second finger's, drops the path and leaves the activation running.
   */
  readonly startPointer: (event: PointerEvent<HTMLElement>) => void;
  /** Records the path of a trusted mousedown captured on the strip outside any held activation. */
  readonly recordMouseDown: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Whether a focus on `target` comes from the press, and so must not scroll the strip. It drops
   * the press's path, so only the first focus can come from the press.
   */
  readonly takeFocus: (target: EventTarget) => boolean;
  /** Drops the press's path without a focus, as a click does. */
  readonly dropFocusPath: () => void;
  /** Ends the activation and drops its path, as when the strip unmounts. */
  readonly dispose: () => void;
};

/**
 * The elements the press `event` passes through inside the strip, from its target up to the strip
 * itself, left out. The path keeps the pressed element even after a handler detaches the pressed
 * node. A press in a portaled popup reaches the strip's React handler but not its DOM path, so its
 * path is empty.
 */
function pressedElements(event: MouseEvent<HTMLElement>): ReadonlyArray<EventTarget> {
  const path = event.nativeEvent.composedPath();
  const end = path.indexOf(event.currentTarget);
  return end === -1 ? [] : path.slice(0, end);
}

/**
 * The pressed elements a focus can still land on. The element that already has focus cannot get
 * it again from the press, so a later keyboard focus on it still scrolls it into view.
 */
function focusable(strip: HTMLElement, elements: ReadonlyArray<EventTarget>): ReadonlyArray<EventTarget> {
  const focused = activeElementFrom(strip);
  return elements.filter((element) => element !== focused);
}

/**
 * Creates the press tracking for one chip strip.
 *
 * A primary press on a chip segment starts an activation and records the pressed path. The strip
 * skips its focus scroll for the first focus on that path. A consumer handler can still focus a
 * control outside the path, and that focus scrolls.
 *
 * A mouse press brings its mousedown, and the browser's focus, while the activation holds, and a
 * pen press is expected to as well (only mouse and touch are verified, in Chromium).
 * A consumer handler can also focus the segment in its pointerdown, pointermove or pointerup. A
 * touch tap brings its mousedown, focus, mouseup and click only after the pointerup, so that
 * mousedown records a path of its own, which expires on the next task. A touch that is no tap, such
 * as a drag or a two-finger tap, brings no mouse events. The Pointer Events mapping may also send a
 * touch's compat mousedown while the finger is down. The activation's path covers that focus.
 *
 * Only the pointerup or pointercancel of the contact that started the activation ends it, so
 * another device cannot end a held press. The release outside the strip brings it no click, so the
 * listeners are on the document. They capture, and so run before the release's own handlers. A
 * pointercancel drops the path at once. A pointerup keeps it only while the pointerup dispatches, so
 * a focus from a later touchend, mouseup or click outside the strip scrolls.
 *
 * @returns The strip's press tracking.
 */
export function createStripPress(): StripPress {
  let activation: Activation | null = null;
  let focusPath: FocusPath = NO_PATH;

  // The path drops on the next task, so neither the release nor the pressed elements outlive the
  // gesture when no focus or click takes the path.
  const setPathUntilNextTask = (path: Extract<FocusPath, { readonly _tag: "passing" | "releasing" }>) => {
    focusPath = path;
    setTimeout(() => {
      if (focusPath === path) {
        focusPath = NO_PATH;
      }
    }, 0);
  };

  // The one place an activation ends. `release` is its pointerup, during which the path still holds.
  const endActivation = (release: Event | null) => {
    activation?.stop();
    activation = null;
    if (release !== null && focusPath._tag === "held") {
      setPathUntilNextTask({ _tag: "releasing", elements: focusPath.elements, release });
    } else {
      focusPath = NO_PATH;
    }
  };

  return {
    startPointer: (event) => {
      if (!event.isPrimary) {
        focusPath = NO_PATH;
        return;
      }
      // A press that starts no activation, such as a right-click, leaves a held one alone.
      const elements = pressedElements(event);
      if (event.button !== 0 || elements.length === 0) {
        return;
      }
      endActivation(null);
      const { pointerId } = event;
      const strip = event.currentTarget;
      const { ownerDocument } = strip;
      const onEnd = (next: globalThis.PointerEvent) => {
        if (next.pointerId === pointerId) {
          endActivation(next.type === "pointerup" ? next : null);
        }
      };
      ownerDocument.addEventListener("pointerup", onEnd, true);
      ownerDocument.addEventListener("pointercancel", onEnd, true);
      activation = {
        stop: () => {
          ownerDocument.removeEventListener("pointerup", onEnd, true);
          ownerDocument.removeEventListener("pointercancel", onEnd, true);
        },
      };
      focusPath = { _tag: "held", elements: focusable(strip, elements) };
    },
    recordMouseDown: (event) => {
      // A standalone synthetic mousedown brings no focus, and a held activation's path already
      // covers the focus its mousedown brings.
      if (!event.nativeEvent.isTrusted || event.button !== 0 || activation !== null) {
        return;
      }
      // The browser focuses after the mousedown's dispatch, in the same task.
      setPathUntilNextTask({
        _tag: "passing",
        elements: focusable(event.currentTarget, pressedElements(event)),
      });
    },
    takeFocus: (target) => {
      const path = focusPath;
      focusPath = NO_PATH;
      switch (path._tag) {
        case "none":
          return false;
        case "held":
        case "passing":
          return path.elements.includes(target);
        case "releasing":
          return path.release.eventPhase !== Event.NONE && path.elements.includes(target);
      }
    },
    dropFocusPath: () => {
      focusPath = NO_PATH;
    },
    dispose: () => {
      endActivation(null);
    },
  };
}
