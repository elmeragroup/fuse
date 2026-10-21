import { afterEach, beforeEach, expect } from "vitest";
import { userEvent } from "vitest/browser";

/**
 * Clears the location hash around each test. A hash link is the navigation probe for an
 * `aria-disabled` row: following it changes `location.hash` without unloading the test page.
 */
export function resetHashAroundEach(): void {
  const clear = (): void => {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  };
  beforeEach(clear);
  afterEach(clear);
}

/**
 * Clicks `row`, then presses Enter on it, and checks that neither follows its hash link nor
 * records an `onClick` in `clicks`.
 *
 * @param row - The element announced `aria-disabled="true"`.
 * @param clicks - The names the row's `onClick` pushes.
 */
export async function expectActivationCancelled(row: HTMLElement, clicks: readonly string[]): Promise<void> {
  // Playwright refuses to click an `aria-disabled` element; `force` skips that check so the
  // click reaches the row the way a user's pointer does.
  await userEvent.click(row, { force: true });
  expect(location.hash, "after a click").toBe("");
  expect(clicks, "after a click").toEqual([]);

  row.focus();
  await userEvent.keyboard("{Enter}");
  expect(location.hash, "after Enter").toBe("");
  expect(clicks, "after Enter").toEqual([]);
}
