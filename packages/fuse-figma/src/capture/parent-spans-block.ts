/**
 * Whether an absolute element's parent spans its containing block, so the kit can place the element
 * in its parent's frame as if the parent were that block. Figma places a layer against its parent
 * frame only. CSS places an absolute box against its containing block, the padding box of its
 * nearest positioned ancestor (CSS 2.1 §10.1), which can be an element above the parent, as Sheet's
 * popup is above the column that holds its corner close.
 *
 * The capture's page function calls `parentSpansBlock` on each element of a root's tree, in every
 * mode it stamps. It is passed to the page as its source, so it reads nothing outside its own body.
 */

/**
 * Whether an absolute element's static parent has, as its border box, the padding box of the
 * element's containing block, by the element's own geometry and with the block grown. Runs in the
 * page.
 *
 * - The element is absolute, displayed, and not moved by a transform, a translate, a rotate or a
 *   scale. Its parent is static, so the parent is not the containing block.
 * - The containing block's padding box follows from the element's own box: its border box, its
 *   margins and its used offsets, which Chromium resolves to pixels for a positioned box it laid out
 *   (CSSOM §9). The offsets, margins, borders, paddings and length add up to the block's length on
 *   each axis (CSS 2.1 §10.3.7, §10.6.4), so each edge of the block lies an offset and a margin past
 *   the element's edge. That padding box is the parent's border box, and the padding box of the
 *   nearest positioned ancestor, within a layout unit.
 * - That ancestor is the captured root or an element below it, so the set draws the block.
 * - From the parent up to that ancestor, each element is the only element child of the one above
 *   it, overflows visibly and sets no `clip-path`. No later sibling then paints over the element in
 *   Figma where CSS paints the element over it (CSS 2.1 Appendix E), and nothing between clips the
 *   element in Figma where CSS does not clip it (CSS Overflow 3 §3).
 * - From the parent up to that ancestor, the ancestor included, no element generates a `::before`
 *   or `::after` box, nor another box an author can position: a scroller's buttons, marker group
 *   or markers, a `details` element's content or a picker's icon. Above the parent, Figma draws
 *   such a box as a layer of its element's frame, beside the frame that holds the element, and no
 *   order of the two paints as CSS does in every case. CSS paints a positioned `::before` under the element and over the in-flow content around
 *   it, and the element over an in-flow `::after` (CSS 2.1 Appendix E, steps 4 to 8). The parent's
 *   own absolute `::before` or `::after` has the block above it as its containing block, so the
 *   kit draws no layer for it, and the page refuses the parent's too rather than reason about it.
 * - No box of the captured root outside the element's subtree, nor a box an element of the root
 *   generates, may paint over the element (CSS 2.1 §9.9.1 and Appendix E). The page compares no
 *   rectangles. A box that is positioned or may establish a stacking context paints as a layer. The
 *   page refuses every such layer after the element in tree order, at any `z-index`. It counts every
 *   generated box other than `::before` and `::after` as after the element, since Chromium paints
 *   those apart from their element's place in tree order. It refuses a layer before the element
 *   where its applied `z-index` is above the element's level, the lowest of the element's own and
 *   that of each ancestor below their common ancestor that may establish a stacking context, an
 *   `auto` counting as 0. A stacking context around the earlier box does not exempt it.
 *   Where the page cannot tell whether an element establishes one, as with a `will-change`, a
 *   transform on an inline box, `contain` on a table row or a running animation, it counts it as
 *   one. The kit orders the element last in its parent's frame, which paints as CSS does only where
 *   nothing paints over it.
 * - No element of the captured root preserves 3D. A 3D rendering context orders its boxes by depth,
 *   not by level or tree order (CSS Transforms 2 §2).
 * - `z-index` applies to a positioned box and to an item of a flex, grid or `-webkit-box` container,
 *   the display Tailwind's `line-clamp` sets. The item's container is the nearest element above it
 *   that generates a box, past each `display: contents` (CSS 2.1 §9.9.1, CSS Flexbox 1 §4.3). A flex or grid container paints its items in order-modified document order
 *   (CSS Flexbox 1 §5.4.1), so the element wins a tie only where each element between the two boxes
 *   and their common ancestor computes `order: 0`. A box inside a `display: none` element paints
 *   nothing.
 * - The element's level, and that of each ancestor that may establish a stacking context, is 0 or
 *   more. CSS paints a negative layer under the in-flow boxes of its context (CSS 2.1 Appendix E,
 *   steps 3 and 4).
 * - No element of the document outside the element is in the top layer, an open popover, a modal
 *   dialog or a fullscreen element, which paints over every other box (CSS Positioned Layout 4).
 *   None computes `overlay: auto` either, which keeps a closing popover or dialog in the top layer
 *   while it transitions out.
 * - The element sits in no `legend` or `summary`. Chromium paints a fieldset's legend and a
 *   `details` element's summary apart from tree order.
 * - No element from the captured root down to the element both clips its overflow and sets a
 *   `resize`. Its resize grip paints over its content (CSS Basic User Interface 4).
 * - From the parent up to, but not including, that ancestor, each element declares a `width` and a
 *   `height` of `100%`, a `min-width` and a `min-height` of `0px`, no `max-width` or `max-height`,
 *   an `auto` flex basis, so a flex item's basis is that width or height, and an `auto` aspect
 *   ratio, which beside a `height` that computes to `auto` sets the height from the width (CSS Box
 *   Sizing 4 §5). None is a grid item, whose percentages resolve against its grid area, which a
 *   track can cap (CSS Grid Layout 1). Each one then has its container's size at any size of the
 *   block above the bound below (CSS 2.1 §10.2, §10.5), and no minimum or maximum binds it (§10.4,
 *   §10.7), which a sample at one size cannot show. A flex item's automatic minimum, `auto`, binds
 *   as its container shrinks.
 * - That ancestor's height is definite: a length, a percentage of a definite height, or the height
 *   of an absolute or fixed box that sets it or both its `top` and `bottom`. A `100%` height
 *   against a height its content sets computes to `auto` (§10.5), so the chain would not follow the
 *   block.
 * - With the ancestor 10px wider through `min-width`, the same holds, and again with it 10px taller
 *   through `min-height` alone. The page grows one axis at a time, since an element between can
 *   follow the block's width and size its height from it, as an aspect ratio does, and growing both
 *   at once would hide that.
 *
 * The page does not refuse a block smaller than the padding and border of the elements from the
 * parent up to that ancestor, a known limit. A `100%` `border-box` column is never smaller than its
 * padding plus its border along each axis, a bound that grows with the block where the padding is
 * a percentage, so in a block narrower or shorter than that the
 * column overflows the block and the element sits off its offsets from the column's edge, as a
 * column padded 32px is 64px wide in a 50px block and puts a `right-4` element 30px from its edge.
 * No designer draws a panel that small. Sheet content's column, `sheet-content-inner`, the one
 * element between, sets no padding or border, so its bound is zero.
 *
 * The page restores the ancestor's `style` attribute before it returns, also where a reading throws.
 *
 * The page reads only the boxes of the captured root's light tree. Paint from outside the captured
 * root or inside a shadow tree can still cover the element undetected.
 *
 * @param element - The element.
 * @param root - The captured root the element sits below.
 * @returns True where the parent spans the element's containing block.
 */
