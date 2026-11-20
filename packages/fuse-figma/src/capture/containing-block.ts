/**
 * What the capture's page reads of an absolute element whose containing block lies above its
 * parent, shared by `parent-spans-block.ts` and `block-frame.ts`. CSS places an absolute box against
 * its containing block, the padding box of its nearest positioned ancestor (CSS 2.1 §10.1), and
 * Figma places a layer against its parent frame only, so both facts find that ancestor, derive the
 * block's padding box from the element's own geometry, and grow the ancestor to show the element
 * keeps its offsets at other sizes. `blockFrame` also asks which boxes CSS paints as a stacking
 * context or as one group.
 *
 * The page function in `page-facts.ts` hands these functions to `parentSpansBlock` and `blockFrame`
 * as {@link BlockHelpers}, with the paint checks of `paints-over.ts`. Each is passed to the page as
 * its source, so it reads nothing outside its own body and its arguments.
 */

import type { boxesOver, generatedBoxes } from "./paints-over.ts";

/** An absolute element's static parent, the static elements from it up, and the positioned one above. */
export type ContainingBlock = {
  /** The element's parent, static, the first of `between`. */
  readonly parent: Element;
  /** The static elements from the parent up to, but not including, `block`. */
  readonly between: readonly Element[];
  /** The nearest positioned ancestor, the captured root or an element below it. */
  readonly block: HTMLElement | SVGElement;
};

/** A box's four edges from the viewport, top, right, bottom and left, in CSS pixels. */
export type Edges = readonly [number, number, number, number];

/** Whether a box forms a stacking context, and whether it also paints its subtree as one group. */
export type BoxStacking = "none" | "context" | "group";

/**
 * The functions the page hands `parentSpansBlock` and `blockFrame`, beside the paint-order reads of
 * `stacking.ts`: this module's and those of `paints-over.ts`.
 */
export type BlockHelpers = {
  /** {@link containingBlockAbove}. */
  readonly containingBlockAbove: typeof containingBlockAbove;
  /** {@link offsetEdges}. */
  readonly offsetEdges: typeof offsetEdges;
  /** {@link paddingEdges}. */
  readonly paddingEdges: typeof paddingEdges;
  /** {@link stackingOf}. */
  readonly stackingOf: typeof stackingOf;
  /** {@link grownAlike}. */
  readonly grownAlike: typeof grownAlike;
  /** `generatedBoxes` in `paints-over.ts`. */
  readonly generatedBoxes: typeof generatedBoxes;
  /** `boxesOver` in `paints-over.ts`. */
  readonly boxesOver: typeof boxesOver;
  /** Writes styles for a measure and puts each `style` attribute back, also where it throws. */
  readonly withStyles: (
    writes: readonly (readonly [Element, string, string])[],
    measure: () => boolean
  ) => boolean;
};

/**
 * The containing block of an absolute element that lies above its parent: the element is absolute,
 * displayed and not moved by a transform, a translate, a rotate or a scale, its parent is static,
 * and its nearest positioned ancestor is the captured root or an element below it, so the set
 * draws that ancestor. Runs in the page.
 *
 * @param element - The element.
 * @param root - The captured root.
 * @returns The block and the elements between, or undefined.
 */
export function containingBlockAbove(element: Element, root: Element): ContainingBlock | undefined {
  const style = getComputedStyle(element);
  const parent = element.parentElement;
  if (
    parent === null ||
    style.position !== "absolute" ||
    style.display === "none" ||
    ["transform", "translate", "rotate", "scale"].some((name) => style.getPropertyValue(name) !== "none") ||
    getComputedStyle(parent).position !== "static"
  ) {
    return undefined;
  }
  const between: Element[] = [];
  let block: Element | null = parent;
  while (block !== null && getComputedStyle(block).position === "static") {
    between.push(block);
    block = block.parentElement;
  }
  return (block instanceof HTMLElement || block instanceof SVGElement) && root.contains(block)
    ? { parent, between, block }
    : undefined;
}

/**
 * The padding box of an absolute element's containing block, as the element's own geometry gives
 * it: its border box, its margins and its used offsets, which Chromium resolves to pixels for a
 * positioned box it laid out (CSSOM §9). The offsets, margins, borders, paddings and length add up
 * to the block's length on each axis (CSS 2.1 §10.3.7, §10.6.4), so each edge of the block lies an
 * offset and a margin past the element's edge. Runs in the page.
 *
 * @param element - The absolute element.
 * @returns The block's padding edges, or undefined where an offset or a margin is no pixel length.
 */
