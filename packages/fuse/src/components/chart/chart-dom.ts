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

/** Each mark node's latest commit, which every commit of its mark replaces. */
const commits = new WeakMap<Element, object>();

/** The commit of a node no mark has committed, such as a test's bare element. */
const UNCOMMITTED = {};

/**
 * Mark a commit of the mark that draws into `node`, so its writers find their parts again. React
 * changes a mark's children only in a commit of the mark, as a variant that mounts a ring does.
 * `useMotionMark` calls it in every commit, before the mark places.
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
