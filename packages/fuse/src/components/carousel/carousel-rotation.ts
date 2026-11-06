"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FocusEvent, PointerEvent, RefObject } from "react";

import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { deepActiveElement, hasFocus } from "../../internal/active-element";
import { containsAcrossShadowRoots } from "../../internal/dom-node";

function subscribeToVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => {
    document.removeEventListener("visibilitychange", onChange);
  };
}

function documentHidden(): boolean {
  return document.visibilityState === "hidden";
}

function serverDocumentHidden(): boolean {
  return false;
}

/**
 * The element that has keyboard focus in `doc`, followed down through open shadow roots, or null.
 * The browser's `:focus-visible` heuristic says whether focus arrived by keyboard: it matches
 * after Tab, an arrow key or a programmatic focus that follows keyboard use, and on a text field
 * however it was focused, and not after a click on a button, which is a control press and stops
 * rotation on its own. It is read on the focused element itself, since a shadow host does not
 * match `:focus-visible` for focus inside its shadow root.
 */
function keyboardFocusedElement(doc: Document): Element | null {
  const active = deepActiveElement(doc);
  return active?.matches(":focus-visible") === true ? active : null;
}

/**
 * Whether a mouse or pen is over `root` now, by the engine's own `:hover`, for hover that began
 * before the Root could listen, such as while a server-rendered page hydrates. Only where the
 * primary pointer can hover: a touch screen's tap leaves `:hover` on what it tapped, which mobile
 * WebKit keeps until the next tap elsewhere, so where the primary pointer cannot hover,
 * `:hover` does not say a pointer is over the carousel. `(hover: hover)` asks that of the
 * primary pointer; `(any-hover: hover)` would also hold on a tablet with a trackpad attached,
 * where a finger's tap still sets a `:hover` no pointer would ever clear, and `(pointer: fine)`
 * asks about precision, not hover.
 */
function hoveredNow(root: HTMLElement): boolean {
  const view = root.ownerDocument.defaultView;
  return view !== null && view.matchMedia("(hover: hover)").matches && root.matches(":hover");
}

/**
 * Whether keyboard focus is inside `root` now: the focused element, followed out of any shadow
 * root, is `root` or inside it, and matches `:focus-visible`.
 */
function keyboardFocusInside(root: HTMLElement): boolean {
  const focused = keyboardFocusedElement(root.ownerDocument);
  return focused !== null && containsAcrossShadowRoots(root, focused);
}

/**
 * Whether `element`, which the Root's focus event recorded, still has keyboard focus. Removing a
 * focused element blurs it without a blur the Root can hear: React suppresses its synthetic blur
 * during the commit that removes it, and Firefox fires none on removal, so the record can outlive
 * the focus. The element must still be in the document and focused in its own root, which covers
 * a shadow root and a same-origin frame, and still match `:focus-visible`.
 */
function stillKeyboardFocused(element: Element | null): boolean {
  return element !== null && element.isConnected && hasFocus(element) && element.matches(":focus-visible");
}

/**
 * What the user chose: nothing yet, so rotation follows the motion preference, or to play or stop
 * it. `playing` is the APG example's `hasUserActivatedPlay`: the user pressed the rotation control
 * to start it, so focus and hover no longer stop or pause it until they press it again.
 *
 * `unread` comes first: an Autoplay mounted, and the Root has not yet read whether keyboard focus
 * is already inside it, so nothing rotates. Mounting an Autoplay returns to it; the Root's next
 * layout effect reads the Root and settles it as `stopped` or `auto`. Changing the delay keeps
 * the choice.
 */
type RotationChoice = "unread" | "auto" | "playing" | "stopped";

