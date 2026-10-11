import { expect } from "vitest";
import { userEvent } from "vitest/browser";

import { DENSITIES } from "../src/theme/density";
import { computedColor, ringLayers, settleTransitions } from "./assert-invalid-ring";

/**
 * The colour the element's `ring-ring` resolves to: its `--ring` role, or the element's own
 * text colour, Tailwind's `currentcolor` fallback, where no theme declares the role. Probes are
 * child elements, which an <input> cannot hold, so the colour resolves at the parent, which
 * sits in the same theme scope.
 */
function ringRoleColor(element: HTMLElement, token: "--ring" | "--error"): string {
  return computedColor(element.parentElement ?? element, `var(${token}, ${getComputedStyle(element).color})`);
}

/**
 * The shared focus ring's fingerprint, read from the painted `box-shadow` as it stands, so the
 * caller settles transitions first: exactly one outer ring, 2px wide and flush (an offset would paint a second layer and
 * widen the ring), in the element's `--ring` role, or in its `--error` role on a focused
 * invalid control. The resting invalid halo is 3px in `--error` at 20% alpha, so it never
 * matches, and neither does an inset ring.
 */
function hasFocusRing(element: HTMLElement): boolean {
  const [ring, ...rest] = ringLayers(element);
  if (ring === undefined || rest.length > 0 || ring.inset || ring.spread !== "2px") {
    return false;
  }
  return ring.color === ringRoleColor(element, "--ring") || ring.color === ringRoleColor(element, "--error");
}

/**
 * Assert the focus ring a keyboard-focused valid control paints: one outer 2px ring, flush with
 * no offset layer, in the theme's `--ring` role at that element.
 */
export function expectValidFocusRing(element: HTMLElement, message: string): void {
  settleTransitions(element);
  expect(ringLayers(element), message).toEqual([
    { spread: "2px", color: ringRoleColor(element, "--ring"), inset: false },
  ]);
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
 * ring fingerprint inside this helper.
 */
export function expectFocusRing(element: HTMLElement, message: string): void {
  settleTransitions(element);
  expect(hasFocusRing(element), message).toBe(true);
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

/**
 * `focusRing({ target: "within" })` variant: keyboard focus on `control` paints
 * the ring on `ringHost` (the group Root) and never a second ring on the control
 * itself; blurring clears it. Like the `self` keyboard helper, the mouse arm is
 * asserted by the caller on a non-editable receiver — Chromium always matches
 * `:focus-visible` on a clicked text field, so mouse-absence is probed by
 * clicking an addon button instead (see the InputGroup suite).
 */
export async function assertWithinKeyboardFocusRingAtBothDensities(
  previous: HTMLElement,
  control: HTMLElement,
  ringHost: HTMLElement
): Promise<void> {
  await withBothDensities(async () => {
    previous.focus();
    await userEvent.keyboard("{Tab}");
    settleTransitions(ringHost, control);
    expect(control.matches(":focus-visible"), "Tab must land with :focus-visible").toBe(true);
    expect(hasFocusRing(ringHost), "focus-visible must paint the shared ring on the group").toBe(true);
    expect(hasFocusRing(control), "the control must not paint a second ring").toBe(false);
    control.blur();
    settleTransitions(ringHost);
    expect(hasFocusRing(ringHost), "blur must clear the group ring").toBe(false);
  });
}

/**
 * `focusRing({ target: "state", isFocusVisible })` variant: keyboard focus on
 * `control` paints the ring on `ringHost` and never a second ring on the
 * control; leaving the field clears it; mouse focus on the control does not
 * paint the host ring. Date segments and other non-text receivers can take the
 * mouse click directly — unlike `within`, Chromium does not force
 * `:focus-visible` on them. RAC's `isFocusVisible` is React state, so the blur
 * arm clicks `previous` rather than calling `control.blur()`.
 */
export async function assertStateFocusRingAtBothDensities(
  previous: HTMLElement,
  control: HTMLElement,
  ringHost: HTMLElement
): Promise<void> {
  await withBothDensities(async () => {
    previous.focus();
    await userEvent.keyboard("{Tab}");
    settleTransitions(ringHost, control);
    expect(control.matches(":focus-visible"), "Tab must land with :focus-visible").toBe(true);
    expect(hasFocusRing(ringHost), "focus-visible must paint the shared ring on the group").toBe(true);
    expect(hasFocusRing(control), "the control must not paint a second ring").toBe(false);

    await userEvent.click(previous);
    settleTransitions(ringHost);
    expect(hasFocusRing(ringHost), "blur must clear the group ring").toBe(false);

    await userEvent.click(control);
    settleTransitions(ringHost);
    expect(hasFocusRing(ringHost), "mouse focus on the control must not paint the group ring").toBe(false);
  });
}

/**
 * The ancestors that would clip the shared focus ring around `control`. The ring is 2px wide
 * and flush, so it paints 2px past the control's border box; an ancestor clips it
 * when it hides overflow, clips its paint, or sets a clip path, and the ring's box leaves that
 * ancestor's padding box.
 *
 * @returns One `tag.class` label per clipping ancestor, empty when the whole ring paints.
 */
export function focusRingClippers(control: HTMLElement): string[] {
  const rect = control.getBoundingClientRect();
  const ring = { left: rect.left - 2, top: rect.top - 2, right: rect.right + 2, bottom: rect.bottom + 2 };
  const clippers: string[] = [];
  for (let ancestor = control.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const ancestorStyle = getComputedStyle(ancestor);
    const clips =
      ancestorStyle.overflowX !== "visible" ||
      ancestorStyle.overflowY !== "visible" ||
      ancestorStyle.clipPath !== "none" ||
      /paint|strict|content/.test(ancestorStyle.contain);
    if (!clips || ancestor === document.documentElement || ancestor === document.body) {
      continue;
    }
    const box = ancestor.getBoundingClientRect();
    const inner = {
      left: box.left + ancestor.clientLeft,
      top: box.top + ancestor.clientTop,
      right: box.left + ancestor.clientLeft + ancestor.clientWidth,
      bottom: box.top + ancestor.clientTop + ancestor.clientHeight,
    };
    if (
      ring.left < inner.left ||
      ring.top < inner.top ||
      ring.right > inner.right ||
      ring.bottom > inner.bottom
    ) {
      clippers.push(`${ancestor.tagName}.${ancestor.className}`);
    }
  }
  return clippers;
}