export function parentSpansBlock(element: Element, root: Element): boolean {
  // Chromium lays boxes out in 1/64 of a CSS pixel, so edges closer than that are one edge.
  const unit = 1 / 64;
  const grown = 10;
  const px = (value: string): number | undefined =>
    /^-?\d+(?:\.\d+)?(?:e-?\d+)?px$/.test(value) ? Number.parseFloat(value) : undefined;
  const style = getComputedStyle(element);
  const parent = element.parentElement;
  if (
    parent === null ||
    style.position !== "absolute" ||
    style.display === "none" ||
    ["transform", "translate", "rotate", "scale"].some((name) => style.getPropertyValue(name) !== "none") ||
    getComputedStyle(parent).position !== "static"
  ) {
    return false;
  }
  const between: Element[] = [];
  let block: Element | null = parent;
  while (block !== null && getComputedStyle(block).position === "static") {
    between.push(block);
    block = block.parentElement;
  }
  const positioned = block;
  if (
    !(positioned instanceof HTMLElement || positioned instanceof SVGElement) ||
    !root.contains(positioned)
  ) {
    return false;
  }
  const clear = between.every((each) => {
    const own = getComputedStyle(each);
    return (
      each.parentElement?.children.length === 1 &&
      own.overflowX === "visible" &&
      own.overflowY === "visible" &&
      own.clipPath === "none"
    );
  });
  // The element whose box lays out the boxes `from` holds: `from`, or the nearest element above it
  // that generates a box, past each `display: contents`, which generates none.
  const boxParent = (from: Element | null): Element | null => {
    let parent = from;
    while (parent !== null && getComputedStyle(parent).display === "contents") {
      parent = parent.parentElement;
    }
    return parent;
  };
  // A box's computed style, the `display` of the box it is a flex or grid item of, if any, and
  // whether an animation runs on it, which can make it a stacking context at any computed value.
  type Styled = {
    readonly own: CSSStyleDeclaration;
    readonly container: string;
    readonly animated: () => boolean;
  };
  // A generated box. It is `anchored` where it paints at its element's place in tree order, as
  // `::before` and `::after` do, and `first` where it paints before its element's content, as
  // `::before` does.
  type Generated = Styled & { readonly first: boolean; readonly anchored: boolean };
  const displayOf = (each: Element | null): string => (each === null ? "" : getComputedStyle(each).display);
  const styled = (each: Element): Styled => ({
    own: getComputedStyle(each),
    container: displayOf(boxParent(each.parentElement)),
    animated: () => each.getAnimations().length > 0,
  });
  // The pseudo-elements that generate a box an author can position: `::before` and `::after`
  // (CSS 2.1 §12.1), a scroller's buttons, marker group and markers (CSS Overflow 5), a `details`
  // element's content and a picker's icon. `::marker` takes no `position`.
  const generatedPseudos = [
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
  // A scroller's marker group exists by its element's `scroll-marker-group` and a `details` element's
  // content box by the element, whatever their `content`; every other pseudo-element by its `content`.
  // Chromium computes no style, an empty `content`, for a pseudo-element an element cannot have.
  const generates = (each: Element, pseudo: string, own: CSSStyleDeclaration): boolean =>
    own.display !== "none" &&
    (pseudo === "::scroll-marker-group"
      ? getComputedStyle(each).getPropertyValue("scroll-marker-group") !== "none"
      : pseudo === "::details-content"
        ? each.localName === "details"
        : !["none", "normal", ""].includes(own.content));
  const pseudos = (each: Element): readonly Generated[] => {
    const container = displayOf(boxParent(each));
    return generatedPseudos.flatMap((pseudo) => {
      const own = getComputedStyle(each, pseudo);
      return generates(each, pseudo, own)
        ? [
            {
              own,
              container,
              first: pseudo === "::before",
              // A scroll marker paints in its scroller's marker group, and a scroller's buttons and
              // marker group and a `details` element's content box paint apart from tree order.
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
  };
  const unpainted = [...between, positioned].every((each) => pseudos(each).length === 0);
  // `z-index` applies to a positioned box and to a flex or grid item (CSS 2.1 §9.9.1, CSS Flexbox 1
  // §4.3).
  const indexed = ({ own, container }: Styled): boolean =>
    own.zIndex !== "auto" &&
    (own.position !== "static" || /flex|grid|-webkit-(?:inline-)?box/.test(container));
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
  // A box that paints as a layer of a stacking context and so may paint over the part: positioned, or
  // a stacking context.
  const paintsAsLayer = (each: Styled): boolean =>
    each.own.display !== "contents" && (each.own.position !== "static" || mayEstablishStackingContext(each));
  // The level a layer paints at: its `z-index`, or 0 for `auto`.
  const level = (each: Styled): number => (indexed(each) ? Number.parseInt(each.own.zIndex, 10) : 0);
  const partLevel = level(styled(element));
  // The level the part paints at among the boxes inside `around`: the lowest of its own and that of
  // each element between that may hold it in a stacking context of its own.
  const levelBelow = (around: Element): number => {
    let lowest = partLevel;
    for (let each = element.parentElement; each !== null && each !== around; each = each.parentElement) {
      const computed = styled(each);
      if (mayEstablishStackingContext(computed)) {
        lowest = Math.min(lowest, level(computed));
      }
    }
    return lowest;
  };
  // Whether every element from `from` up to `around`, `around` left out, computes `order: 0`. A flex
  // or grid container paints its items in order-modified document order (CSS Flexbox 1 §5.4.1, CSS
  // Grid 1 §9.5), so an `order` there can move a box after the part. `order` computes as declared on
  // a box that is no flex or grid item too, so the check can refuse a tie that CSS paints in tree
  // order, never the reverse.
  const inOrder = (from: Element, around: Element): boolean => {
    for (let each: Element | null = from; each !== null && each !== around; each = each.parentElement) {
      if (getComputedStyle(each).order !== "0") {
        return false;
      }
    }
    return true;
  };
  const rendered = (each: Element): boolean => {
    for (let around: Element | null = each; around !== null; around = around.parentElement) {
      if (getComputedStyle(around).display === "none") {
        return false;
      }
    }
    return true;
  };
  // Whether a box of the root outside the part, or its `::before` or `::after`, may paint over the
  // part. A layer after the part in tree order may, whatever its level. A layer before it may where
  // its own `z-index` applies above the level the part paints at inside the common ancestor `around`
  // of the two, or where it ties that level and an `order` can paint it later.
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
        (level(box) === lowest && !(inOrder(element, around) && ordered())));
    const earlier = (element.compareDocumentPosition(each) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
    return (
      (!holds && covers(styled(each), earlier, () => inOrder(each, around))) ||
      pseudos(each).some((pseudo) =>
        covers(
          pseudo,
          pseudo.anchored && (holds ? pseudo.first : earlier),
          () => pseudo.own.order === "0" && inOrder(each, around)
        )
      )
    );
  };
  const definite = (each: Element): boolean => {
    const declared = each.computedStyleMap();
    const height = declared.get("height");
    const own = getComputedStyle(each);
    if (own.position === "absolute" || own.position === "fixed") {
      return (
        height?.toString() !== "auto" ||
        ["top", "bottom"].every((side) => declared.get(side)?.toString() !== "auto")
      );
    }
    if (!(height instanceof CSSUnitValue)) {
      return false;
    }
    return (
      height.unit === "px" ||
      (height.unit === "percent" && (each.parentElement === null || definite(each.parentElement)))
    );
  };
  const follows = between.every((each) => {
    const declared = each.computedStyleMap();
    const own = getComputedStyle(each);
    return (
      ["width", "height"].every((axis) => declared.get(axis)?.toString() === "100%") &&
      own.minWidth === "0px" &&
      own.minHeight === "0px" &&
      own.maxWidth === "none" &&
      own.maxHeight === "none" &&
      own.flexBasis === "auto" &&
      own.aspectRatio === "auto" &&
      !(each.parentElement !== null && getComputedStyle(each.parentElement).display.includes("grid"))
    );
  });
  if (!clear || !unpainted || !follows || !definite(positioned)) {
    return false;
  }
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
  if (levelBelow(root) < 0 || lifted || deep || reordered || gripped || tree.some(paintsOver)) {
    return false;
  }
  const sides = ["top", "right", "bottom", "left"] as const;
  const spans = (): boolean => {
    const own = getComputedStyle(element);
    const offsets = sides.map((side) => px(own.getPropertyValue(side)));
    const margins = sides.map((side) => px(own.getPropertyValue(`margin-${side}`)));
    const [top, right, bottom, left] = offsets;
    const [marginTop, marginRight, marginBottom, marginLeft] = margins;
    if (
      top === undefined ||
      right === undefined ||
      bottom === undefined ||
      left === undefined ||
      marginTop === undefined ||
      marginRight === undefined ||
      marginBottom === undefined ||
      marginLeft === undefined
    ) {
      return false;
    }
    const box = element.getBoundingClientRect();
    const derived = [
      box.top - marginTop - top,
      box.right + marginRight + right,
      box.bottom + marginBottom + bottom,
      box.left - marginLeft - left,
    ];
    const outer = parent.getBoundingClientRect();
    const edges = positioned.getBoundingClientRect();
    const blockStyle = getComputedStyle(positioned);
    const border = sides.map((side) => px(blockStyle.getPropertyValue(`border-${side}-width`)) ?? 0);
    const padding = [
      edges.top + (border[0] ?? 0),
      edges.right - (border[1] ?? 0),
      edges.bottom - (border[2] ?? 0),
      edges.left + (border[3] ?? 0),
    ];
    const parentEdges = [outer.top, outer.right, outer.bottom, outer.left];
    return derived.every(
      (edge, index) =>
        Math.abs(edge - (parentEdges[index] ?? Number.NaN)) < unit &&
        Math.abs(edge - (padding[index] ?? Number.NaN)) < unit
    );
  };
  if (!spans()) {
    return false;
  }
  const target = positioned;
  const saved = target.getAttribute("style");
  const grows = (axis: "width" | "height"): boolean => {
    const before = target.getBoundingClientRect()[axis];
    try {
      target.style.setProperty(`min-${axis}`, `${String(before + grown)}px`, "important");
      return target.getBoundingClientRect()[axis] - before > grown - unit && spans();
    } finally {
      if (saved === null) {
        target.removeAttribute("style");
      } else {
        target.setAttribute("style", saved);
      }
    }
  };
  return grows("width") && grows("height");
}
