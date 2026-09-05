import { expect } from "vitest";
import { userEvent } from "vitest/browser";

function hasFocusRing(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  const ring = style.getPropertyValue("--tw-ring-shadow");
  const offset = style.getPropertyValue("--tw-ring-offset-width");
  return ring.includes("calc(") && offset === "2px";
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
  expect(element.matches(":focus-visible"), "Tab must land with :focus-visible").toBe(true);
  expect(hasFocusRing(element), "focus-visible must paint the shared ring").toBe(true);

  element.blur();
  await userEvent.click(element);
  expect(element.matches(":focus-visible"), "mouse focus must not match :focus-visible").toBe(false);
  expect(hasFocusRing(element), "mouse focus must not paint the shared ring").toBe(false);
}

/**
 * Ring-presence/absence probes for hosts that are already the active element
 * (a portalled popup that received initial keyboard focus). Keeps the Tailwind
 * ring fingerprint inside this helper.
 */
export function expectFocusRing(element: HTMLElement, message: string): void {
  expect(hasFocusRing(element), message).toBe(true);
}

export function expectNoFocusRing(element: HTMLElement, message: string): void {
  expect(hasFocusRing(element), message).toBe(false);
}

const DENSITIES = ["dense", "comfortable"] as const;

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
    expect(control.matches(":focus-visible"), "Tab must land with :focus-visible").toBe(true);
    expect(hasFocusRing(ringHost), "focus-visible must paint the shared ring on the group").toBe(true);
    expect(hasFocusRing(control), "the control must not paint a second ring").toBe(false);
    control.blur();
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
    expect(control.matches(":focus-visible"), "Tab must land with :focus-visible").toBe(true);
    expect(hasFocusRing(ringHost), "focus-visible must paint the shared ring on the group").toBe(true);
    expect(hasFocusRing(control), "the control must not paint a second ring").toBe(false);

    await userEvent.click(previous);
    expect(hasFocusRing(ringHost), "blur must clear the group ring").toBe(false);

    await userEvent.click(control);
    expect(hasFocusRing(ringHost), "mouse focus on the control must not paint the group ring").toBe(false);
  });
}
