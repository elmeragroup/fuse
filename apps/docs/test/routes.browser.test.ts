import { AxeBuilder } from "@axe-core/playwright";
// Every docs route, once, in Chromium. Units under test: the pages the docs build prerenders.
// Oracles: a page that renders reports no console error and no uncaught exception while it loads
// and hydrates, and axe-core's WCAG 2.2 A and AA rules find no violation at the default zoom.
// The route list is the build's own prerender manifest, so a new page joins the sweep the moment
// it exists, and routes that serve no HTML page (API, Open Graph images, text endpoints) stay out.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT } from "./demo-page";
import { docsBaseUrl, docsBuildDir } from "./docs-server";
import { launchSuiteBrowser } from "./suite-browser";

/**
 * Routes that serve something other than a docs page: API, Open Graph images, text endpoints and
 * `/private`, an empty noindex page.
 */
const NOT_A_PAGE = /^\/(?:_|api\/|og\/|demo-source\/|private$)|\.(?:png|txt|md|xml|ico|json|svg)$/u;

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

/** One prerendered route, as Next's manifest records it. */
type PrerenderedRoute = { readonly initialRevalidateSeconds: number | false };

/** The HTML routes the e2e build prerendered. */
function pageRoutes(): string[] {
  // SAFETY: Next writes the manifest; the test reads only its `routes` keys.
  const manifest = JSON.parse(
    readFileSync(path.join(docsBuildDir(true), "prerender-manifest.json"), "utf8")
  ) as { readonly routes: Readonly<Record<string, PrerenderedRoute>> };
  return Object.keys(manifest.routes)
    .filter((route) => !NOT_A_PAGE.test(route))
    .toSorted();
}

const ROUTES = pageRoutes();

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
    const errors: string[] = [];
    page.on("console", (message) => {
      if (
        message.type() !== "error" ||
        EXPECTED_MISSING.some((url) => message.location().url.endsWith(url))
      ) {
        return;
      }
      errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const response = await page.goto(`${docsBaseUrl()}${route}`, { waitUntil: "load" });
      expect(response?.status(), route).toBeLessThan(400);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .disableRules(DEFERRED_RULES)
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
