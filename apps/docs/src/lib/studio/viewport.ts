/**
 * The studio canvas's camera, as pure functions.
 *
 * A viewport maps a world point `w` to the screen point `w * zoom + (x, y)`, where screen
 * coordinates are relative to the canvas element's top-left corner. The canvas renders it as
 * `translate(x, y) scale(zoom)` on its world layer.
 */

export type Point = { readonly x: number; readonly y: number };

export type Size = { readonly width: number; readonly height: number };

export type Rect = Point & Size;

/** Screen pixels kept clear at each edge of the screen. */
export type Margins = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

export type Viewport = {
  /** The screen position of the world origin. */
  readonly x: number;
  readonly y: number;
  /** Screen pixels per world unit. */
  readonly zoom: number;
};

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

/** The stops the zoom buttons and shortcuts step through. */
const ZOOM_STOPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const;

/** The largest wheel delta one event counts, so a mouse-wheel notch zooms by at most ~1.65×. */
const WHEEL_DELTA_CAP = 50;
const WHEEL_ZOOM_RATE = 0.01;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function panBy(viewport: Viewport, delta: Point): Viewport {
  return { x: viewport.x + delta.x, y: viewport.y + delta.y, zoom: viewport.zoom };
}

export function screenToWorld(viewport: Viewport, point: Point): Point {
  return { x: (point.x - viewport.x) / viewport.zoom, y: (point.y - viewport.y) / viewport.zoom };
}

/**
 * Zooms to `zoom`, clamped, keeping the world point under `anchor` on the same screen point.
 *
 * @param anchor - The screen point to zoom around, such as the cursor.
 */
export function zoomAt(viewport: Viewport, anchor: Point, zoom: number): Viewport {
  const next = clampZoom(zoom);
  const world = screenToWorld(viewport, anchor);
  return { x: anchor.x - world.x * next, y: anchor.y - world.y * next, zoom: next };
}

/** Puts the centre of `rect` at the centre of `screen`, at `zoom`. */
function centred(rect: Rect, screen: Size, zoom: number): Viewport {
  return {
    x: screen.width / 2 - (rect.x + rect.width / 2) * zoom,
    y: screen.height / 2 - (rect.y + rect.height / 2) * zoom,
    zoom,
  };
}

/** The smallest rect holding every rect, or undefined for none. */
function bounds(rects: readonly Rect[]): Rect | undefined {
  if (rects.length === 0) {
    return undefined;
  }
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * The viewport that shows every rect, centred, with `padding` screen pixels to spare on each
 * side, at a zoom inside the range.
 *
 * @returns The viewport, or undefined when there is nothing to fit.
 */
export function fitRects(rects: readonly Rect[], screen: Size, padding: number): Viewport | undefined {
  const box = bounds(rects);
  if (box === undefined) {
    return undefined;
  }
  const zoom = clampZoom(
    Math.min(
      (screen.width - 2 * padding) / Math.max(box.width, 1),
      (screen.height - 2 * padding) / Math.max(box.height, 1)
    )
  );
  return centred(box, screen, zoom);
}

/**
 * The viewport that fills the room between the side margins with `rect`'s width, centred across
 * it, and puts `rect`'s top on the top margin, at a zoom inside the range. Its height is left to
 * scroll, for a screen too narrow to show a whole artboard at a readable size.
 */
export function fitWidth(
  rect: Rect,
  screen: Size,
  margins: Pick<Margins, "top" | "right" | "left">
): Viewport {
  const room = screen.width - margins.left - margins.right;
  const zoom = clampZoom(room / Math.max(rect.width, 1));
  return {
    x: margins.left + (room - rect.width * zoom) / 2 - rect.x * zoom,
    y: margins.top - rect.y * zoom,
    zoom,
  };
}

/**
 * Whether less than half of `rect` shows on the screen. A rect larger than the screen counts as
 * shown once it covers half the screen, so a zoomed-in artboard never counts as off screen.
 */
export function mostlyOffscreen(viewport: Viewport, rect: Rect, screen: Size): boolean {
  const left = rect.x * viewport.zoom + viewport.x;
  const top = rect.y * viewport.zoom + viewport.y;
  const width = rect.width * viewport.zoom;
  const height = rect.height * viewport.zoom;
  const shownWidth = Math.max(0, Math.min(left + width, screen.width) - Math.max(left, 0));
  const shownHeight = Math.max(0, Math.min(top + height, screen.height) - Math.max(top, 0));
  return shownWidth * shownHeight < Math.min(width * height, screen.width * screen.height) / 2;
}

/** The pan along one axis that brings `start..start + length` inside `before..size - after`. */
function revealDelta(start: number, length: number, size: number, before: number, after: number): number {
  const toStart = before - start;
  // A span longer than the room shows from its start, as reading order begins there.
  if (toStart > 0 || length > size - before - after) {
    return toStart;
  }
  return Math.min(0, size - after - (start + length));
}

/**
 * Pans by the smallest delta that shows `rect` with `margins` screen pixels to spare, keeping the
 * zoom. A rect already in view leaves the viewport as it is.
 *
 * @param rect - The world rect to show, such as a focused control.
 * @param margins - The room to keep clear at each edge, such as more at an edge an overlay covers.
 */
export function revealRect(viewport: Viewport, rect: Rect, screen: Size, margins: Margins): Viewport {
  const { top, right, bottom, left } = margins;
  return panBy(viewport, {
    x: revealDelta(
      rect.x * viewport.zoom + viewport.x,
      rect.width * viewport.zoom,
      screen.width,
      left,
      right
    ),
    y: revealDelta(
      rect.y * viewport.zoom + viewport.y,
      rect.height * viewport.zoom,
      screen.height,
      top,
      bottom
    ),
  });
}

/**
 * The next zoom stop above (`1`) or below (`-1`) `zoom`, or the end of the range.
 */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  if (direction === 1) {
    return ZOOM_STOPS.find((stop) => stop > zoom) ?? MAX_ZOOM;
  }
  return ZOOM_STOPS.findLast((stop) => stop < zoom) ?? MIN_ZOOM;
}

/**
 * The zoom multiplier for one wheel or pinch event. Trackpad pinches send small deltas and
 * zoom smoothly; a mouse-wheel notch is capped, so one click never jumps far.
 *
 * @param deltaY - The event's vertical delta in pixels; negative zooms in.
 */
export function wheelZoomFactor(deltaY: number): number {
  const capped = Math.max(-WHEEL_DELTA_CAP, Math.min(WHEEL_DELTA_CAP, deltaY));
  return Math.exp(-capped * WHEEL_ZOOM_RATE);
}
