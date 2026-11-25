"use client";

/**
 * The part of a chart surface's window that its clipping ancestors leave visible, in client
 * coordinates, and whether a scrolled element moves the surface. The in-view gate in
 * `chart-surface-in-view.ts` caps each axis by the region. Package-private.
 */
import { clientScale } from "./chart-dom";

/** A span along one axis, in the surface document's client coordinates. */
type Span = { readonly start: number; readonly end: number };

/** The part of the surface's window that its clipping ancestors leave visible, and those ancestors. */
export type ClipRegion = { readonly x: Span; readonly y: Span; readonly clippers: readonly HTMLElement[] };

/** Which ancestors an element in the containing-block chain skips, by its `position`. */
type Escape = "none" | "absolute" | "fixed";

/**
 * The backdrop filter's property name, joined at run time. Tailwind-source builds scan Fuse's built
 * JavaScript, and the name written whole would make them emit a utility of that name, a feature above
 * the browser floor.
 */
const BACKDROP_FILTER = ["backdrop", "filter"].join("-");

/**
 * The properties whose value other than `none` makes an element a containing block for fixed
 * descendants. Safari 16.4 and 17 expose the backdrop filter only under its `-webkit-` prefix.
 */
const FIXED_CONTAINING_PROPERTIES: ReadonlySet<string> = new Set([
  "transform",
  "translate",
  "rotate",
  "scale",
  "perspective",
  "filter",
  BACKDROP_FILTER,
  `-webkit-${BACKDROP_FILTER}`,
]);

/**
 * Whether an element is a containing block for `position: fixed` descendants, and so also for
 * `position: absolute` ones. It reads each property by name, since a browser without a property
 * has no camel-case accessor for it and `getPropertyValue` returns an empty string. A `will-change`
 * entry counts only when it names one of those properties in full.
 *
 * @param style - The element's computed style.
 * @returns Whether it contains fixed descendants.
 */
function containsFixed(style: CSSStyleDeclaration): boolean {
  const read = (property: string) => style.getPropertyValue(property).trim();
  for (const property of FIXED_CONTAINING_PROPERTIES) {
    const value = read(property);
    if (value !== "" && value !== "none") return true;
  }
  return (
    /\b(?:layout|paint|strict|content)\b/u.test(read("contain")) ||
    read("will-change")
      .split(",")
      .some((entry) => FIXED_CONTAINING_PROPERTIES.has(entry.trim()))
  );
}

/**
 * The element's parent in the flat tree: its slot when slotted, else its parent element, else the
 * host of the shadow root it sits in. A slotted child of a closed shadow root reports no slot, so
 * the walk passes over that root's clipping elements.
 *
 * @param element - The element.
 * @returns The flat-tree parent, or null at the top.
 */
function flatParent(element: Element): Element | null {
  if (element.assignedSlot !== null) return element.assignedSlot;
  if (element.parentElement !== null) return element.parentElement;
  const parent = element.parentNode;
  const view = element.ownerDocument.defaultView;
  return view !== null && parent instanceof view.ShadowRoot ? parent.host : null;
}

/**
 * Whether an element contains another in the flat tree, so that scrolling it moves the other.
 *
 * @param container - The element that may contain `element`.
 * @param element - The contained element.
 * @returns Whether `container` is `element` or one of its flat-tree ancestors.
 */
export function flatContains(container: Element, element: Element): boolean {
  for (let node: Element | null = element; node !== null; node = flatParent(node))
    if (node === container) return true;
  return false;
}

/**
 * The part of the surface's window that its clipping ancestors leave visible, on each axis. The walk
 * follows the surface's containing-block chain through the flat tree, so a `position: absolute`
 * element passes over static ancestors and a `position: fixed` one over every ancestor up to one
 * that contains fixed descendants. An ancestor in the chain clips an axis when its `overflow` on
 * that axis is not `visible`, and leaves its padding box visible, scaled to client pixels as a
 * transform draws it. The root element and a body whose overflow goes to the viewport do not clip.
 * Neither does an ancestor whose client box is empty on both axes: an inline element, which
 * `overflow` does not apply to, or one under `display: contents`.
 *
 * @param surface - The observed surface.
 * @returns The visible span on each axis and the ancestors that clip. A span is the window's extent
 * where no ancestor clips, and unbounded in a document without a window.
 */
export function clipRegion(surface: Element): ClipRegion {
  const owner = surface.ownerDocument;
  const view = owner.defaultView;
  const root = owner.documentElement;
  if (view === null)
    return { x: { start: -Infinity, end: Infinity }, y: { start: -Infinity, end: Infinity }, clippers: [] };
  const rootStyle = view.getComputedStyle(root);
  const bodyToViewport = rootStyle.overflowX === "visible" && rootStyle.overflowY === "visible";
  const escapeOf = (style: CSSStyleDeclaration): Escape =>
    style.position === "fixed" ? "fixed" : style.position === "absolute" ? "absolute" : "none";
  let escape = escapeOf(view.getComputedStyle(surface));
  let x: Span = { start: 0, end: view.innerWidth };
  let y: Span = { start: 0, end: view.innerHeight };
  const clippers: HTMLElement[] = [];
  for (
    let ancestor = flatParent(surface);
    ancestor !== null && ancestor !== root;
    ancestor = flatParent(ancestor)
  ) {
    const style = view.getComputedStyle(ancestor);
    if (escape === "fixed" && !containsFixed(style)) continue;
    if (escape === "absolute" && style.position === "static" && !containsFixed(style)) continue;
    escape = escapeOf(style);
    if (ancestor === owner.body && bodyToViewport) continue;
    const clipsX = style.overflowX !== "visible";
    const clipsY = style.overflowY !== "visible";
    if ((!clipsX && !clipsY) || !(ancestor instanceof view.HTMLElement)) continue;
    if (ancestor.clientWidth === 0 && ancestor.clientHeight === 0) continue;
    const box = ancestor.getBoundingClientRect();
    const scale = clientScale(ancestor);
    const left = box.left + ancestor.clientLeft * scale.x;
    const top = box.top + ancestor.clientTop * scale.y;
    if (clipsX)
      x = { start: Math.max(x.start, left), end: Math.min(x.end, left + ancestor.clientWidth * scale.x) };
    if (clipsY)
      y = { start: Math.max(y.start, top), end: Math.min(y.end, top + ancestor.clientHeight * scale.y) };
    clippers.push(ancestor);
  }
  return { x, y, clippers };
}
