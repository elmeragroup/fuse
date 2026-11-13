import { expect } from "vitest";
import { userEvent } from "vitest/browser";

import { DENSITIES } from "../src/theme/density";
import type { RingLayer } from "./assert-invalid-ring";
import { computedColor, ringLayers, settleTransitions } from "./assert-invalid-ring";

/**
 * The colour the element's `ring-ring` resolves to: its `--ring` role, or the element's own
 * text colour, Tailwind's `currentcolor` fallback, where no theme declares the role. Probes are
 * child elements, which an <input> cannot hold, so the colour resolves at the parent, which
 * sits in the same theme scope.
 */
function ringRoleColor(element: HTMLElement): string {
  return computedColor(element.parentElement ?? element, `var(--ring, ${getComputedStyle(element).color})`);
}

/**
 * The valid focus ring's fingerprint, read from the painted `box-shadow` as it stands, so the
 * caller settles transitions first: exactly one outer ring, 2px wide and flush (an offset would
 * paint a second layer and widen the ring), in the element's `--ring` role. The resting invalid
 * halo and an inset ring never match; a focused invalid control has its own assertion,
 * `expectInvalidFocusRing`.
 */
function validFocusRing(element: HTMLElement): RingLayer {
  return { spread: "2px", color: ringRoleColor(element), inset: false };
}

function hasFocusRing(element: HTMLElement): boolean {
  const [ring, ...rest] = ringLayers(element);
  const valid = validFocusRing(element);
  return (
    rest.length === 0 &&
    ring?.spread === valid.spread &&
    ring.color === valid.color &&
    ring.inset === valid.inset
  );
}

/**
 * Shared visual assertion for the package `focusRing` recipe:
 * the ring is present on `:focus-visible` (keyboard) and absent on mouse focus.
 * `previous` must be the focusable control immediately before `element` in tab order.
 */
export async function assertFocusRingOnKeyboardAbsentOnMouse(
  previous: HTMLElement,
  element: HTMLElement
): Promise<void> {
  await userEvent.click(previous);
  await userEvent.keyboard("{Tab}");
  settleTransitions(element);
  expect(element.matches(":focus-visible"), "Tab must land with :focus-visible").toBe(true);
  expect(hasFocusRing(element), "focus-visible must paint the shared ring").toBe(true);

  element.blur();
  await userEvent.click(element);
  settleTransitions(element);
  expect(element.matches(":focus-visible"), "mouse focus must not match :focus-visible").toBe(false);
  expect(hasFocusRing(element), "mouse focus must not paint the shared ring").toBe(false);
}

/**
 * Ring-presence/absence probes for hosts that are already the active element
 * (a portalled popup that received initial keyboard focus). Keeps the Tailwind
 * ring fingerprint inside this helper. `expectFocusRing` asserts the ring a focused valid
 * control paints, one outer 2px ring, flush with no offset layer, in the theme's `--ring` role
 * at that element, and fails with a layer diff.
 */
export function expectFocusRing(element: HTMLElement, message: string): void {
  settleTransitions(element);
  expect(ringLayers(element), message).toEqual([validFocusRing(element)]);
}

export function expectNoFocusRing(element: HTMLElement, message: string): void {
  settleTransitions(element);
  expect(hasFocusRing(element), message).toBe(false);
}

async function withBothDensities(run: () => Promise<void>): Promise<void> {
  const previousDensity = document.documentElement.getAttribute("data-density");
  try {
    for (const density of DENSITIES) {
      document.documentElement.setAttribute("data-density", density);
      await run();
    }
  } finally {
    if (previousDensity === null) {
      document.documentElement.removeAttribute("data-density");
    } else {
      document.documentElement.setAttribute("data-density", previousDensity);
    }
  }
}

export async function assertKeyboardFocusRingAtBothDensities(
  previous: HTMLElement,
  element: HTMLElement
): Promise<void> {
  await withBothDensities(async () => {
    previous.focus();
    await userEvent.keyboard("{Tab}");
    settleTransitions(element);
    expect(element.matches(":focus-visible"), "Tab must land with :focus-visible").toBe(true);
    expect(hasFocusRing(element), "focus-visible must paint the shared ring").toBe(true);
    element.blur();
  });
}

export async function assertFocusRingAtBothDensities(
  previous: HTMLElement,
  element: HTMLElement
): Promise<void> {
  await withBothDensities(() => assertFocusRingOnKeyboardAbsentOnMouse(previous, element));
}
