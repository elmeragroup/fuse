import { expect } from "vitest";

import { cssVarColor } from "./themed-browser-render";

/** A ring layer of a computed `box-shadow`: its spread and its computed colour string. */
type RingLayer = { readonly spread: string; readonly color: string };

/**
 * The invalid ring's colour, written by hand: the `--error` role at 20% alpha, mixed the way
 * Tailwind's `/20` opacity modifier mixes it.
 */
const INVALID_RING_COLOR = "color-mix(in oklab, var(--error) 20%, transparent)";

/** Split a computed `box-shadow` into layers at the commas outside colour functions. */
function shadowLayers(boxShadow: string): string[] {
  if (boxShadow === "none") {
    return [];
  }
  const layers: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of boxShadow) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      layers.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  layers.push(current.trim());
  return layers;
}

/**
 * Resolve a CSS colour expression to the string Chromium computes for it, the way
 * `cssVarColor` resolves a token: a probe under the same theme scope takes it as its colour.
 * Chromium serializes a box-shadow layer's colour the same way, so the two compare exactly.
 */
function computedColor(host: HTMLElement, color: string): string {
  const probe = document.createElement("span");
  probe.style.color = color;
  host.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  return computed;
}

/**
 * The rings an element paints: every `box-shadow` layer with no offset and no blur but a
 * spread, as the `ring-*` utilities emit. Chromium writes each layer's colour first and its
 * four lengths after it; the transparent placeholder layers Tailwind stacks have no spread.
 */
function ringLayers(element: HTMLElement): RingLayer[] {
  return shadowLayers(getComputedStyle(element).boxShadow).flatMap((layer) => {
    const lengths = layer.match(/-?[\d.]+px/gu) ?? [];
    const [x, y, blur, spread] = lengths;
    if (lengths.length !== 4 || x !== "0px" || y !== "0px" || blur !== "0px") {
      return [];
    }
    if (spread === undefined || spread === "0px") {
      return [];
    }
    return [{ spread, color: layer.replace(/(?:\s+-?[\d.]+px)+$/u, "") }];
  });
}

/**
 * Assert the invalid face's ring and border: an `--error` border and exactly one 3px ring
 * of the `--error` role at 20% alpha. Every expected value is written here by hand; the
 * role colour is read from the theme, never from the recipe.
 *
 * @param label - The control's name in failure messages.
 * @param element - The control that paints the invalid face.
 */
export function expectInvalidRing(label: string, element: HTMLElement): void {
  // The probes are child elements, which an <input> cannot hold, so they resolve colours
  // where the control's parent sits in the same theme scope.
  const host = element.parentElement ?? element;
  expect.soft(getComputedStyle(element).borderTopColor, `${label} border`).toBe(cssVarColor(host, "--error"));
  expect
    .soft(ringLayers(element), `${label} ring`)
    .toEqual([{ spread: "3px", color: computedColor(host, INVALID_RING_COLOR) }]);
}

/**
 * Assert that an element paints no ring at all, as an embedded control whose group owns
 * the invalid ring must.
 *
 * @param label - The control's name in failure messages.
 * @param element - The embedded control.
 */
export function expectNoRing(label: string, element: HTMLElement): void {
  expect(ringLayers(element), `${label} ring`).toEqual([]);
}