/** What the Root reads from its rotation. */
export type Rotation = {
  /** A `Carousel.Autoplay` is mounted and nothing stopped it. */
  readonly rotating: boolean;
  /** The pages advance now: rotating, not paused by hover and not hidden. */
  readonly running: boolean;
  /** Start rotation, when a `Carousel.Autoplay` is mounted. */
  readonly play: () => void;
  /** Stop rotation until `play`. */
  readonly stop: () => void;
  /** Mount a `Carousel.Autoplay`, which resets the choice. The returned function unmounts it. */
  readonly mount: () => () => void;
  /** Set how long each page shows, in ms. It keeps the user's choice. */
  readonly setDelay: (delay: number) => void;
  /** The Root's element, which an Autoplay mounting late reads hover and focus from. */
  readonly root: RefObject<HTMLElement | null>;
  /**
   * The Root's handlers: hover pauses rotation, and keyboard focus stops it. Focus and blur also
   * track which element in the Root's React tree has keyboard focus, for an Autoplay mounting late.
   */
  readonly rootHandlers: {
    readonly onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
    readonly onPointerLeave: () => void;
    readonly onFocus: (event: FocusEvent<HTMLElement>) => void;
    readonly onBlur: () => void;
  };
};

/**
 * The carousel's automatic rotation, which exists while a `Carousel.Autoplay` is mounted. It
 * follows the normative APG carousel pattern, which says "automatic slide rotation stops when any
 * element in the carousel receives keyboard focus. It does not resume unless the user activates
 * the rotation control", and, of a rotating carousel, that it "stops rotating when keyboard focus
 * enters the carousel". The APG example's script leaves the rotation control out of its focus
 * listeners; the pattern's text has no such exception, and the control is first in the tab
 * order, so keeping it would leave the slides moving for a keyboard user who tabs in. So:
 *
 * - it starts on mount unless the user prefers reduced motion, and until the user chooses, it
 *   follows that preference; an Autoplay starts from what is already so, whether it mounts with
 *   the Root or after it: paused if a mouse or pen is over the Root, even since before
 *   hydration where the primary pointer can hover, and stopped if keyboard
 *   focus is inside it, an `autoFocus` field's and a portal's from a slide included; focus a mouse
 *   press moved in is not keyboard focus, so it does not stop rotation;
 * - keyboard focus on any element in the carousel, the rotation control included, stops it, and
 *   the rotation control then reads "Start"; that is focus anywhere in its React tree, a portal,
 *   one into a same-origin frame, or an open shadow root included;
 * - pressing the rotation control to start it is the explicit restart: from then on, as the
 *   example's `hasUserActivatedPlay` does, neither keyboard focus nor hover stops or pauses it, so
 *   it keeps running with focus still on the control, until the control is pressed again;
 * - until then it pauses while a mouse or pen is over the Root;
 * - it pauses while the document is hidden;
 * - any other user action, a control press or an interaction with the viewport, stops it, which
 *   the Root does through `stop`;
 * - every `delay` ms it advances a page, from the last page back to the first.
 *
 * @param index - The current page.
 * @param pageCount - The page count; one page or none never rotates.
 * @param advance - Change the page by rotation.
 * @returns The rotation's state and controls.
 */
