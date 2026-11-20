/**
 * Whether a child of the captured root paints over every other box of the root by its `z-index`, as
 * the root's last layer does in Figma. Figma paints a frame's layers in their order, a later one over
 * an earlier one, and has no stacking level. CSS paints a box with a positive `z-index` that applies
 * to it as a stacking context of its own, after every box of the root whose level is zero or `auto`,
 * and after one of a lower level, whatever their tree order (CSS 2.1 §9.9.1 and Appendix E, step 9).
 * The fact says only that CSS paints the box over the rest of the root and that nothing follows it
 * in the root. Where the kit's order of the root's layers also draws it last, which
 * `readRaisedLevels` in `components/paint-order.ts` checks, its `z-index` draws nothing more.
 *
 * The capture's page function calls `paintsLast` on each child of a root, in every mode it stamps. It
 * is passed to the page as its source, so it reads nothing outside its own body and its arguments.
 */

import type { Stacking } from "./stacking.ts";

/**
 * Whether an element paints over every other box of the captured root by its `z-index`, and is the
 * root's last child. Runs in the page. The fact holds only for CSS: whether the kit's order of the
 * root's layers also draws the element last is the mapping's to check (`readRaisedLevels` in
 * `components/paint-order.ts`).
 *
 * - The element is a child of the root, so no element between them forms a stacking context that
 *   would hold its level below a box of the root, and the kit's order of the root's layers is the
 *   only order that decides where Figma paints it.
 * - Its `z-index` is a positive integer that applies, as `appliedLevel` in `stacking.ts` decides. It
 *   then forms a stacking context, which paints its own subtree as one, as Figma paints a frame's
 *   layers inside it.
 * - Nothing follows it in the root: no element and no text other than white space, and the root
 *   generates no `::after` box, which CSS lays out as the root's last child (CSS Pseudo-Elements 4
 *   §3.1).
 * - No other element of the root, outside the element's subtree, the root included, and no `::before`
 *   or `::after` of one, has a `z-index` above the element's that applies to it. For a generated box the
 *   container walk starts at the element that generates it. CSS would paint that box over the
 *   element, while the kit draws the element last.
 * - A box at the same level paints under the element only where its tree order puts it first and no
 *   `order` can paint it last. A tie holds only where the element computes `order: 0`, a tied
 *   `::before` or `::after` does too, and `keepsTreeOrder` in `stacking.ts` holds from the tied
 *   element, or the element that generates the tied box, up to the root.
 *
 * The page does not read the host: where the root forms no stacking context, CSS also paints the
 * element over a box the host lays after the root, at level zero or `auto`, that overlaps it. A Figma
 * instance cannot paint part of itself over a later layer of its frame, and the set draws no host.
 *
 * @param element - The element.
 * @param root - The captured root.
 * @param stacking - The reads of `stacking.ts`, handed to the page with this function.
 * @returns True where the element paints last in the root by its `z-index`.
 */
export function paintsLast(element: Element, root: Element, stacking: Stacking): boolean {
  const { containerDisplay, appliedLevel, keepsTreeOrder } = stacking;
  // The level that applies to a box `from` holds in the tree, its own parent for an element's box and
  // the element for its `::before` or `::after`, as `stacking.ts` decides.
  const levelOf = (style: CSSStyleDeclaration, from: Element | null): number | undefined =>
    appliedLevel(style, containerDisplay(from));
  if (element.parentElement !== root) {
    return false;
  }
  const own = getComputedStyle(element);
  const raised = levelOf(own, root);
  if (raised === undefined || raised <= 0) {
    return false;
  }
  let after = element.nextSibling;
  while (after !== null) {
    if (after.nodeType === Node.ELEMENT_NODE || (after.textContent ?? "").trim() !== "") {
      return false;
    }
    after = after.nextSibling;
  }
  const rootAfter = getComputedStyle(root, "::after");
  if (!["none", "normal"].includes(rootAfter.content) && rootAfter.display !== "none") {
    return false;
  }
  // Whether a box paints over the element: a higher level, or the same level where an `order` can
  // move it after the element.
  const over = (other: number | undefined, keepsOrder: () => boolean): boolean =>
    other !== undefined && (other > raised || (other === raised && !(own.order === "0" && keepsOrder())));
  const others = [root, ...root.querySelectorAll("*")].filter((each) => !element.contains(each));
  return others.every((each) => {
    const style = getComputedStyle(each);
    const generated = ["::before", "::after"].map((pseudo) => getComputedStyle(each, pseudo));
    return (
      (each === root || !over(levelOf(style, each.parentElement), () => keepsTreeOrder(each, root))) &&
      generated.every(
        (pseudo) =>
          ["none", "normal"].includes(pseudo.content) ||
          pseudo.display === "none" ||
          !over(levelOf(pseudo, each), () => pseudo.order === "0" && keepsTreeOrder(each, root))
      )
    );
  });
}
