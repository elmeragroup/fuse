/**
 * Whether an absolute element can draw as a layer of its containing block's frame, where that block
 * is an element above the element's parent, as Toast's root places the close its content column
 * holds. Figma places a layer against its parent frame only, so the kit lifts such an element out of
 * its parent's frame into the block's, as its last layer, at the distances CSS gives it from the
 * block's padding edge (CSS 2.1 §10.1, §10.3.7, §10.6.4).
 *
 * The capture's page function calls `blockFrame` on each element of a root's tree, in every mode it
 * stamps. It is passed to the page as its source, so it reads nothing outside its own body and the
 * helpers it is handed (`containing-block.ts`, `paints-over.ts`, `stacking.ts`).
 */

import type { BlockHelpers } from "./containing-block.ts";
import type { Stacking } from "./stacking.ts";

/**
 * What the page reads of an element that can draw in its containing block's frame: the steps up to
 * that block, and the computed `background-color` of each `::before` or `::after` box that CSS
 * paints over the element, which Node must judge clear (`clear-fill.ts`) before it records the steps.
 */
export type BlockReading = {
  /** The steps from the element up to its containing block, two or more. */
  readonly steps: number;
  /** The fills of the generated boxes over the element, each of which must paint nothing. */
  readonly fills: readonly string[];
};

/**
 * How many steps up an absolute element's containing block sits, where the element paints as the
 * last layer of that block's frame would and sits on its offsets from the block's padding edge with
 * the block grown, with the fills that must be clear for that to hold, or undefined. Runs in the
 * page.
 *
 * - The element is absolute, displayed, not moved by a transform, translate, rotate or scale, and
 *   its `z-index` is `auto`. Each of its margins computes to 0, since the kit places the layer by
 *   its offsets alone, and the page cannot tell from computed styles which offsets CSS sets. Its
 *   parent is static, and its nearest positioned ancestor, the
 *   containing block, is the captured root or an element below it, so the set draws the block.
 * - The block's padding box, derived from the element's own box, margins and used offsets, is that
 *   ancestor's padding box within a layout unit. A transform, a filter or containment on an element
 *   between would make that element the block and move the padding box off the ancestor's.
 * - With the ancestor 10px wider through `min-width`, the same holds, and again with it 10px
 *   taller through `min-height` alone. The ancestor is the block, so the elements between do not
 *   move the element, whatever their sizes.
 * - The element and each element from its parent up to, but not including, the ancestor compute
 *   `visibility: visible`. Each element between overflows visibly, sets a `z-index` of `auto`, paints
 *   its subtree as no group (`stackingOf`), and generates no box an author can position
 *   (`generatedBoxes` in `paints-over.ts`), so the kit drops nothing the element takes from them once
 *   it leaves their frames. An element between may set
 *   `isolation: isolate`, which forms a stacking context and applies no visual effect to the group
 *   (CSS Compositing and Blending 1 §4). Lifting the element out of it then changes nothing, since
 *   nothing inside the group or after it stacks over the element, as a later point requires. The
 *   one thing isolation changes is what a blend mode inside it blends with, so the page refuses an
 *   isolated element between where the element, a box inside it, or a `::before` or `::after` box
 *   of either sets a `mix-blend-mode`.
 * - No box inside the element, and no box that it or a box inside it generates, has a negative
 *   `z-index` that applies. Where the element forms no stacking context, such a box paints
 *   in the stacking context above the element, under the in-flow boxes there (CSS 2.1 Appendix E,
 *   step 3), and the kit, drawing it inside the element's layer, would paint it over them. The page
 *   refuses one even where the element looks like a stacking context, since a `will-change` forms one
 *   only for some properties.
 * - Nothing paints over the element, as `boxesOver` in `paints-over.ts` decides, other than a
 *   `::before` or `::after` box that paints nothing: an empty `content`, no background image,
 *   shadow, border, border image, outline, filter or backdrop filter, and a fill Node judges clear.
 *   Toast's root generates such an `::after`, the clear strip that keeps a pointer over the gap
 *   below the toast.
 * - The element and each element from it up to the ancestor compute `order: 0`. A flex or grid
 *   container paints its items in order-modified document order (CSS Flexbox 1 §5.4.1, CSS Grid 1
 *   §9.5), so an `order` there could paint the element under a box it follows in the tree.
 *
 * The page restores the ancestor's `style` attribute before it returns, also where a reading throws.
 *
 * @param element - The element.
 * @param root - The captured root the element sits below.
 * @param helpers - What the page hands in.
 * @param stacking - The reads of `stacking.ts`, handed to the page with this function.
 * @returns The steps and the fills Node judges, or undefined.
 */
