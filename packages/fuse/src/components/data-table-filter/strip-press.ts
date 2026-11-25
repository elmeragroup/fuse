import type { MouseEvent, PointerEvent } from "react";

import { activeElementFrom } from "../../internal/active-element";
import { isHTMLElement } from "../../internal/dom-node";

/**
 * A primary press on the strip, from its pointerdown until the pointerup or pointercancel of the
 * contact that started it, matched by `pointerId`, or until a pointermove of that contact with the
 * primary button up.
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

/**
 * How long the hold waits for a tap's click once its touch lifts. A browser sends a tap's compat
 * mousedown, mouseup and click after the pointerup. Chromium sent them 5ms later in this package's
 * tests, and a browser that keeps double-tap zoom first waits out its double-tap delay, which this
 * bound covers. It is a cleanup timeout, not a measured browser delay. A click later than that
 * comes after the hold ends.
 */
const TAP_CLICK_WAIT_MS = 500;

/**
 * The marker on a chip whose width a press holds, which the `chips` slot reads with the width in
 * `HELD_WIDTH`.
 */
const HELD = "data-press-held";
const HELD_WIDTH = "--data-table-filter-held-width";

/**
 * A press on the strip that an editor's draft write can resize the chips under, from the press's
 * pointerdown until one of the ends `startPointer` lists. While `down`, the activation runs. Once
 * `up`, the press waits for its click until `timer` runs.
 */
type LayoutHold = {
  /** The pointer that pressed. */
  readonly pointerId: number;
  /** Whether the press is a touch, whose click carries a pointer id of its own. */
  readonly pointerType: string;
  /** The chip strip. */
  readonly strip: HTMLElement;
  /** The press's path, on which its click lands. */
  readonly elements: ReadonlyArray<EventTarget>;
  /** The chips the press holds at their width, which the release unmarks. */
  readonly held: Array<HTMLElement>;
  readonly phase:
    | { readonly _tag: "down" }
    | { readonly _tag: "up"; readonly timer: ReturnType<typeof setTimeout> };
};

/**
 * Whether `click` is the click that `hold`'s release brought: trusted, from a pointer, after the
 * release, and landing on the pressed path. A mouse or pen click carries the press's pointer id. A
 * touch's compat click may not, since WebKit sends a touch's pointerup with id 0 and its click with
 * id 1. A click that is no `PointerEvent`, in an engine without them, carries no id. A keyboard
 * click, with a `detail` of 0, a consumer's `click()` and another pointer's click do not end the
 * hold.
 */
function isHoldClick(hold: LayoutHold, click: globalThis.MouseEvent): boolean {
  if (!click.isTrusted || click.detail === 0 || hold.phase._tag !== "up" || click.target === null) {
    return false;
  }
  if (!hold.elements.includes(click.target)) {
    return false;
  }
  return (
    hold.pointerType === "touch" ||
    !(click instanceof globalThis.PointerEvent) ||
    click.pointerId === hold.pointerId
  );
}

/** The elements that can show another document, which a pointer moving into them enters. */
const FRAME_HOSTS: ReadonlySet<string> = new Set(["iframe", "frame", "object", "embed"]);

/**
 * Whether the pointerout `out` takes the pointer out of its document. Chromium names the iframe
 * the pointer moves into, and a pointer that leaves the window names nothing.
 */
function leavesDocument(out: globalThis.PointerEvent): boolean {
  const next = out.relatedTarget;
  return next === null || (isHTMLElement(next) && FRAME_HOSTS.has(next.localName));
}

/** The child of `strip` that holds `element`, or null when `element` is outside the strip. */
function stripChild(strip: HTMLElement, element: HTMLElement): HTMLElement | null {
  let child: HTMLElement | null = element;
  while (child !== null && child.parentElement !== strip) {
    child = child.parentElement;
  }
  return child;
}

