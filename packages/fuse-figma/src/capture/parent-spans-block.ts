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
 *   or `::after` box. Above the parent, Figma draws such a box as a layer of its element's frame,
 *   beside the frame that holds the element, and no order of the two paints as CSS does in every
 *   case. CSS paints a positioned `::before` under the element and over the in-flow content around
 *   it, and the element over an in-flow `::after` (CSS 2.1 Appendix E, steps 4 to 8). The parent's
 *   own absolute `::before` or `::after` has the block above it as its containing block, so the
 *   kit draws no layer for it, and the page refuses the parent's too rather than reason about it.
 * - No element after the element in tree order inside that ancestor, outside the element's own
 *   subtree, is positioned or forms a stacking context: a `z-index` on a flex or grid item, an
 *   opacity below 1, a transform, translate, rotate, scale, filter, backdrop filter, perspective,
 *   clip path or mask, `isolation: isolate`, a blend mode, a `will-change`, or layout or paint
 *   containment. CSS paints such a box after the element, so over it (CSS 2.1 Appendix E, step 8;
 *   CSS Positioned Layout 3), while the kit orders the element last in its parent's frame.
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
  const generates = (each: Element): boolean =>
    ["::before", "::after"].some((pseudo) => {
      const own = getComputedStyle(each, pseudo);
      return !["none", "normal"].includes(own.content) && own.display !== "none";
    });
  const unpainted = [...between, positioned].every((each) => !generates(each));
  const stacks = (each: Element): boolean => {
    const own = getComputedStyle(each);
    const container = each.parentElement === null ? "" : getComputedStyle(each.parentElement).display;
    return (
      own.position !== "static" ||
      (own.zIndex !== "auto" && /flex|grid/.test(container)) ||
      Number.parseFloat(own.opacity) < 1 ||
      [
        "transform",
        "translate",
        "rotate",
        "scale",
        "filter",
        "backdrop-filter",
        "perspective",
        "clip-path",
        "mask-image",
      ].some((name) => own.getPropertyValue(name) !== "none") ||
      own.isolation === "isolate" ||
      own.mixBlendMode !== "normal" ||
      own.willChange !== "auto" ||
      /layout|paint|strict|content/.test(own.contain)
    );
  };
  const later = [...positioned.querySelectorAll("*")].filter(
    (each) =>
      (element.compareDocumentPosition(each) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
      !element.contains(each)
  );
  const under = later.every((each) => !stacks(each));
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
  if (!clear || !unpainted || !under || !follows || !definite(positioned)) {
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