export function blockFrame(
  element: Element,
  root: Element,
  helpers: BlockHelpers,
  stacking: Stacking
): BlockReading | undefined {
  // Chromium lays boxes out in 1/64 of a CSS pixel, so edges closer than that are one edge.
  const unit = 1 / 64;
  const px = (value: string): number | undefined =>
    /^-?\d+(?:\.\d+)?(?:e-?\d+)?px$/.test(value) ? Number.parseFloat(value) : undefined;
  const found = helpers.containingBlockAbove(element, root);
  const itself = getComputedStyle(element);
  if (
    found === undefined ||
    itself.zIndex !== "auto" ||
    ["top", "right", "bottom", "left"].some((side) => px(itself.getPropertyValue(`margin-${side}`)) !== 0)
  ) {
    return undefined;
  }
  const { between, block } = found;
  const { appliedLevel, containerDisplay } = stacking;
  const subtree = [element, ...element.querySelectorAll("*")];
  // Each box of the element's subtree, its own and its generated ones, with the `display` of the
  // element that lays it out.
  const boxes = subtree.flatMap((each) => [
    { own: getComputedStyle(each), container: containerDisplay(each.parentElement) },
    ...helpers.generatedBoxes(each, stacking),
  ]);
  const isolated = between.some((each) => getComputedStyle(each).isolation === "isolate");
  const sinks = boxes.some(({ own, container }) => (appliedLevel(own, container) ?? 0) < 0);
  const transparent =
    stacking.keepsTreeOrder(element, block) &&
    [element, ...between].every((each) => getComputedStyle(each).visibility === "visible") &&
    !(isolated && boxes.some(({ own }) => own.mixBlendMode !== "normal")) &&
    !sinks &&
    between.every((each) => {
      const style = getComputedStyle(each);
      return (
        style.overflowX === "visible" &&
        style.overflowY === "visible" &&
        style.zIndex === "auto" &&
        helpers.stackingOf(style, appliedLevel(style, containerDisplay(each.parentElement)) !== undefined) !==
          "group" &&
        helpers.generatedBoxes(each, stacking).length === 0
      );
    });
  if (!transparent) {
    return undefined;
  }
  const paintsNothing = (own: CSSStyleDeclaration): boolean =>
    own.content === '""' &&
    ["background-image", "box-shadow", "border-image-source", "filter", "backdrop-filter"].every(
      (name) => own.getPropertyValue(name) === "none"
    ) &&
    ["top", "right", "bottom", "left"].every(
      (side) =>
        ["none", "hidden"].includes(own.getPropertyValue(`border-${side}-style`)) ||
        px(own.getPropertyValue(`border-${side}-width`)) === 0
    ) &&
    (own.outlineStyle === "none" || px(own.outlineWidth) === 0);
  const covering = helpers.boxesOver(element, root, stacking, helpers.generatedBoxes);
  if (covering === undefined || !covering.every(({ own }) => paintsNothing(own))) {
    return undefined;
  }
  const onOffsets = (): boolean => {
    const derived = helpers.offsetEdges(element);
    const padding = helpers.paddingEdges(block);
    return derived?.every((edge, index) => Math.abs(edge - (padding[index] ?? Number.NaN)) < unit) === true;
  };
  return onOffsets() && helpers.grownAlike(block, onOffsets, helpers.withStyles)
    ? { steps: between.length + 1, fills: covering.map(({ own }) => own.backgroundColor) }
    : undefined;
}
