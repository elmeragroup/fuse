import { AxeBuilder } from "@axe-core/playwright";
// Every docs route, once, in Chromium. Units under test: the pages the docs build prerenders.
// Oracles: a page that renders reports no console error and no uncaught exception while it loads
// and hydrates, and axe-core's WCAG 2.2 A and AA rules find no violation at the default zoom,
// apart from the subtrees `AXE_EXCLUSIONS_BY_RULE` excludes from one listed rule.
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
 * The selectors each listed rule skips, in groups. Each group's comment names what keeps it out:
 * an open issue, a WCAG exemption or a reason axe's check does not apply. A listed rule runs in a
 * scan of its own that skips the whole subtree of each node one of its selectors matches. The skip
 * holds for that rule only. Every other rule still checks the subtree, and a node outside every
 * subtree still fails the route.
 */
const AXE_EXCLUSIONS_BY_RULE = {
  "color-contrast": [
    // #1037: the light Sugar High syntax colors. The identifier color passes, so it stays checked.
    ".sh__token--keyword",
    ".sh__token--string",
    ".sh__token--class",
    ".sh__token--property",
    ".sh__token--entity",
    ".sh__token--jsxliterals",
    ".sh__token--sign",
    ".sh__token--comment",
    // #1038: variant="brand" text in a component demo.
    '[data-demo-stage] [data-slot="heading"].text-brand',
    '[data-demo-stage] [data-slot="text"].text-brand',
    '[data-demo-stage] [data-slot="span"].text-brand',
    '[data-demo-stage] [data-slot="link"].text-brand',
    // #1039: every LiveLineChart axis tick. Only the ticks in the edge fade fail, but a tick's
    // opacity changes as readings arrive, so a selector keyed to it races the scan.
    '[data-slot$="-axis"][data-live] [data-slot$="-tick"]',
    // WCAG 1.4.3 exempts the text of an inactive control.
    '[data-slot="file-upload"][data-disabled] [data-slot="file-upload-description"]',
    '[data-slot="input-group"]:has(> [data-slot="input-group-control"]:disabled) [data-slot="input-group-text"]',
  ],
  "target-size": [
    // #1040: date segments under 24px at dense density. The date pages nest at most one density
    // stage under the document, so a segment under a comfortable stage stays checked.
    '[data-density="dense"] [data-slot="date-input-segment"]:not([data-density="dense"] [data-density="comfortable"] *)',
    // axe measures the 16px box, not the Checkbox's 38x30 `::after` hit area (#510).
    '[data-slot="data-table-select-all"]',
    // The studio canvas shows each artboard's preview scaled down to fit. axe still checks the
    // studio chrome, the artboard name labels included.
    "[data-artboard-id] > [data-demo-stage]",
  ],
} satisfies { readonly [rule: string]: ReadonlyArray<string> };

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const ROUTES = prerenderedRoutes(true);

/** The landing and the shared addresses that render it in one theme. */
const LANDING = /^\/(?:themed\/.+)?$/u;

/**
 * Waits until the parts that wire accessible names in effects have hydrated, so axe reads the
 * page a visitor uses rather than its server HTML. `load` can come first: on a saturated CI runner
 * axe once read Base UI switches, checkboxes and a meter before Field and the labelable parts had
 * linked their labels. Next hydrates each route segment in a pass of its own after the layouts,
 * so no one layout signal covers every page: the landing, the docs shell, every demo frame, the
 * studio canvas and the block previews each have their own. These signals are the only readiness
 * wait. `networkidle` is not one: it also counts a block page's preview frame and Next's link
 * prefetches, which axe never reads, and on a loaded runner it once held `/blocks/app-shell`, a
 * route that settles in two seconds locally, past the 60-second guard.
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
    // Reduced motion skips the chart entrances, whose mid-animation frames fail contrast. Waiting
    // for `[data-entering]` to clear races, because a chart below the fold starts its entrance
    // only when it scrolls into view, which can happen during the scan.
    const context = await browser().newContext({ viewport: DESKTOP_VIEWPORT, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = collectPageErrors(page, {
      console: true,
      ignore: (message) => EXPECTED_MISSING.some((url) => message.location().url.endsWith(url)),
    });
    try {
      const response = await page.goto(`${docsBaseUrl()}${route}`, { waitUntil: "load" });
      expect(response?.status(), route).toBeLessThan(400);
      await waitForHydration(page, route);
      // Frames stay out of the scan: the only framed content, the block previews under
      // /blocks/<block>/preview, is in ROUTES and checked as a route of its own. Legacy mode runs
      // one axe.run in the page, which honours iframes: false; the partial runner descends into
      // every frame whatever the options say. The frame element itself is still checked here.
      // `options` replaces the whole option object, so it comes before the tags and the rules.
      const scan = (): AxeBuilder => new AxeBuilder({ page }).options({ iframes: false }).setLegacyMode();
      const scans = [
        scan().withTags(AXE_TAGS).disableRules(Object.keys(AXE_EXCLUSIONS_BY_RULE)),
        ...Object.entries(AXE_EXCLUSIONS_BY_RULE).map(([rule, selectors]) =>
          selectors.reduce((builder, selector) => builder.exclude(selector), scan().withRules(rule))
        ),
      ];
      // The scans run one after another, because axe-core refuses to start a run while another is
      // in progress.
      const violations = [];
      for (const builder of scans) violations.push(...(await builder.analyze()).violations);
      expect(
        violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`),
        route
      ).toEqual([]);
      expect(errors, route).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
