import { expect } from "vitest";

import { px, roleNamed } from "./themed-browser-render";

/** The fieldset a labeled group composite renders, found by the name its legend gives it. */
export function legendFieldset(label: string): HTMLElement {
  const fieldset = roleNamed("group", label);
  if (!(fieldset instanceof HTMLFieldSetElement)) {
    throw new Error(`expected a fieldset named ${label}`);
  }
  return fieldset;
}

function legendBox(fieldset: HTMLElement): DOMRect {
  // DOM audit: the legend's own box is the visual-hiding contract; its name is checked by role.
  const legend = fieldset.querySelector("[data-slot=field-legend]");
  if (legend === null) {
    throw new Error("expected a legend in the fieldset");
  }
  return legend.getBoundingClientRect();
}

/** How far below the top of the fieldset's content box the group body starts. */
export function bodyOffset(fieldset: HTMLElement, body: HTMLElement): number {
  // The content box's top is where the heading row starts; the fieldset may keep
  // its UA border and padding in preflight-free output.
  const style = getComputedStyle(fieldset);
  const contentTop = fieldset.getBoundingClientRect().top + px(style.borderTopWidth) + px(style.paddingTop);
  return body.getBoundingClientRect().top - contentTop;
}

/** Assert the legend is visually hidden: `sr-only` leaves a box at most 1px square. */
export function assertLegendVisuallyHidden(fieldset: HTMLElement): void {
  const legend = legendBox(fieldset);
  expect(legend.width).toBeLessThanOrEqual(1);
  expect(legend.height).toBeLessThanOrEqual(1);
}

/**
 * Assert the `isLabelHidden` layout: the legend is visually hidden and its heading row
 * leaves no height, so the body starts where the row was.
 */
export function assertLabelHiddenLayout(fieldset: HTMLElement, body: HTMLElement): void {
  assertLegendVisuallyHidden(fieldset);
  expect(bodyOffset(fieldset, body)).toBeCloseTo(0, 1);
}

/** Assert the default layout: a visible legend on a heading row above the body. */
export function assertLabelShownLayout(fieldset: HTMLElement, body: HTMLElement): void {
  expect(legendBox(fieldset).height).toBeGreaterThan(1);
  expect(bodyOffset(fieldset, body)).toBeGreaterThan(0);
}
