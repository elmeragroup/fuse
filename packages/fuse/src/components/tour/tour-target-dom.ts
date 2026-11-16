// Finding a step's element in the page. The session waits here for a step's element before it
// shows the step; nothing here touches React or the session state.

/**
 * The attribute plain HTML marks a step's element with: `data-tour-step="<tourId>.<stepId>"`.
 *
 * @beta
 */
export const TOUR_STEP_ATTRIBUTE = "data-tour-step";

/**
 * The element whose `data-tour-step` names `key`. The attribute holds a space-separated list, so
 * one element can serve several tours, and the match is by whole entry: `welcome.step-1` never
 * matches `welcome.step-10`.
 *
 * @param key - The step key, `"<tourId>.<stepId>"`.
 * @returns The first such element in document order, or `null`.
 */
export function queryTourStepElement(key: string): Element | null {
  return document.querySelector(`[${TOUR_STEP_ATTRIBUTE}~="${CSS.escape(key)}"]`);
}

/**
 * Whether a user could see `element`: it is connected, laid out with a size, and not hidden by
 * `display`, `visibility`, `content-visibility` or zero opacity.
 *
 * @param element - The element.
 * @returns Whether it is visible.
 */
export function isTourTargetVisible(element: Element): boolean {
  if (!element.isConnected) {
    return false;
  }
  // Safari before 17.4, inside Fuse's floor, has no `checkVisibility`. There the zero-size check
  // below covers `display: none`, and the computed style covers `visibility`.
  const shown =
    "checkVisibility" in element
      ? element.checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
          contentVisibilityAuto: true,
        })
      : getComputedStyle(element).visibility !== "hidden";
  if (!shown) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Whether at least 80% of `element`, or of the viewport when it is taller, lies inside the
 * viewport, so the session can show the step without scrolling.
 *
 * @param element - The element.
 * @returns Whether it is mostly in view.
 */
export function isMostlyInView(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const height = window.innerHeight;
  const visible = Math.min(rect.bottom, height) - Math.max(rect.top, 0);
  return visible >= Math.min(rect.height, height) * 0.8;
}

/** Options for `waitForTourTarget`. */
export type WaitForTourTargetOptions = {
  /** How long to wait, in milliseconds. */
  readonly timeoutMs: number;
  /** Ends the wait early. */
  readonly signal: AbortSignal;
};

/**
 * Waits for `find` to return a visible element. It looks again at most once per frame while the
 * document changes, through one `MutationObserver` on the root, and gives up after `timeoutMs`.
 *
 * @param find - Finds the element, or returns `null`.
 * @param options - The timeout and the abort signal.
 * @returns The element, or `null` on timeout or abort. It never rejects.
 */
export function waitForTourTarget(
  find: () => Element | null,
  { timeoutMs, signal }: WaitForTourTargetOptions
): Promise<Element | null> {
  const visible = (): Element | null => {
    const found = find();
    return found !== null && isTourTargetVisible(found) ? found : null;
  };
  const first = visible();
  if (first !== null || signal.aborted) {
    return Promise.resolve(first);
  }
  return new Promise((resolve) => {
    let frame = 0;
    const observer = new MutationObserver(() => {
      if (frame === 0) {
        frame = requestAnimationFrame(check);
      }
    });
    const finish = (element: Element | null): void => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(element);
    };
    function check(): void {
      frame = 0;
      const found = visible();
      if (found !== null) {
        finish(found);
      }
    }
    const onAbort = (): void => {
      finish(null);
    };
    const timer = setTimeout(() => {
      finish(visible());
    }, timeoutMs);
    signal.addEventListener("abort", onAbort);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden", TOUR_STEP_ATTRIBUTE],
    });
  });
}
