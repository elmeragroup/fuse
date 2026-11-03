/**
 * The painted box of a chart bar relative to its plot. A bar is an absolutely positioned box in
 * the plot, so its client rect is its painted rectangle.
 */

/** A box in pixels from the plot's top left. */
export type BarBox = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

/**
 * The painted box of a bar.
 *
 * @param bar - A `chart-bar` element.
 * @param plot - The plot box.
 * @returns The box in pixels from the plot's top left.
 */
export function barBox(bar: Element, plot: DOMRect): BarBox {
  const box = bar.getBoundingClientRect();
  return {
    left: box.left - plot.left,
    right: box.right - plot.left,
    top: box.top - plot.top,
    bottom: box.bottom - plot.top,
  };
}

/** A rectangle in SVG user units, from its top left. */
export type DrawnRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * The rectangle a bar, its overlay or its cap draws, read from the corners in its polygon's
 * `points`.
 *
 * @param polygon - A bar part drawn as an SVG polygon.
 * @returns The smallest rectangle holding its corners, or one of no size at the origin.
 * @throws When there is no element, so a test that lost its bar fails at the read.
 */
export function drawnRect(polygon: Element | null | undefined): DrawnRect {
  if (polygon === null || polygon === undefined) throw new Error("no bar to read");
  const corners = (polygon.getAttribute("points") ?? "")
    .trim()
    .split(/\s+/u)
    .filter((pair) => pair !== "")
    .map((pair) => pair.split(",").map(Number));
  if (corners.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = corners.map(([x = Number.NaN]) => x);
  const ys = corners.map(([, y = Number.NaN]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