export function useCarouselRotation(
  index: number,
  pageCount: number,
  advance: (index: number) => void
): Rotation {
  // A mounted Autoplay sets its delay in a layout effect, so a delay means one is mounted.
  const [delay, setDelay] = useState<number | null>(null);
  const [choice, setChoice] = useState<RotationChoice>("unread");
  const [hovered, setHovered] = useState(false);
  // The Root's element, whether a mouse or pen is over it and which element in its React tree has
  // keyboard focus, tracked with or without an Autoplay, in refs, so the tracking renders nothing
  // until an Autoplay reads it.
  const root = useRef<HTMLElement | null>(null);
  const pointerOver = useRef(false);
  const keyboardFocused = useRef<Element | null>(null);
  const reducedMotion = useReducedMotion();
  const hidden = useSyncExternalStore(subscribeToVisibility, documentHidden, serverDocumentHidden);

  // Reduced motion holds rotation until the user starts it. The server cannot read the
  // preference, so a server render rotates until hydration reads it.
  const mounted = delay !== null;
  const rotating = mounted && (choice === "playing" || (choice === "auto" && !reducedMotion));
  // Hover pauses only rotation the user did not start themselves.
  const paused = hovered && choice !== "playing";
  const running = rotating && !paused && !hidden && pageCount > 1;

  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = setTimeout(() => advance(index >= pageCount - 1 ? 0 : index + 1), delay);
    return () => clearTimeout(timer);
  }, [running, delay, index, pageCount, advance]);

  // An Autoplay starts from the Root as it is: paused under the pointer already over it, and
  // stopped, as APG asks, with keyboard focus already inside. Focus inside is either in the Root's
  // element, read from the document, which also finds focus that arrived before the Root could
  // listen, or in a portal from its tree, which the element does not contain and only the tracked
  // focus events report. The tracked element is checked again before it counts, since removing it
  // fires no blur the Root hears, which `stillKeyboardFocused` explains. The Autoplay's own layout effect is too early to read that on a first
  // mount: it runs before its ancestor Root's ref attaches, and before an `autoFocus` later in the
  // tree takes focus, whose focus event then finds no Autoplay mounted. So mounting only marks the
  // choice `unread`, which rotates nothing, and the Root reads itself in its own layout effect
  // after the commit that mounted the Autoplay. That commit has attached every ref and applied
  // every `autoFocus`, and the read comes before paint and before any rotation timer, which waits
  // for a settled choice.
  const mount = useCallback(() => {
    setChoice("unread");
    return () => setDelay(null);
  }, []);
  useLayoutEffect(() => {
    if (mounted && choice === "unread") {
      const element = root.current;
      setHovered(pointerOver.current || (element !== null && hoveredNow(element)));
      const focused =
        stillKeyboardFocused(keyboardFocused.current) || (element !== null && keyboardFocusInside(element));
      setChoice(focused ? "stopped" : "auto");
    }
  }, [mounted, choice]);
  const play = useCallback(() => setChoice("playing"), []);
  const stop = useCallback(() => setChoice("stopped"), []);

  // The pointer's presence is always tracked, in the ref; only a mounted Autoplay turns it into
  // state, so a carousel without one does not render on every pointer crossing. This is the hover
  // the pause reads, a mouse or pen over the Root; `:hover` is read only once, as the choice
  // settles, for hover that began before the Root could listen, and only where it means a
  // pointer, which `hoveredNow` explains.
  const onPointerEnter = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      // A touch enters and leaves with the finger, so it never hovers; its drag stops rotation.
      if (event.pointerType === "touch") {
        return;
      }
      pointerOver.current = true;
      if (mounted) {
        setHovered(true);
      }
    },
    [mounted]
  );
  const onPointerLeave = useCallback(() => {
    pointerOver.current = false;
    setHovered(false);
  }, []);
  // The focus event says focus moved inside the carousel's tree, portals included, so only how it
  // arrived is left to read, on the focused element itself, as on mount: the event's target is
  // retargeted to a shadow host, which does not match `:focus-visible` for focus inside it. The
  // read starts from the target's own document, since a portal into a same-origin frame focuses
  // an element there, and the Root's document names only the frame, which does not match it.
  // Focus moving within the tree blurs before it focuses again, so the ref ends on the new element.
  const onFocus = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const focused = keyboardFocusedElement(event.target.ownerDocument);
      keyboardFocused.current = focused;
      if (mounted && focused !== null) {
        setChoice((current) => (current === "playing" ? current : "stopped"));
      }
    },
    [mounted]
  );
  const onBlur = useCallback(() => {
    keyboardFocused.current = null;
  }, []);

  return {
    rotating,
    running,
    play,
    stop,
    mount,
    setDelay,
    root,
    rootHandlers: { onPointerEnter, onPointerLeave, onFocus, onBlur },
  };
}
