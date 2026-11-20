/**
 * The CSS paint-order reads that `paints-last.ts` and `parent-spans-block.ts` both make about a box:
 * the `display` of the element that lays it out, the `z-index` level that applies to it, and
 * whether an `order` between it and an ancestor can change where it paints. Each fact keeps its own rules for which
 * boxes it refuses. These reads decide the CSS facts those rules compare, so the two facts agree on
 * every box.
 *
 * The capture's page function hands the functions to both facts as {@link Stacking}. Each is passed
 * to the page as its source, so it reads nothing outside its own body and its arguments.
 */

/**
 * The computed `display` of the element whose box lays out the boxes `from` holds: `from`, or the
 * nearest element above it that generates a box, past each `display: contents`, which generates none
 * (CSS Display 3 §2.5). For an element's own box, `from` is its parent. For its `::before` or
 * `::after`, `from` is the element. Runs in the page.
 *
 * @param from - The element that holds the box in the tree.
 * @returns That element's `display`, or an empty string where none above `from` generates a box.
 */
export function containerDisplay(from: Element | null): string {
  for (let container = from; container !== null; container = container.parentElement) {
    const { display } = getComputedStyle(container);
    if (display !== "contents") {
      return display;
    }
  }
  return "";
}

/**
 * The `z-index` level that applies to a box, if any. A `z-index` other than `auto` applies to a
 * positioned box (CSS 2.1 §9.9.1), and to an item of a flex or grid container (CSS Flexbox 1 §4.3,
 * CSS Grid 1 §9.5). Chromium applies it to an item of a `-webkit-box` or `-webkit-inline-box`
 * container too, the display Tailwind's `line-clamp` sets. An element whose `display` is `contents`
 * or `none` generates no box, so no level applies to it. The boxes of a `display: contents`
 * element's children take their container from {@link containerDisplay}. Runs in the page.
 *
 * @param style - The computed style of the element or pseudo-element.
 * @param container - What {@link containerDisplay} returns for the box.
 * @returns The level, or undefined where the `z-index` is `auto`, does not apply, or there is no box.
 */
export function appliedLevel(style: CSSStyleDeclaration, container: string): number | undefined {
  return /^-?\d+$/.test(style.zIndex) &&
    style.display !== "contents" &&
    style.display !== "none" &&
    (style.position !== "static" || /flex|grid|-webkit-(?:inline-)?box/.test(container))
    ? Number(style.zIndex)
    : undefined;
}

/**
 * Whether every element from `from` up to `around`, `around` left out, computes `order: 0`. A flex
 * or grid container paints its items in order-modified document order (CSS Flexbox 1 §5.4.1, CSS
 * Grid 1 §9.5), so an `order` there can paint a box after another at the same level that follows
 * it in the tree. A computed `order` is its declared value on a box that is no flex or grid item
 * too, so a caller that settles a tie only where this holds can refuse a tie that CSS paints in tree
 * order, never the reverse. Runs in the page.
 *
 * @param from - The element the walk starts at.
 * @param around - The ancestor the walk stops below.
 * @returns True where each element on the way computes `order: 0`.
 */
export function keepsTreeOrder(from: Element, around: Element): boolean {
  for (let each: Element | null = from; each !== null && each !== around; each = each.parentElement) {
    if (getComputedStyle(each).order !== "0") {
      return false;
    }
  }
  return true;
}

/** The reads of this module, as the capture's page function hands them to each fact. */
export type Stacking = {
  /** {@link containerDisplay}. */
  readonly containerDisplay: typeof containerDisplay;
  /** {@link appliedLevel}. */
  readonly appliedLevel: typeof appliedLevel;
  /** {@link keepsTreeOrder}. */
  readonly keepsTreeOrder: typeof keepsTreeOrder;
};
