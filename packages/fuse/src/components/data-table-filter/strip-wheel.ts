/**
 * The size of one line of a line-mode wheel turn, as Chromium scrolls a line and as
 * `normalize-wheel` sizes one. Firefox reports a mouse wheel's notch in lines.
 */
const LINE_PX = 40;

/**
 * Below this many pixels from an end, the strip counts as at that end. `scrollWidth` and
 * `clientWidth` round a fractional box, and a right-to-left box snaps `scrollLeft` to whole
 * pixels, so its end can sit a pixel short of the range they give.
 */
const END_TOLERANCE_PX = 2;

/** The strip's scroll state along its inline axis. */
type InlineScroll = {
  /** How far the strip has scrolled from its inline start, never negative. */
  readonly position: number;
  /** How far it can scroll, 0 when its content fits. */
  readonly range: number;
  /** One page, the strip's visible width. */
  readonly page: number;
  readonly direction: "ltr" | "rtl";
};

function pixelsPerDelta(deltaMode: number, page: number): number {
  switch (deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      return LINE_PX;
    case WheelEvent.DOM_DELTA_PAGE:
      return page;
    default:
      return 1;
  }
}

/**
 * Whether a wheel turn is one the strip may take: a vertical one, since a sideways one scrolls the
 * strip natively, and not one with Ctrl held, which is a pinch zoom.
 */
function turnsVertically(wheel: WheelEvent): boolean {
  return !wheel.ctrlKey && Math.abs(wheel.deltaY) > Math.abs(wheel.deltaX);
}

/**
 * How far a vertical wheel turn moves the strip, as a change of `scrollLeft`, or `null` to leave
 * the turn to the page, once the strip cannot move that way. Down moves toward the inline end,
 * which is to the left in a right-to-left strip.
 */
function wheelScrollLeft(wheel: WheelEvent, scroll: InlineScroll): number | null {
  const towardEnd = wheel.deltaY * pixelsPerDelta(wheel.deltaMode, scroll.page);
  const room = towardEnd > 0 ? scroll.range - scroll.position : scroll.position;
  if (room < END_TOLERANCE_PX) {
    return null;
  }
  return scroll.direction === "rtl" ? -towardEnd : towardEnd;
}

function inlineScrollOf(strip: HTMLElement): InlineScroll {
  const direction = getComputedStyle(strip).direction === "rtl" ? "rtl" : "ltr";
  // A right-to-left box scrolls from 0 at its start to negative `scrollLeft` values.
  return {
    position: direction === "rtl" ? -strip.scrollLeft : strip.scrollLeft,
    range: strip.scrollWidth - strip.clientWidth,
    page: strip.clientWidth,
    direction,
  };
}

/**
 * A ref callback that lets a vertical mouse wheel scroll a sideways strip. React's `onWheel` is
 * passive and cannot keep the page from scrolling, so the listener is native. A turn the strip
 * cannot take scrolls the page as usual, and a turn a descendant already cancelled stays cancelled.
 * The jump is instant, as a native wheel scroll is.
 *
 * @param strip - The strip, a horizontal scroll box.
 * @returns The listener's removal.
 */
export function scrollStripOnWheel(strip: HTMLElement | null): (() => void) | undefined {
  if (strip === null) {
    return undefined;
  }
  const onWheel = (event: WheelEvent) => {
    // The cheap checks go first, so a pinch or a sideways turn never reads the computed style.
    if (event.defaultPrevented || !turnsVertically(event)) {
      return;
    }
    const left = wheelScrollLeft(event, inlineScrollOf(strip));
    if (left !== null) {
      event.preventDefault();
      strip.scrollBy({ left, behavior: "instant" });
    }
  };
  strip.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    strip.removeEventListener("wheel", onWheel);
  };
}