/** A chip strip's press tracking, which the strip's handlers drive. */
export type StripPress = {
  /**
   * Starts an activation at a primary pointerdown captured on the strip, and with it a press that
   * `holdChip` can hold chips through. The press ends at its click, its pointercancel, the next
   * press, `releaseHold`, `dispose`, the pointer leaving the document, or the first pointermove
   * that shows the primary button up after a release in another document. Without the click, it
   * ends on the next task after a mouse or pen release and 500ms after a touch lifts. A
   * pointerdown that is not primary, such as a second finger's, drops the path and leaves the
   * activation running.
   */
  readonly startPointer: (event: PointerEvent<HTMLElement>) => void;
  /** Records the path of a trusted mousedown captured on the strip outside any held activation. */
  readonly recordMouseDown: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Whether a focus on `target` comes from the press, and so must not scroll the strip. It drops
   * the press's path, so only the first focus can come from the press.
   */
  readonly takeFocus: (target: EventTarget) => boolean;
  /**
   * Takes a click captured on the strip. It drops the press's path without a focus, and ends the
   * width hold when the click is the one the press's release brought.
   */
  readonly takeClick: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Holds the width of the strip's child that holds `element`, a chip or one of its segments, as
   * a draft write is about to resize that chip, until the press ends. It does nothing outside a
   * press, for an element outside the strip, or for the chip the press started in.
   *
   * A press moves focus out of an open editor before its click, and that blur applies the editor's
   * draft. A draft that resizes an earlier chip would move the pressed segment before the release,
   * and the click would miss. A later chip that shrinks would do the same on a strip scrolled to
   * its end, since the strip's scroll range then shrinks with it. A held chip keeps its width, so
   * the strip's scroll range stays too. The `chips` slot clips a held chip's overflow
   * horizontally only, so a summary that grows during the hold cannot paint over the next chip,
   * and a segment's vertical hit area stays whole. The hold writes only the marker and the width
   * variable, so the chip's own inline styles stay as they are.
   */
  readonly holdChip: (element: HTMLElement) => void;
  /** Ends the press and its width hold, so the chips take their own widths again. */
  readonly releaseHold: () => void;
  /** Ends the activation and its width hold and drops its path, as when the strip unmounts. */
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
 * Only events of the contact that started the activation end it, so another device cannot end a
 * held press: its pointerup or pointercancel, a pointermove with the primary button up, or a
 * pointerout that takes it into another document, such as an iframe, even with the button still
 * down. The release outside the strip brings it no click, so the listeners are on the document.
 * They capture, and so run before the release's own handlers. A
 * pointercancel drops the path at once. A pointerup keeps it only while the pointerup dispatches, so
 * a focus from a later touchend, mouseup or click outside the strip scrolls.
 *
 * @returns The strip's press tracking.
 */
export function createStripPress(): StripPress {
  let activation: Activation | null = null;
  let focusPath: FocusPath = NO_PATH;
  let hold: LayoutHold | null = null;

  const releaseHold = () => {
    if (hold === null) {
      return;
    }
    if (hold.phase._tag === "up") {
      clearTimeout(hold.phase.timer);
    }
    for (const chip of hold.held) {
      chip.removeAttribute(HELD);
      chip.style.removeProperty(HELD_WIDTH);
    }
    hold = null;
  };

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
  // A mouse or pen release brings its click in the same task. A tap's click comes later.
  const endActivation = (release: globalThis.PointerEvent | null) => {
    activation?.stop();
    activation = null;
    if (release === null) {
      releaseHold();
    } else if (hold?.phase._tag === "down") {
      const wait = release.pointerType === "touch" ? TAP_CLICK_WAIT_MS : 0;
      hold = { ...hold, phase: { _tag: "up", timer: setTimeout(releaseHold, wait) } };
    }
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
      // A release in another document, such as an iframe the pointer moved into, never reaches this
      // one. The next move this document sees with the primary button up ends the activation then.
      const onMove = (next: globalThis.PointerEvent) => {
        if (next.pointerId === pointerId && (next.buttons & 1) === 0) {
          endActivation(null);
        }
      };
      // A pointer that leaves the document, for an iframe or past the window, may release there
      // and stay there, so this document would see neither its release nor a later move.
      const onOut = (next: globalThis.PointerEvent) => {
        if (next.pointerId === pointerId && leavesDocument(next)) {
          endActivation(null);
        }
      };
      hold = {
        pointerId,
        pointerType: event.pointerType,
        strip,
        elements,
        held: [],
        phase: { _tag: "down" },
      };
      ownerDocument.addEventListener("pointerup", onEnd, true);
      ownerDocument.addEventListener("pointercancel", onEnd, true);
      ownerDocument.addEventListener("pointermove", onMove, true);
      ownerDocument.addEventListener("pointerout", onOut, true);
      activation = {
        stop: () => {
          ownerDocument.removeEventListener("pointerup", onEnd, true);
          ownerDocument.removeEventListener("pointercancel", onEnd, true);
          ownerDocument.removeEventListener("pointermove", onMove, true);
          ownerDocument.removeEventListener("pointerout", onOut, true);
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
    takeClick: (event) => {
      focusPath = NO_PATH;
      if (hold !== null && isHoldClick(hold, event.nativeEvent)) {
        releaseHold();
      }
    },
    holdChip: (element) => {
      if (hold === null) {
        return;
      }
      const child = stripChild(hold.strip, element);
      if (child === null || hold.elements.includes(child) || hold.held.includes(child)) {
        return;
      }
      child.style.setProperty(HELD_WIDTH, getComputedStyle(child).width);
      child.setAttribute(HELD, "");
      hold.held.push(child);
    },
    releaseHold,
    dispose: () => {
      endActivation(null);
    },
  };
}
