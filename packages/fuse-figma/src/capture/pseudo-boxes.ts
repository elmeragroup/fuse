/**
 * Whether an element's `::before` or `::after` draws a box the kit can draw as a layer of its own.
 * The capture's page function calls `pseudoBox` and `pseudoPaintOf` on each element of a root's tree:
 * `pseudoBox` must hold in every mode the page stamps, and `pseudoPaintOf` reads the paint the box
 * computes to, which `paints` then judges here, outside the page, where `@elmeragroup/color` parses
 * its colors. The two page functions are passed to the page as their source, so neither reads
 * anything outside its own body.
 *
 * A pseudo-element has no node the page can measure with `getBoundingClientRect`, so the page reads
 * its computed style, which Chromium resolves to used values for a pseudo-element it laid out: a box's
 * `width` and `height` in pixels (CSSOM §9), and a positioned box's `top`, `right`, `bottom` and
 * `left` in pixels too. A pseudo-element that generates no box, as one whose `content` computes to
 * `none`, keeps `auto` there.
 */
import * as CssColor from "@elmeragroup/color/css-color";

/** The paint a pseudo-element's box computes to, as the page reads it. */
export type PseudoPaint = {
  readonly backgroundColor: string;
  readonly backgroundImage: string;
  readonly boxShadow: string;
  /** Each border side's style and width, top, right, bottom and left. */
  readonly borders: readonly (readonly [style: string, width: string])[];
  readonly outline: readonly [style: string, width: string];
};

/**
 * The paint a pseudo-element's box computes to. Runs in the page.
 *
 * @param element - The originating element.
 * @param pseudo - `::before` or `::after`.
 * @returns Its fill, background image, shadow, border sides and outline, as computed.
 */
export function pseudoPaintOf(element: Element, pseudo: string): PseudoPaint {
  const style = getComputedStyle(element, pseudo);
  return {
    backgroundColor: style.backgroundColor,
    backgroundImage: style.backgroundImage,
    boxShadow: style.boxShadow,
    borders: ["top", "right", "bottom", "left"].map(
      (side) =>
        [
          style.getPropertyValue(`border-${side}-style`),
          style.getPropertyValue(`border-${side}-width`),
        ] as const
    ),
    outline: [style.outlineStyle, style.outlineWidth],
  };
}

/**
 * Whether the pseudo-element is an absolute box laid out against its originating element: its
 * `content` generates a box, it displays, its own `position` is `absolute` and its element's is not
 * `static`, so the element is its containing block (CSS 2.1 §10.1), and Chromium resolved its size
 * and offsets to used pixels, which it does only for a box it laid out. Runs in the page.
 *
 * @param element - The originating element.
 * @param pseudo - `::before` or `::after`.
 * @returns True where the pseudo-element is such a box.
 */
export function pseudoBox(element: Element, pseudo: string): boolean {
  const style = getComputedStyle(element, pseudo);
  const used = (value: string): boolean => /^-?\d+(?:\.\d+)?(?:e-?\d+)?px$/.test(value);
  return (
    !["none", "normal"].includes(style.content) &&
    style.display !== "none" &&
    style.position === "absolute" &&
    getComputedStyle(element).position !== "static" &&
    ["width", "height", "top", "right", "bottom", "left"].every((property) =>
      used(style.getPropertyValue(property))
    )
  );
}

/** Whether a computed width draws: a length above zero. */
const drawsWidth = (width: string): boolean => Number.parseFloat(width) > 0;

/**
 * Whether a pseudo-element's box paints something of its own: a fill whose alpha is above zero, a
 * background image, a shadow, a border side that draws, or an outline. A fill whose color the parser
 * cannot read counts as painting, since nothing shows it clear.
 *
 * @param paint - The paint the box computes to.
 * @returns True where the box paints.
 */
export function paints(paint: PseudoPaint): boolean {
  const fill = CssColor.parse(paint.backgroundColor);
  return (
    fill._tag === "err" ||
    CssColor.toSrgb(fill.value).alpha > 0 ||
    paint.backgroundImage !== "none" ||
    paint.boxShadow !== "none" ||
    paint.borders.some(([style, width]) => style !== "none" && style !== "hidden" && drawsWidth(width)) ||
    (paint.outline[0] !== "none" && drawsWidth(paint.outline[1]))
  );
}
