/**
 * How many of the elements around a root lie exactly behind it, which decides whose background the
 * root shows across its box. The capture's page function reads each element's boxes and paint, and
 * this function decides, so a test can hold the rule to boxes Chromium measured.
 */

/** A box in CSS pixels. */
export type Rect = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

/** An element around the root, from the root's parent outward, as the page reads it. */
export type AroundBox = {
  /** The element's padding box: its border box less its border. */
  readonly padding: Rect;
  /**
   * Each element child other than the one the chain to the root runs through, and the element's own
   * paint that can lie over the root: whether the page counts it as reaching the root's box, and
   * whether it paints none of what the page checks, no background, border, shadow, outline, backdrop
   * filter, text or drawn content.
   */
  readonly others: readonly { readonly meets: boolean; readonly paintsNothing: boolean }[];
};

/**
 * The elements around a root, innermost first, whose padding box is the root's border box, up to
 * the first that is not, where the page counts no other child of each as reaching the root. The
 * page counts the paint it lists in `measuredFacts` and measures none, so paint it does not list
 * goes unseen (issue #766). A background such an element paints shows across the whole root where
 * nothing lies between them (CSS 2.1 Appendix E), as the Sidebar Provider's wrapper holds the
 * panel's container. An element with padding or border around the root, as a popup's content
 * around its rows, is no such element, and neither is any further out.
 *
 * @param root - The root's border box.
 * @param around - The elements around it, from its parent outward.
 * @returns How many of them, innermost first, coincide with the root.
 */
export function coincidingAround(root: Rect, around: readonly AroundBox[]): number {
  // Two edges half a pixel apart meet, for subpixel layout. The capture's page runs this function
  // from its source, so it holds every name it reads.
  const same = (a: number, b: number): boolean => Math.abs(a - b) <= 0.5;
  const index = around.findIndex(
    ({ padding, others }) =>
      !(
        same(padding.left, root.left) &&
        same(padding.top, root.top) &&
        same(padding.right, root.right) &&
        same(padding.bottom, root.bottom) &&
        others.every(({ meets, paintsNothing }) => !meets || paintsNothing)
      )
  );
  return index === -1 ? around.length : index;
}
