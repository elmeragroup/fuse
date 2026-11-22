/**
 * Which boxes CSS may paint over an absolute element that the kit draws as the last layer of a
 * frame, as `parent-spans-block.ts` draws it in its parent's frame and `block-frame.ts` in its
 * containing block's. Figma paints a frame's layers in their order and has no stacking level, so
 * the kit's last layer paints as CSS does only where nothing paints over the element. Both facts
 * read that through {@link boxesOver}, so they refuse the same boxes.
 *
 * The capture's page function hands these functions to both facts with the helpers of
 * `containing-block.ts`. Each is passed to the page as its source, so it reads nothing outside its
 * own body and its arguments.
 */

import type { Stacking } from "./stacking.ts";

/**
 * A box an element generates that an author can position: a `::before` or `::after` (CSS 2.1
 * §12.1), a scroller's buttons, marker group or markers (CSS Overflow 5), a `details` element's
 * content or a picker's icon.
 */
export type GeneratedBox = {
  /** The box's computed style. */
  readonly own: CSSStyleDeclaration;
  /** The `display` of the element that lays the box out, as `containerDisplay` in `stacking.ts` gives it. */
  readonly container: string;
  /** Whether the box paints at its element's place in tree order, as `::before` and `::after` do. */
  readonly anchored: boolean;
  /** Whether the box paints before its element's content, as `::before` does. */
  readonly first: boolean;
  /** Whether an animation runs on the box, which can make it a stacking context at any computed value. */
  readonly animated: () => boolean;
};

/**
 * The boxes an element generates that an author can position. `::marker` takes no `position`. A
 * scroller's marker group exists by its element's `scroll-marker-group` and a `details` element's
 * content box by the element, whatever their `content`. Every other pseudo-element exists by its
 * `content`, and Chromium computes no style, an empty `content`, for a pseudo-element an element
 * cannot have. A scroll marker paints in its scroller's marker group, and a scroller's buttons and
 * marker group and a `details` element's content box paint apart from tree order. Runs in the page.
 *
 * @param each - The element.
 * @param stacking - The reads of `stacking.ts`.
 * @returns Its generated boxes, in the order the list above names them.
 */
export function generatedBoxes(each: Element, stacking: Stacking): readonly GeneratedBox[] {
  const pseudos = [
    "::before",
    "::after",
    ...["up", "down", "left", "right", "block-start", "block-end", "inline-start", "inline-end"].map(
      (direction) => `::scroll-button(${direction})`
    ),
    "::scroll-marker-group",
    "::scroll-marker",
    "::details-content",
    "::picker-icon",
  ];
  const generates = (pseudo: string, own: CSSStyleDeclaration): boolean =>
    own.display !== "none" &&
    (pseudo === "::scroll-marker-group"
      ? getComputedStyle(each).getPropertyValue("scroll-marker-group") !== "none"
      : pseudo === "::details-content"
        ? each.localName === "details"
        : !["none", "normal", ""].includes(own.content));
  const container = stacking.containerDisplay(each);
  return pseudos.flatMap((pseudo) => {
    const own = getComputedStyle(each, pseudo);
    return generates(pseudo, own)
      ? [
          {
            own,
            container,
            first: pseudo === "::before",
            anchored: pseudo === "::before" || pseudo === "::after",
            animated: () =>
              each
                .getAnimations({ subtree: true })
                .some(
                  ({ effect }) =>
                    effect instanceof KeyframeEffect &&
                    effect.target === each &&
                    effect.pseudoElement === pseudo
                ),
          },
        ]
      : [];
  });
}

