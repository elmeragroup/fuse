/**
 * The one owner of the user's input lifetimes over a carousel viewport: when input that can scroll
 * it begins, and when every such input has ended. The engine asks it whether input is held, so a
 * scroll session goes live only on the user's own scroll and nothing settles under a held finger.
 *
 * Input begins on the viewport: a pointer down, a key down, or a wheel turn the engine counts as
 * along its axis. Its end can land anywhere, so while input is held the owner listens on the
 * viewport's document in the capture phase, which sees every release before any handler can stop
 * it: a pointer up or cancel, a touch end or cancel, a key up, and a lost pointer capture. The
 * window losing focus ends all of it, since its releases go to another window. Pointers are held
 * one by one, by `pointerId`, so one of two fingers lifting leaves the other held. A touch the
 * browser takes for panning cancels its pointer before the pan begins, so that cancel does not end
 * touch input: the finger is still down with no pointer, until a touch event reports no touches
 * left. Where touch events do not exist, nothing would report that, so the cancel ends that touch.
 * A wheel turn has no end event: its scroll, if any, begins within
 * two frames, since the compositor can deliver the first scroll event a frame after the turn, so it
 * ends then. The document listeners exist only while input is held, so an idle carousel adds none.
 */

/** What the owner reports. */
export type CarouselInputListener = {
  /** Input that can scroll the viewport began, while none was held or more of it. */
  readonly onInput: () => void;
  /** Every held input has ended. */
  readonly onRelease: () => void;
};

/** A running owner. */
export type CarouselInput = {
  /** Whether any input that can scroll the viewport is held. */
  readonly held: () => boolean;
  /** A wheel turn along the carousel's axis began, as the engine judged it. */
  readonly wheel: () => void;
  /** Stop listening. */
  readonly destroy: () => void;
};

/**
 * Own the input lifetimes of a viewport.
 *
 * @param viewport - The scroll container input begins on.
 * @param listener - Where the owner reports.
 * @returns The owner. Call `destroy` when the viewport unmounts.
 */
export function createCarouselInput(viewport: HTMLElement, listener: CarouselInputListener): CarouselInput {
  const doc = viewport.ownerDocument;
  const view = doc.defaultView;
  const touchEvents = view !== null && "ontouchstart" in view;
  // What is held: the pointers down, by `pointerId`, whether a touch the browser took for panning
  // is still down without its pointer, the keys down, by physical key, and a wheel turn.
  const pointers = new Map<number, "touch" | "other">();
  let panning = false;
  const keys = new Set<string>();
  let wheelFrame: number | null = null;
  const capture = { capture: true, passive: true } as const;
  const passive = { passive: true } as const;

  function held(): boolean {
    return pointers.size > 0 || panning || keys.size > 0 || wheelFrame !== null;
  }

  /** Run a change to what is held, and report the input beginning or all of it ending. */
  function change(apply: () => void, began: boolean): void {
    const before = held();
    apply();
    const after = held();
    if (!before && after) {
      listen();
    }
    if (began) {
      listener.onInput();
    }
    if (before && !after) {
      unlisten();
      listener.onRelease();
    }
  }

  function endAll(): void {
    change(() => {
      pointers.clear();
      panning = false;
      keys.clear();
      if (wheelFrame !== null) {
        view?.cancelAnimationFrame(wheelFrame);
        wheelFrame = null;
      }
    }, false);
  }

  function onPointerDown(event: PointerEvent): void {
    change(() => pointers.set(event.pointerId, event.pointerType === "touch" ? "touch" : "other"), true);
  }

  function onPointerUp(event: PointerEvent): void {
    change(() => pointers.delete(event.pointerId), false);
  }

  function onPointerCancel(event: PointerEvent): void {
    change(() => {
      // A touch cancelled for panning is still down; a touch event says when every finger is up.
      if (pointers.delete(event.pointerId) && event.pointerType === "touch" && touchEvents) {
        panning = true;
      }
    }, false);
  }

  function onTouchEnd(event: TouchEvent): void {
    if (event.touches.length === 0) {
      change(() => {
        panning = false;
        // Every finger is up, those whose pointer was cancelled and any whose lift came first.
        for (const [id, kind] of pointers) {
          if (kind === "touch") {
            pointers.delete(id);
          }
        }
      }, false);
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    change(() => keys.add(event.code), true);
  }

  function onKeyUp(event: KeyboardEvent): void {
    change(() => keys.delete(event.code), false);
  }

  function onLostCapture(event: PointerEvent): void {
    // A touch loses capture as the browser takes it for panning, which its cancel already covers.
    if (event.pointerType !== "touch") {
      change(() => pointers.delete(event.pointerId), false);
    }
  }

  function listen(): void {
    doc.addEventListener("pointerup", onPointerUp, capture);
    doc.addEventListener("pointercancel", onPointerCancel, capture);
    doc.addEventListener("lostpointercapture", onLostCapture, capture);
    doc.addEventListener("touchend", onTouchEnd, capture);
    doc.addEventListener("touchcancel", onTouchEnd, capture);
    doc.addEventListener("keyup", onKeyUp, capture);
    view?.addEventListener("blur", endAll, passive);
  }

  function unlisten(): void {
    doc.removeEventListener("pointerup", onPointerUp, capture);
    doc.removeEventListener("pointercancel", onPointerCancel, capture);
    doc.removeEventListener("lostpointercapture", onLostCapture, capture);
    doc.removeEventListener("touchend", onTouchEnd, capture);
    doc.removeEventListener("touchcancel", onTouchEnd, capture);
    doc.removeEventListener("keyup", onKeyUp, capture);
    view?.removeEventListener("blur", endAll);
  }

  viewport.addEventListener("pointerdown", onPointerDown, passive);
  viewport.addEventListener("keydown", onKeyDown, passive);

  return {
    held,
    wheel() {
      change(() => {
        if (wheelFrame !== null || view === null) {
          return;
        }
        wheelFrame = view.requestAnimationFrame(() => {
          wheelFrame = view.requestAnimationFrame(() => {
            change(() => {
              wheelFrame = null;
            }, false);
          });
        });
      }, true);
    },
    destroy() {
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("keydown", onKeyDown);
      if (wheelFrame !== null) {
        view?.cancelAnimationFrame(wheelFrame);
        wheelFrame = null;
      }
      pointers.clear();
      panning = false;
      keys.clear();
      unlisten();
    },
  };
}
