import type { Browser, Locator, Page } from "playwright";
import { afterAll, beforeAll, expect } from "vitest";

import { docsBaseUrl } from "./docs-server";

export { launchSuiteBrowser } from "./suite-browser";

/** The desktop viewport the layout-sensitive demo suites run at. */
export const DESKTOP_VIEWPORT = { width: 1280, height: 720 } as const;

/**
 * Navigates `page` to a component page and returns the region the docs shell renders
 * around the demo titled `name`, once that demo has hydrated.
 */
export async function openDemo(page: Page, slug: string, name: string): Promise<Locator> {
  page.setDefaultTimeout(5000);
  await page.goto(`${docsBaseUrl()}/components/${slug}`, { waitUntil: "load" });
  return sharedDemo(page, name);
}

/**
 * Navigates `page` to a component page and resolves once every demo on it has hydrated, for a
 * check that reads the whole page.
 */
export async function openDemoPage(page: Page, slug: string): Promise<void> {
  page.setDefaultTimeout(5000);
  await page.goto(`${docsBaseUrl()}/components/${slug}`, { waitUntil: "load" });
  await page.waitForFunction(
    () =>
      document.querySelectorAll("[data-demo-frame]").length ===
      document.querySelectorAll("[data-demo-frame][data-demo-hydrated]").length
  );
}

/**
 * Opens one component page for a describe's read-only checks before its first test, and closes it
 * after its last, so the checks share one load. Each check takes its demo with {@link sharedDemo}.
 *
 * @param browser - The suite's browser.
 * @param slug - The component page.
 * @param viewport - The page's viewport.
 * @returns The open page, between the describe's first and last test.
 */
export function shareDemoPage(
  browser: () => Browser,
  slug: string,
  viewport: { readonly width: number; readonly height: number }
): () => Page {
  let shared: Page | undefined;
  beforeAll(async () => {
    shared = await browser().newPage({ viewport });
    shared.setDefaultTimeout(5000);
    await shared.goto(`${docsBaseUrl()}/components/${slug}`, { waitUntil: "load" });
  });
  afterAll(async () => {
    await shared?.close();
    shared = undefined;
  });
  return () => {
    if (shared === undefined) {
      throw new Error("The shared demo page is only open between beforeAll and afterAll.");
    }
    return shared;
  };
}

/** The region around the demo titled `name` on an open component page, once it has hydrated. */
export async function sharedDemo(page: Page, name: string): Promise<Locator> {
  const demo = page.getByRole("region", { name, exact: true });
  await waitForDemoHydration(demo);
  return demo;
}

/**
 * Waits until the demo frame `demo` has hydrated. Each demo hydrates behind its frame's own
 * Suspense boundary, after the shell and the page, and input typed before then shows in the DOM
 * but never reaches React state. `DemoHydrationMarker` stamps `data-demo-hydrated` on the frame
 * from a passive effect inside that boundary, so the attribute means the demo and its effects are
 * live. `load` fires before even the shell hydrates.
 */
export async function waitForDemoHydration(demo: Locator): Promise<void> {
  await demo.and(demo.page().locator("[data-demo-hydrated]")).waitFor({ state: "attached" });
}

/**
 * Waits until the docs shell, its header and side nav, has hydrated. With Cache Components, Next
 * wraps each route segment in an Activity boundary, and React hydrates the boundary in a pass of
 * its own after the root. So Next's route announcer, which the root mounts, comes first: measured
 * on `/components/button`, the side nav's links got their handlers 23ms later, and 96-159ms later
 * at 4x CPU throttling. A link clicked in that window is still a plain anchor and loads a new
 * document. `load` doesn't cover it either, since it can fire before the announcer. Base UI's
 * scroll area writes its overflow variables onto the side nav's viewport as it mounts, whether the
 * nav overflows or not, and the shell commits as one, so once the variable is set every link and
 * control in the shell is live.
 */
export async function waitForDocsShellHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const viewport = document.querySelector<HTMLElement>(
      'nav[aria-label="Main navigation"] [data-slot="scroll-area-viewport"]'
    );
    return viewport !== null && viewport.style.getPropertyValue("--scroll-area-overflow-y-start") !== "";
  });
}

/** The theme axes a docs suite reads off a preview stage, the document root, or any scope. */
export type ThemeAttributes = {
  variant: string | null;
  brand: string | null;
  segment: string | null;
};

/**
 * Reads the three theme axes off `element`. Suites assert the same shape whether they are
 * auditing the document root or a demo stage, so the read lives here once.
 */
export async function readThemeAttributes(element: Locator): Promise<ThemeAttributes> {
  return element.evaluate((node) => ({
    variant: node.getAttribute("data-theme-variant"),
    brand: node.getAttribute("data-theme-brand"),
    segment: node.getAttribute("data-theme-segment"),
  }));
}

/**
 * Polls until `element` sits inside `container` on the horizontal axis. Vertical
 * containment is deliberately not asserted: some demos scroll by design.
 */
export async function expectInside(element: Locator, container: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const outer = await container.boundingBox();
      const inner = await element.boundingBox();
      return (
        outer !== null &&
        inner !== null &&
        inner.x >= outer.x - 1 &&
        inner.x + inner.width <= outer.x + outer.width + 1
      );
    })
    .toBe(true);
}