export function offsetEdges(element: Element): Edges | undefined {
  const px = (value: string): number | undefined =>
    /^-?\d+(?:\.\d+)?(?:e-?\d+)?px$/.test(value) ? Number.parseFloat(value) : undefined;
  const own = getComputedStyle(element);
  const [top, right, bottom, left] = ["top", "right", "bottom", "left"].map((side) =>
    px(own.getPropertyValue(side))
  );
  const [marginTop, marginRight, marginBottom, marginLeft] = ["top", "right", "bottom", "left"].map((side) =>
    px(own.getPropertyValue(`margin-${side}`))
  );
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
    return undefined;
  }
  const box = element.getBoundingClientRect();
  return [
    box.top - marginTop - top,
    box.right + marginRight + right,
    box.bottom + marginBottom + bottom,
    box.left - marginLeft - left,
  ];
}

/**
 * An element's padding box: its border box inside its borders. Runs in the page.
 *
 * @param element - The element.
 * @returns Its padding edges.
 */
export function paddingEdges(element: Element): Edges {
  const own = getComputedStyle(element);
  const border = (side: string): number =>
    Number.parseFloat(own.getPropertyValue(`border-${side}-width`)) || 0;
  const box = element.getBoundingClientRect();
  return [
    box.top + border("top"),
    box.right - border("right"),
    box.bottom - border("bottom"),
    box.left + border("left"),
  ];
}

/**
 * How a box stacks (CSS 2.1 Appendix E, CSS Positioned Layout 3 §4). It paints its subtree as one
 * group, which a frame the box leaves would drop for it, where it sets an opacity below 1, a
 * transform, translate, rotate, scale, perspective or 3D `transform-style`, a filter or backdrop
 * filter, a clip path or mask, a blend mode, a `will-change`, layout or paint containment, a
 * `content-visibility` other than `visible`, a `view-transition-name` or an `offset-path`. It forms
 * a stacking context alone where it is positioned, where a `z-index` other than `auto` applies, or
 * where it sets `isolation: isolate`, which applies no visual effect to the group (CSS Compositing
 * and Blending 1 §4). Runs in the page.
 *
 * @param style - The box's computed style.
 * @param applies - Whether a `z-index` other than `auto` applies to it, as `appliedLevel` in
 *   `stacking.ts` decides.
 * @returns `group`, `context` or `none`.
 */
export function stackingOf(style: CSSStyleDeclaration, applies: boolean): BoxStacking {
  const group =
    Number.parseFloat(style.opacity) < 1 ||
    [
      "transform",
      "translate",
      "rotate",
      "scale",
      "perspective",
      "filter",
      "backdrop-filter",
      "clip-path",
      "mask-image",
      "view-transition-name",
      "offset-path",
    ].some((name) => style.getPropertyValue(name) !== "none") ||
    style.transformStyle !== "flat" ||
    style.mixBlendMode !== "normal" ||
    style.willChange !== "auto" ||
    /layout|paint|strict|content/.test(style.contain) ||
    style.contentVisibility !== "visible";
  if (group) {
    return "group";
  }
  return style.position !== "static" || applies || style.isolation === "isolate" ? "context" : "none";
}

/**
 * Whether a reading still holds with a block 10px wider through `min-width`, and again with it 10px
 * taller through `min-height` alone, the block growing each time by the full 10px. It grows one axis
 * at a time, since an element between can follow the block's width and size its height from it, as
 * an aspect ratio does, and growing both at once would hide that. Runs in the page.
 *
 * @param block - The block.
 * @param holds - The reading.
 * @param withStyles - {@link BlockHelpers.withStyles}.
 * @returns True where the reading holds at both sizes.
 */
export function grownAlike(
  block: Element,
  holds: () => boolean,
  withStyles: BlockHelpers["withStyles"]
): boolean {
  // Chromium lays boxes out in 1/64 of a CSS pixel, so a box grown by less than that did not grow.
  const unit = 1 / 64;
  const grown = 10;
  return (["width", "height"] as const).every((axis) => {
    const before = block.getBoundingClientRect()[axis];
    return withStyles(
      [[block, `min-${axis}`, `${String(before + grown)}px`]],
      () => block.getBoundingClientRect()[axis] - before > grown - unit && holds()
    );
  });
}
