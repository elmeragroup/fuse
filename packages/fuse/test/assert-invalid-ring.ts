import { expect } from "vitest";

import { cssVarColor } from "./themed-browser-render";

/**
 * A ring layer of a computed `box-shadow`: its spread, its computed colour string and whether
 * it paints inside the border box.
 */
export type RingLayer = { readonly spread: string; readonly color: string; readonly inset: boolean };

/**
 * The invalid ring's colour, written by hand: the `--error` role at 20% alpha, mixed the way
 * Tailwind's `/20` opacity modifier mixes it.
 */
const INVALID_RING_COLOR = "color-mix(in oklab, var(--error) 20%, transparent)";

/** Split a computed `box-shadow` into layers at the commas outside colour functions. */
export function shadowLayers(boxShadow: string): string[] {
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

/** One box-shadow layer's lengths in px. */
export type ShadowLengths = {
  readonly x: number;
  readonly y: number;
  readonly blur: number;
  readonly spread: number;
};

/**
 * The lengths of one computed box-shadow layer. Chromium serializes a layer as its colour,
 * then x, y, blur and spread, so a layer without exactly those four lengths has none.
 */
export function shadowLayerLengths(layer: string): ShadowLengths | undefined {
  const lengths = layer.match(/-?[\d.]+px/gu)?.map(Number.parseFloat) ?? [];
  const [x, y, blur, spread] = lengths;
  if (
    lengths.length !== 4 ||
    x === undefined ||
    y === undefined ||
    blur === undefined ||
    spread === undefined
  ) {
    return undefined;
  }
  return { x, y, blur, spread };
}

/**
 * Resolve a CSS colour expression to the string Chromium computes for it, the way
 * `cssVarColor` resolves a token: a probe under the same theme scope takes it as its colour.
 * Chromium serializes a box-shadow layer's colour the same way, so the two compare exactly.
 */
export function computedColor(host: HTMLElement, color: string): string {
  const probe = document.createElement("span");
  probe.style.color = color;
  host.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  return computed;
}

/**
 * Jump the elements' running CSS transitions to their end, synchronously, so the computed
 * styles read next are the values the elements settle on rather than one frame of a
 * transition. A field box, for one, transitions its border and `box-shadow` as focus arrives.
 * Every public ring assertion calls it once, before any of its reads, so its border and its
 * shadow come from the same settled state.
 *
 * @param elements - The elements an assertion is about to read.
 */
export function settleTransitions(...elements: readonly HTMLElement[]): void {
  for (const element of elements) {
    for (const animation of element.getAnimations()) {
      if (animation instanceof CSSTransition) {
        animation.finish();
      }
    }
  }
}

/**
 * The rings an element paints, read from its computed `box-shadow` as it stands: every layer
 * with no offset and no blur but a spread, as the `ring-*` utilities emit. Chromium writes each
 * layer's colour first, its four lengths after it and an `inset` keyword last; the transparent
 * placeholder layers Tailwind stacks have no spread. Call {@link settleTransitions} first to
 * read the settled value.
 */
export function ringLayers(element: HTMLElement): RingLayer[] {
  return shadowLayers(getComputedStyle(element).boxShadow).flatMap((layer) => {
    const inset = /(?:^|\s)inset(?:\s|$)/u.test(layer);
    const bare = layer.replace(/(?:^|\s)inset(?=\s|$)/u, "").trim();
    const lengths = shadowLayerLengths(bare);
    if (lengths?.x !== 0 || lengths.y !== 0 || lengths.blur !== 0 || lengths.spread === 0) {
      return [];
    }
    return [{ spread: `${lengths.spread}px`, color: bare.replace(/(?:\s+-?[\d.]+px)+$/u, ""), inset }];
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
  settleTransitions(element);
  const host = element.parentElement ?? element;
  expect.soft(getComputedStyle(element).borderTopColor, `${label} border`).toBe(cssVarColor(host, "--error"));
  expect
    .soft(ringLayers(element), `${label} ring`)
    .toEqual([{ spread: "3px", color: computedColor(host, INVALID_RING_COLOR), inset: false }]);
}

/**
 * Assert the focused invalid face: an `--error` border, then a solid 2px line of the `--error`
 * role flush against it, then the resting halo, `--error` at 20% alpha, as the outermost line,
 * reaching 5px past the border. Chromium lists the solid line's layer first, so it paints above
 * the halo's layer, which leaves 3px of halo showing beyond it. Every expected value is written
 * here by hand; the role colour is read from the theme.
 *
 * @param label - The ring host's name in failure messages.
 * @param element - The element that paints the face: the control, or its within/state group.
 */
export function expectInvalidFocusRing(label: string, element: HTMLElement): void {
  settleTransitions(element);
  const host = element.parentElement ?? element;
  const error = cssVarColor(host, "--error");
  expect.soft(getComputedStyle(element).borderTopColor, `${label} border`).toBe(error);
  expect.soft(ringLayers(element), `${label} focused rings`).toEqual([
    { spread: "2px", color: error, inset: false },
    { spread: "5px", color: computedColor(host, INVALID_RING_COLOR), inset: false },
  ]);
}

/**
 * Assert that an element paints no ring at all, as an embedded control whose group owns
 * the invalid ring must.
 *
 * @param label - The control's name in failure messages.
 * @param element - The embedded control.
 */
export function expectNoRing(label: string, element: HTMLElement): void {
  settleTransitions(element);
  expect(ringLayers(element), `${label} ring`).toEqual([]);
}
