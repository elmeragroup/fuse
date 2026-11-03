import type { Locator, Page } from "playwright";
import { expect } from "vitest";

/**
 * Opens the add-filter menu from a Filter button and the value submenu of one field, from the
 * keyboard. A pointer opens the submenu on hover, which ties it to the pointer: on a loaded CI
 * runner it closed with the pointer still on the field's row, and the next click found the
 * closing, inert submenu.
 *
 * @param page - The page the menus portal into.
 * @param within - The page or the demo that holds the Filter button.
 * @param field - The field's name, such as "Status".
 */
export async function openFilterSubmenu(page: Page, within: Page | Locator, field: string): Promise<void> {
  await within.getByRole("button", { name: "Filter", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("searchbox", { name: "Search fields", exact: true }).fill(field);
  const row = page.getByRole("menuitem", { name: field, exact: true });
  await expect.poll(() => row.getAttribute("data-highlighted")).not.toBeNull();
  await page.keyboard.press("ArrowRight");
  // The submenu is open once its search holds focus.
  const search = page.getByRole("searchbox", { name: `Search ${field}`, exact: true });
  await expect.poll(() => search.evaluate((element) => element === document.activeElement)).toBe(true);
}