/**
 * The `::before` and `::after` boxes that CSS may paint over an element, where no other box may,
 * or undefined. A caller that refuses every such box takes an empty list only, and one that lets a
 * box paint over the element where it paints nothing judges each box it gets. Runs in the page.
 *
 * - The page compares no rectangles. A box of the captured root outside the element's subtree, or a
 *   box an element of the root generates, may paint over the element where it paints as a layer:
 *   it is positioned or may establish a stacking context (CSS 2.1 §9.9.1 and Appendix E). Every
 *   such layer after the element in tree order may, at any `z-index`. Every generated box other
 *   than `::before` and `::after` counts as after the element, since Chromium paints those apart
 *   from their element's place in tree order. A layer before the element may where its applied
 *   `z-index` is above the element's level, the lowest of the element's own and that of each
 *   ancestor below their common ancestor that may establish a stacking context, an `auto` counting
 *   as 0. A stacking context around the earlier box does not exempt it. Where the page cannot tell
 *   whether an element establishes one, as with a `will-change`, a transform on an inline box,
 *   `contain` on a table row or a running animation, it counts it as one.
 * - `stacking.ts` decides the level that applies to each box and the `display` of the element that
 *   lays it out. The element wins a tie only where `keepsTreeOrder` in `stacking.ts` holds from each
 *   of the two boxes up to their common ancestor. A box inside a `display: none` element paints
 *   nothing.
 * - The element's level, and that of each ancestor that may establish a stacking context, up to the
 *   captured root, is 0 or more. CSS paints a negative layer under the in-flow boxes of its context
 *   (CSS 2.1 Appendix E, steps 3 and 4).
 * - No element of the captured root preserves 3D. A 3D rendering context orders its boxes by depth,
 *   not by level or tree order (CSS Transforms 2 §2).
 * - No element of the document outside the element is in the top layer, an open popover, a modal
 *   dialog or a fullscreen element, which paints over every other box (CSS Positioned Layout 4).
 *   None computes `overlay: auto` either, which keeps a closing popover or dialog in the top layer
 *   while it transitions out.
 * - The element sits in no `legend` or `summary`. Chromium paints a fieldset's legend and a
 *   `details` element's summary apart from tree order.
 * - No element from the captured root down to the element both clips its overflow and sets a
 *   `resize`. Its resize grip paints over its content (CSS Basic User Interface 4).
 *
 * Apart from the top layer, the page reads only the boxes of the captured root's light tree. Paint
 * from elsewhere outside the captured root or inside a shadow tree can still cover the element
 * undetected.
 *
 * @param element - The element.
 * @param root - The captured root the element sits below.
 * @param stacking - The reads of `stacking.ts`.
 * @param generated - {@link generatedBoxes}, handed to the page with this function.
 * @returns The `::before` and `::after` boxes that may paint over the element, or undefined where
 *   another box may.
 */
