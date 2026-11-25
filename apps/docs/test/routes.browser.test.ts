import { AxeBuilder } from "@axe-core/playwright";
// Every docs route, once, in Chromium. Units under test: the pages the docs build prerenders.
// Oracles: a page that renders reports no console error and no uncaught exception while it loads
// and hydrates, and axe-core's WCAG 2.2 A and AA rules find no violation at the default zoom,
// apart from the subtrees `AXE_EXCLUSIONS_BY_RULE` excludes from one listed rule.
// The route list is the build's own prerender manifest, so a new page joins the sweep the moment
// it exists, and routes that serve no HTML page (API, Open Graph images, text endpoints) stay out.
// The block at the end checks the routes whose docs table scrolls at 320px again at that width.
import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, waitForBlockPreviewHydration, waitForDocsShellHydration } from "./demo-page";
import { docsBaseUrl, prerenderedRoutes } from "./docs-server";
import { collectPageErrors, waitForLandingHydration } from "./landing-page";
import { isFocused, waitForStudioReady } from "./studio/page";
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
    // WCAG 1.4.3 exempts the text of an inactive control.
    '[data-slot="file-upload"][data-disabled] [data-slot="file-upload-description"]',
    '[data-slot="input-group"]:has(> [data-slot="input-group-control"]:disabled) [data-slot="input-group-text"]',
  ],
  "target-size": [
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
 * studio canvas and the block previews each have their own. These signals, and the settled
 * reveals below, are the readiness waits. `networkidle` is not one: it also counts a block page's
 * preview frame and Next's link prefetches, which axe never reads, and on a loaded runner it once
 * held `/blocks/app-shell`, a route that settles in two seconds locally, past the 60-second guard.
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

/**
 * The SkeletonReveal demos that pass `loading` for good, so their roots keep `aria-busy` and their
 * bones keep pulsing. A demo that never lands and is missing here holds the wait below until the
 * page guard fails the route, rather than letting a scan race it.
 */
const STAYS_LOADING = ["reveal-refetch", "reveal-plain-children", "reveal-markers"]
  .map((id) => `[data-demo-frame][aria-labelledby="${id}"]`)
  .join(", ");

/**
 * Waits until no SkeletonReveal on the page will change again: every reveal has landed its
 * content, apart from the demos `STAYS_LOADING` names, no leaving pane is left, and no fade under
 * a reveal is still running. Reduced motion keeps a reveal's opacity fades, so text axe reads
 * mid-fade fails contrast, and the skeleton page's timed demos land their data while the scans
 * may be running. Once every condition holds it stays true, since nothing loads again without a
 * click. Only a running, finite animation on the document timeline counts: a pulse never ends,
 * and a scroll-driven animation stays running at rest.
 */
async function waitForSettledReveals(page: Page): Promise<void> {
  await page.waitForFunction(
    (staysLoading) =>
      [...document.querySelectorAll('[data-slot="skeleton-reveal"]')].every(
        (root) =>
          (root.getAttribute("aria-busy") !== "true" || root.closest(staysLoading) !== null) &&
          root.querySelector(":scope > [data-exiting]") === null &&
          !root
            .getAnimations({ subtree: true })
            .some(
              (animation) =>
                animation.playState === "running" &&
                animation.timeline instanceof DocumentTimeline &&
                animation.effect?.getComputedTiming().endTime !== Number.POSITIVE_INFINITY
            )
      ),
    STAYS_LOADING
  );
}

/**
 * An axe scan of the page with no rules picked yet. Frames stay out of the scan: the only framed
 * content, the block previews under /blocks/<block>/preview, is in ROUTES and checked as a route of
 * its own. Legacy mode runs one axe.run in the page, which honours iframes: false; the partial
 * runner descends into every frame whatever the options say. The frame element itself is still
 * checked. `options` replaces the whole option object, so it comes before the tags and the rules.
 */
function axeScan(page: Page): AxeBuilder {
  return new AxeBuilder({ page }).options({ iframes: false }).setLegacyMode();
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
      await waitForSettledReveals(page);
      const scans = [
        axeScan(page).withTags(AXE_TAGS).disableRules(Object.keys(AXE_EXCLUSIONS_BY_RULE)),
        ...Object.entries(AXE_EXCLUSIONS_BY_RULE).map(([rule, selectors]) =>
          selectors.reduce((builder, selector) => builder.exclude(selector), axeScan(page).withRules(rule))
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

// The sweep runs at 1280px, where no docs table is wider than the column. This block reruns the
// routes whose docs table overflows at 320 CSS px, the width WCAG 1.4.10 Reflow names, which
// is narrower than any phone viewport the other suites use. Unit under test: each table's
// scroller, `DocsTable.Wrap`. Oracles: the heading the page author wrote above the table names the
// scroller, a keyboard user scrolls it with ArrowRight, and axe-core's
// `scrollable-region-focusable` finds every other scroller on the route reachable by keyboard too.
const REFLOW_VIEWPORT = { width: 320, height: 844 } as const;

/**
 * Each route that holds a docs table wider than {@link REFLOW_VIEWPORT}, with that table's heading
 * and whether its overflow is wide enough to check scrolling. Measured on 2026-11-25, two tables
 * overflow at 320 and the rest fit.
 */
const OVERFLOWING_TABLES = [
  // The fonts table overflows by about 300px, so it carries the scroll check.
  { route: "/handbook/fonts", heading: "Fonts on the brand sites", scrolls: true },
  // The tokens table overflows by about 12px and would fit after a small layout change, so it
  // checks only that its scroller is named and reachable.
  { route: "/handbook/tokens", heading: "Parts by role", scrolls: false },
] as const;

describe("a docs table wider than the 320px reflow width", () => {
  const browser = launchSuiteBrowser();

  it.for(OVERFLOWING_TABLES)(
    "names the scroller under $heading on $route and reaches it by keyboard",
    async ({ route, heading, scrolls }) => {
      const page = await browser().newPage({ viewport: REFLOW_VIEWPORT, reducedMotion: "reduce" });
      try {
        await page.goto(`${docsBaseUrl()}${route}`, { waitUntil: "load" });
        await waitForHydration(page, route);
        const scroller = page.getByRole("group", { name: heading, exact: true });
        expect(await scroller.getByRole("table").count()).toBe(1);
        // The named group must be the table's own scroller, not an ancestor of it.
        expect(await scroller.evaluate((element) => getComputedStyle(element).overflowX)).toBe("auto");
        // `focus()` also lands on tabindex -1, which Tab skips.
        expect(await scroller.getAttribute("tabindex")).toBe("0");
        await scroller.focus();
        expect(await isFocused(scroller)).toBe(true);
        if (scrolls) {
          expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
          expect(await scroller.evaluate((element) => element.scrollLeft)).toBe(0);
          await page.keyboard.press("ArrowRight");
          // The browser scrolls after the trusted keydown resolves.
          await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
        }
        const { violations } = await axeScan(page).withRules("scrollable-region-focusable").analyze();
        expect(violations.flatMap(({ nodes }) => nodes.map((node) => node.target.join(" ")))).toEqual([]);
      } finally {
        await page.context().close();
      }
    }
  );
});
