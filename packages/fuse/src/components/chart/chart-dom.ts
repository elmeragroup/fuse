"use client";

import { useId } from "react";

/**
 * The one attribute writer every chart mark draws through. A write that changes nothing still
 * restyles an SVG element, so each write first compares, and a frame or a commit that redraws what
 * is on screen restyles nothing.
 */

/** An attribute value: a string or number to set, or null to remove the attribute. */
export type AttributeValue = string | number | null;

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
export function writeAttribute(node: Element, name: string, value: AttributeValue): void {
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
export function writeStyle(node: HTMLElement | SVGElement, name: string, value: string | null): void {
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

/**
 * Find a writer's parts under a node once per node and look. React changes a mark's children only
 * in a commit that hands its writer a new look, so every frame of a tween reads the parts found
 * when the look arrived, with no query.
 *
 * @param find - Finds the parts under a node.
 * @returns A function of the node and the writer's look that returns its parts.
 */
export function partsCache<P, L extends WeakKey = WeakKey>(
  find: (node: Element) => P
): (node: Element, look: L) => P {
  const found = new WeakMap<Element, { readonly look: L; readonly parts: P }>();
  return (node, look) => {
    const cached = found.get(node);
    if (cached?.look === look) return cached.parts;
    const parts = find(node);
    found.set(node, { look, parts });
    return parts;
  };
}