export function boxesOver(
  element: Element,
  root: Element,
  stacking: Stacking,
  generated: typeof generatedBoxes
): readonly GeneratedBox[] | undefined {
  const { containerDisplay, appliedLevel, keepsTreeOrder } = stacking;
  // A box's computed style, the `display` of the box it is a flex or grid item of, if any, and
  // whether an animation runs on it, which can make it a stacking context at any computed value.
  type Styled = {
    readonly own: CSSStyleDeclaration;
    readonly container: string;
    readonly animated: () => boolean;
  };
  const styled = (each: Element): Styled => ({
    own: getComputedStyle(each),
    container: containerDisplay(each.parentElement),
    animated: () => each.getAnimations().length > 0,
  });
  const indexed = ({ own, container }: Styled): boolean => appliedLevel(own, container) !== undefined;
  // Properties whose value other than `none` makes a stacking context of a box they apply to (CSS
  // Transforms 1 §3, CSS Transforms 2, Filter Effects 1 §5, CSS Masking 1, Motion Path 1 §2).
  const contextProperties = [
    "transform",
    "translate",
    "rotate",
    "scale",
    "perspective",
    "offset-path",
    "filter",
    "backdrop-filter",
    "clip-path",
    "mask-image",
    "-webkit-mask-image",
    "-webkit-mask-box-image-source",
    "-webkit-box-reflect",
  ];
  // A box that may establish a stacking context: it does by its computed values, or may by a property
  // whose effect depends on the value or the box, such as a `will-change`, a transform on an inline
  // box, a 3D context, containment, `content-visibility` or a running animation.
  const mayEstablishStackingContext = (each: Styled): boolean => {
    const { own } = each;
    return (
      own.display !== "contents" &&
      (indexed(each) ||
        own.position === "fixed" ||
        own.position === "sticky" ||
        Number.parseFloat(own.opacity) < 1 ||
        own.isolation === "isolate" ||
        own.mixBlendMode !== "normal" ||
        own.willChange !== "auto" ||
        own.contain !== "none" ||
        own.getPropertyValue("content-visibility") !== "visible" ||
        own.getPropertyValue("transform-style") !== "flat" ||
        own.getPropertyValue("container-type") !== "normal" ||
        !["none", ""].includes(own.getPropertyValue("view-transition-name")) ||
        contextProperties.some((name) => own.getPropertyValue(name) !== "none") ||
        each.animated())
    );
  };
  // A box that paints as a layer of a stacking context and so may paint over the element: positioned,
  // or a stacking context.
  const paintsAsLayer = (each: Styled): boolean =>
    each.own.display !== "contents" && (each.own.position !== "static" || mayEstablishStackingContext(each));
  // The level a layer paints at: its `z-index`, or 0 for `auto`.
  const level = ({ own, container }: Styled): number => appliedLevel(own, container) ?? 0;
  const elementLevel = level(styled(element));
  // The level the element paints at among the boxes inside `around`: the lowest of its own and that
  // of each element between that may hold it in a stacking context of its own.
  const levelBelow = (around: Element): number => {
    let lowest = elementLevel;
    for (let each = element.parentElement; each !== null && each !== around; each = each.parentElement) {
      const computed = styled(each);
      if (mayEstablishStackingContext(computed)) {
        lowest = Math.min(lowest, level(computed));
      }
    }
    return lowest;
  };
  const rendered = (each: Element): boolean => {
    for (let around: Element | null = each; around !== null; around = around.parentElement) {
      if (getComputedStyle(around).display === "none") {
        return false;
      }
    }
    return true;
  };
  const covering: GeneratedBox[] = [];
  // Whether a box of the root outside the element may paint over it, where it is no `::before` or
  // `::after`, which lands in `covering` instead. A layer after the element in tree order may,
  // whatever its level. A layer before it may where its own `z-index` applies above the level the
  // element paints at inside the common ancestor `around` of the two, or where it ties that level
  // and an `order` can paint it later.
  const paintsOver = (each: Element): boolean => {
    if (element.contains(each) || !rendered(each)) {
      return false;
    }
    const holds = each.contains(element);
    let around: Element = each;
    while (!around.contains(element) && around.parentElement !== null) {
      around = around.parentElement;
    }
    const lowest = levelBelow(around);
    const covers = (box: Styled, earlier: boolean, ordered: () => boolean): boolean =>
      paintsAsLayer(box) &&
      (!earlier ||
        level(box) > lowest ||
        (level(box) === lowest && !(keepsTreeOrder(element, around) && ordered())));
    const earlier = (element.compareDocumentPosition(each) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
    const pseudoOver = generated(each, stacking).filter((pseudo) =>
      covers(
        pseudo,
        pseudo.anchored && (holds ? pseudo.first : earlier),
        () => pseudo.own.order === "0" && keepsTreeOrder(each, around)
      )
    );
    covering.push(...pseudoOver.filter(({ anchored }) => anchored));
    return (
      (!holds && covers(styled(each), earlier, () => keepsTreeOrder(each, around))) ||
      pseudoOver.some(({ anchored }) => !anchored)
    );
  };
  // The top layer paints over every box of the document (CSS Positioned Layout 4 §2), as does a
  // popover or dialog that `overlay: auto` keeps there while it transitions out.
  const lifted = [...document.querySelectorAll("*")].some(
    (each) =>
      !each.contains(element) &&
      (each.matches(":popover-open, :modal, :fullscreen") ||
        getComputedStyle(each).getPropertyValue("overlay") === "auto")
  );
  // A 3D rendering context orders its boxes by depth, not by level or tree order (CSS Transforms 2
  // §2), and it needs an element of the root that preserves 3D for boxes of the root to take part.
  const tree = [root, ...root.querySelectorAll("*")];
  const deep = tree.some((each) => getComputedStyle(each).getPropertyValue("transform-style") !== "flat");
  // Chromium paints a fieldset's rendered legend and a `details` element's summary apart from tree
  // order, so a box or generated box before or after them in the tree can paint over them.
  const reordered = element.closest("legend, summary") !== null;
  // A scroller that its user can resize paints its resize grip over its content.
  const gripped = tree.some((each) => {
    const own = getComputedStyle(each);
    return (
      each.contains(element) &&
      own.resize !== "none" &&
      (own.overflowX !== "visible" || own.overflowY !== "visible")
    );
  });
  return levelBelow(root) < 0 || lifted || deep || reordered || gripped || tree.some(paintsOver)
    ? undefined
    : covering;
}
