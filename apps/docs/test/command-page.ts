import type { Locator, Page } from "playwright";

/**
 * The `aria-label` of the focused element. Not its text: a palette's opener can share the field's
 * name through its text, and focus counts as moved only once it reaches the labelled field or row.
 */
export async function focusedName(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null);
}

/** The text of the option Base UI marks highlighted inside `scope`. */
export async function highlighted(scope: Locator): Promise<string | null> {
  return scope.locator('[role="option"][data-highlighted]').first().textContent();
}

/** Whether Base UI highlights `option`, the row Enter runs. */
export async function isHighlighted(option: Locator): Promise<boolean> {
  return (await option.getAttribute("data-highlighted")) !== null;
}

/** The labels of the groups a Command lists inside `scope`, in order. */
export async function groupLabels(scope: Locator): Promise<string[]> {
  return scope.locator('[data-slot="command-label"]').allTextContents();
}
