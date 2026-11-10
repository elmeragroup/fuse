import type { Locator, Page } from "playwright";

/** The desktop viewport the layout-sensitive demo suites run at. */
export const DESKTOP_VIEWPORT = { width: 1280, height: 720 } as const;

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
 * Waits until a block preview page has hydrated: `PreviewHydrationMarker` stamps
 * `data-preview-hydrated` on `<html>` from an effect once the page it follows is live.
 */
export async function waitForBlockPreviewHydration(page: Page): Promise<void> {
  await page.locator("html[data-preview-hydrated]").waitFor({ state: "attached" });
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
  identity: string | null;
  brand: string | null;
  segment: string | null;
};

/**
 * Reads the three theme axes off `element`. Suites assert the same shape whether they are
 * auditing the document root or a demo stage, so the read lives here once.
 */
export async function readThemeAttributes(element: Locator): Promise<ThemeAttributes> {
  return element.evaluate((node) => ({
    identity: node.getAttribute("data-theme-identity"),
    brand: node.getAttribute("data-theme-brand"),
    segment: node.getAttribute("data-theme-segment"),
  }));
}
