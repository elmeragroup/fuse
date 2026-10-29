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
