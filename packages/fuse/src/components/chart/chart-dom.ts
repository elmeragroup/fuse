"use client";

import { useId } from "react";

/**
 * The one attribute writer every chart mark draws through. A write that changes nothing still
 * restyles an SVG element, so each write first compares, and a frame or a commit that redraws what
 * is on screen restyles nothing.
 */

/** An attribute value: a string or number to set, or null to remove the attribute. */
export type AttributeValue = string | number | null;

/** What `writeAttribute` reads and writes on a node: an element, or a test's stand-in. */
export type AttributeNode = Pick<
  Element,
  "getAttribute" | "hasAttribute" | "setAttribute" | "removeAttribute"
>;

/** What `writeStyle` reads and writes on a node: an element's inline style, or a test's stand-in. */
export type StyleNode = {
  readonly style: Pick<CSSStyleDeclaration, "getPropertyValue" | "setProperty" | "removeProperty">;
};

/**
 * A prefix for the ids a part gives its clip paths, masks and paint servers. SVG references read
 * the id inside `url()`, so the prefix keeps only characters an IRI fragment takes as they are.
 *
 * @param name - The part's own name, such as "chart-bar".
 * @returns A prefix unique to the part's instance.
 */
export function useSvgIdPrefix(name: string): string {
  return `${name}-${useId().replace(/[^\w-]/gu, "")}`;
}

/**
 * Set an attribute that changed, or remove it for null.
 *
 * @param node - The element.
 * @param name - The attribute.
 * @param value - The new value, or null to remove it.
 */
export function writeAttribute(node: AttributeNode, name: string, value: AttributeValue): void {
  if (value === null) {
    if (node.hasAttribute(name)) node.removeAttribute(name);
    return;
  }
  const text = String(value);
  if (node.getAttribute(name) !== text) node.setAttribute(name, text);
}

/**
 * Set an inline style property that changed, or remove it for null.
 *
 * @param node - The element.
 * @param name - The property, a custom property included.
 * @param value - The new value, or null to remove it.
 */
export function writeStyle(node: StyleNode, name: string, value: string | null): void {
  if (value === null) {
    if (node.style.getPropertyValue(name) !== "") node.style.removeProperty(name);
    return;
  }
  if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
}

/**
 * Write a record of attributes through `writeAttribute`.
 *
 * @param node - The element, or null to write nothing.
 * @param attributes - The values by attribute name.
 */
export function writeAttributes(
  node: Element | null,
  attributes: { readonly [name: string]: AttributeValue }
): void {
  if (node === null) return;
  for (const name in attributes) writeAttribute(node, name, attributes[name] ?? null);
}

/** Each mark node's latest commit, which every commit of its mark replaces. */
const commits = new WeakMap<Element, object>();

/** The commit of a node no mark has committed, such as a test's bare element. */
const UNCOMMITTED = {};

/**
 * Mark a commit of the mark that draws into `node`, so its writers find their parts again. React
 * changes a mark's children only in a commit of the mark, as a variant that mounts a ring does.
 * `useMotionMark` calls it before the mark places, in every commit that may change those children.
 *
 * @param node - The mark's node, or null before it mounts.
 */
export function refreshParts(node: Element | null): void {
  if (node !== null) commits.set(node, {});
}

/**
 * Find a writer's parts under a node once per commit of its mark. Every frame of a tween and every
 * pointer step between two commits reads the parts found in the latest commit, with no query.
 *
 * @param find - Finds the parts under a node.
 * @returns A function of the node that returns its parts.
 */
export function partsCache<P>(find: (node: Element) => P): (node: Element) => P {
  const found = new WeakMap<Element, { readonly commit: object; readonly parts: P }>();
  return (node) => {
    const commit = commits.get(node) ?? UNCOMMITTED;
    const cached = found.get(node);
    if (cached?.commit === commit) return cached.parts;
    const parts = find(node);
    found.set(node, { commit, parts });
    return parts;
  };
}

/** Client pixels per layout pixel of an element, along x and y. */
export type ClientScale = { readonly x: number; readonly y: number };

/**
 * How many client pixels one layout pixel of an element spans, along x and y, so client boxes read
 * under a transformed ancestor, such as a scaled portal, come back to the element's own pixels.
 *
 * @param element - The element.
 * @returns The scale along each axis, 1 along an axis the element has no size on.
 */
export function clientScale(element: HTMLElement): ClientScale {
  const box = element.getBoundingClientRect();
  return {
    x: element.offsetWidth === 0 ? 1 : box.width / element.offsetWidth,
    y: element.offsetHeight === 0 ? 1 : box.height / element.offsetHeight,
  };
}

/** One keyed child of a tick list: a grid line or an axis label. */
export type TickNode = HTMLElement | SVGElement;

/** The children a frame keeps under one parent, one per key. */
export type TickList = {
  /**
   * Keep one child per key: make the missing ones, let the ones no key names leave, and return
   * every child still mounted by its key, the leaving ones included, so a frame places each of
   * them until it is gone. A key that comes back while its child leaves takes the child back.
   */
  readonly sync: (keys: readonly number[]) => ReadonlyMap<number, TickNode>;
  /** Drop every child at once, so the next `sync` makes each one again, as a new label format needs. */
  readonly clear: () => void;
};

/**
 * Let a child leave: mark it `data-leaving`, which its stylesheet may fade it out on, and call
 * `gone` once every animation it then runs has ended, finished or cancelled, as reduced motion
 * cancels it, or at once when it runs none.
 */
function leave(child: TickNode, gone: () => void): void {
  child.setAttribute("data-leaving", "");
  const fades = child.getAnimations();
  if (fades.length === 0) {
    gone();
    return;
  }
  void Promise.allSettled(fades.map((fade) => fade.finished)).then(gone);
}

/**
 * Create the keyed children of one parent, which a frame writes only where its keys change.
 *
 * @param parent - The element that holds the children.
 * @param make - Makes the child of a key.
 * @returns The list.
 */
export function createTickList(parent: Element, make: (key: number) => TickNode): TickList {
  const mounted = new Map<number, TickNode>();
  // Each leaving child's exit, which taking the child back ends, so a later exit's end is its own.
  const exits = new Map<number, object>();
  return {
    sync(keys) {
      const wanted = new Set(keys);
      for (const [key, child] of mounted) {
        if (wanted.has(key) || exits.has(key)) continue;
        const exit = {};
        exits.set(key, exit);
        leave(child, () => {
          if (exits.get(key) !== exit) return;
          exits.delete(key);
          mounted.delete(key);
          child.remove();
        });
      }
      for (const key of keys) {
        if (exits.delete(key)) mounted.get(key)?.removeAttribute("data-leaving");
        if (mounted.has(key)) continue;
        const child = make(key);
        parent.append(child);
        mounted.set(key, child);
      }
      return mounted;
    },
    clear() {
      for (const child of mounted.values()) child.remove();
      mounted.clear();
      exits.clear();
    },
  };
}
