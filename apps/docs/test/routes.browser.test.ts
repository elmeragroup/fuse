import { AxeBuilder } from "@axe-core/playwright";
// Every docs route, once, in Chromium. Units under test: the pages the docs build prerenders.
// Oracles: a page that renders reports no console error and no uncaught exception while it loads
// and hydrates, and axe-core's WCAG 2.2 A and AA rules find no violation at the default zoom.
// The route list is the build's own prerender manifest, so a new page joins the sweep the moment
// it exists, and routes that serve no HTML page (API, Open Graph images, text endpoints) stay out.
import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, waitForBlockPreviewHydration, waitForDocsShellHydration } from "./demo-page";
import { docsBaseUrl, prerenderedRoutes } from "./docs-server";
import { collectPageErrors, waitForLandingHydration } from "./landing-page";
import { waitForStudioReady } from "./studio/page";
import { launchSuiteBrowser } from "./suite-browser";

/** Resources a demo requests on purpose to show its fallback, such as Avatar's broken image. */
const EXPECTED_MISSING = ["/this-avatar-does-not-exist.png"];

/**
 * Rules the sweep leaves off, open until #554. `label-content-name-mismatch` is experimental in
 * axe-core. The others are known site-wide gaps: syntax-highlighted code under the contrast
 * minimum, a few docs controls under the 24px target, and scrollable code blocks with no keyboard
 * stop.
 */
const DEFERRED_RULES = [
  "label-content-name-mismatch",
  "color-contrast",
  "target-size",
  "scrollable-region-focusable",
];

const ROUTES = prerenderedRoutes(true);

/** The landing and the shared addresses that render it in one theme. */
const LANDING = /^\/(?:themed\/.+)?$/u;

/**
 * Waits until the parts that wire accessible names in effects have hydrated, so axe reads the
 * page a visitor uses rather than its server HTML. `load` and `networkidle` can both come first:
 * on a saturated CI runner axe once read Base UI switches, checkboxes and a meter before Field
 * and the labelable parts had linked their labels. Next hydrates each route segment in a pass of
 * its own after the layouts, so no one layout signal covers every page: the landing, the docs
 * shell, every demo frame, the studio canvas and the block previews each have their own.
 */
async function waitForHydration(page: Page, route: string): Promise<void> {
  if (LANDING.test(route)) await waitForLandingHydration(page);
  if (route.startsWith("/studio")) await waitForStudioReady(page);
  if (route.startsWith("/blocks/") && route.includes("/preview")) await waitForBlockPreviewHydration(page);
  if ((await page.getByRole("navigation", { name: "Main navigation" }).count()) > 0) {
    await waitForDocsShellHydration(page);
  }
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-demo-frame]")].every((frame) =>
      frame.hasAttribute("data-demo-hydrated")
    )
  );
}

describe("every docs route", () => {
  const browser = launchSuiteBrowser();

  it("finds the pages to visit", () => {
    expect(ROUTES).toContain("/");
    expect(ROUTES).toContain("/components/button");
    expect(ROUTES.length).toBeGreaterThan(100);
  });

  // Five routes at once, each in a context of its own in the one browser: the project's
  // `maxConcurrency` bounds the pool, and no route shares state with another.
  it.concurrent.for(ROUTES)("renders %s without console errors and passes axe", async (route, { expect }) => {
    // axe-core opens a page of its own in the same context, so the page has an explicit one.
    const context = await browser().newContext({ viewport: DESKTOP_VIEWPORT });
    const page = await context.newPage();
    const errors = collectPageErrors(page, {
      console: true,
      ignore: (message) => EXPECTED_MISSING.some((url) => message.location().url.endsWith(url)),
    });
    try {
      const response = await page.goto(`${docsBaseUrl()}${route}`, { waitUntil: "load" });
      expect(response?.status(), route).toBeLessThan(400);
      await page.waitForLoadState("networkidle");
      await waitForHydration(page, route);
      // Frames stay out of the scan: the only framed content, the block previews under
      // /blocks/<block>/preview, is in ROUTES and checked as a route of its own. Legacy mode runs
      // one axe.run in the page, which honours iframes: false; the partial runner descends into
      // every frame whatever the options say. The frame element itself is still checked here.
      // `options` replaces the whole option object, so it comes before the tags and the rules.
      const results = await new AxeBuilder({ page })
        .options({ iframes: false })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .disableRules(DEFERRED_RULES)
        .setLegacyMode()
        .analyze();
      expect(
        results.violations.map(
          ({ id, nodes }) => `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`
        ),
        route
      ).toEqual([]);
      expect(errors, route).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
