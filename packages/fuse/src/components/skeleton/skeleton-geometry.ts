/**
 * Package-private. The one geometry reader the skeleton's measuring and its motion share: an
 * element's border box in local layout pixels, fractional; the transform scale it is drawn at;
 * and the conversion of a border-box height into the element's own box model, for writing it.
 *
 * Local sizes come from the element's used width and height in its computed style. A transform
 * does not change them, a running height animation shows in them, and they keep the fraction that
 * `offsetWidth` and `offsetHeight` round away: a 200.5px box read through its offset size reads
 * 201px, so a scale or a height read that way is off by up to half a pixel, and more under a
 * scaled ancestor.
 */
import { windowOf } from "../../internal/dom-node";

/** A border box in local layout pixels. */
export type LocalSize = { readonly width: number; readonly height: number };

/** An element's transform scale: its client rect over its local border box. */
export type Scale = { readonly x: number; readonly y: number };

/** A computed length in pixels, zero when it does not parse. */
function length(value: string): number {
  return Number.parseFloat(value) || 0;
}

/** The vertical padding and border a `content-box` element adds to its `height`. */
function verticalFrame(style: CSSStyleDeclaration): number {
  return (
    length(style.paddingTop) +
    length(style.paddingBottom) +
    length(style.borderTopWidth) +
    length(style.borderBottomWidth)
  );
}

/**
 * An element's border box in local layout pixels, fractional: its used width and height, with its
 * padding and border added for a `content-box` element. An element with no used size, such as an
 * inline one, falls back to its rounded offset size.
 *
 * @param element - The element to read.
 * @returns Its border-box width and height.
 */
export function localSize(element: HTMLElement): LocalSize {
  const style = windowOf(element).getComputedStyle(element);
  const width = Number.parseFloat(style.width);
  const height = Number.parseFloat(style.height);
  if (Number.isNaN(width) || Number.isNaN(height))
    return { width: element.offsetWidth, height: element.offsetHeight };
  if (style.boxSizing === "border-box") return { width, height };
  return {
    width:
      width +
      length(style.paddingLeft) +
      length(style.paddingRight) +
      length(style.borderLeftWidth) +
      length(style.borderRightWidth),
    height: height + verticalFrame(style),
  };
}

/**
 * An element's border-box height in local pixels, fractional, as an animation of it stands now.
 *
 * @param element - The element to read.
 * @returns Its border-box height.
 */
export function localHeight(element: HTMLElement): number {
  return localSize(element).height;
}

/**
 * The transform scale an element is drawn at: its client rect over its local border box, 1 on an
 * axis where the box is empty.
 *
 * @param element - The element to read.
 * @returns Its horizontal and vertical scale.
 */
export function scaleOf(element: HTMLElement): Scale {
  const rect = element.getBoundingClientRect();
  const size = localSize(element);
  return {
    x: size.width === 0 ? 1 : rect.width / size.width,
    y: size.height === 0 ? 1 : rect.height / size.height,
  };
}

/**
 * A border-box height as the element's own `height` declares it: less its vertical padding and
 * border when it is `content-box`, and never below zero. Written that way, a height keeps the element's box model, so
 * its own `min-height` and `max-height` bound it as they bound its natural height.
 *
 * @param element - The element the height is for.
 * @param borderBoxHeight - The height of its border box, in local pixels.
 * @returns The value for its `height`, in pixels.
 */
export function ownHeight(element: HTMLElement, borderBoxHeight: number): number {
  const style = windowOf(element).getComputedStyle(element);
  return style.boxSizing === "border-box"
    ? borderBoxHeight
    : Math.max(0, borderBoxHeight - verticalFrame(style));
}
