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
