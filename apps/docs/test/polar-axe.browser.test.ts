// Unit under test: the pie, radial, radar and clock pages' demos as the docs build serves them, in
// Chromium, Firefox and WebKit, in light and dark. Oracle: axe-core's WCAG rules, with the
// experimental check that a control's accessible name holds its visible label, so every demo stage
// reports no violation in either colour scheme.
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, firefox, webkit } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, waitForDemoHydration } from "./demo-page";
import { docsBaseUrl } from "./docs-server";

const PAGES = ["pie-chart", "radial-chart", "radar-chart", "clock-chart"] as const;

describe.each([
  ["Chromium", chromium],
  ["Firefox", firefox],
  ["WebKit", webkit],
] as const)("axe on the polar chart pages in %s", (_, engine) => {
  const browser = launchSuiteBrowser(engine);

  // The sweep waits for every demo on the page to hydrate, then scans them all, which takes Firefox
  // the longest, so each page gets a minute.
  it.each(PAGES.flatMap((slug) => (["light", "dark"] as const).map((scheme) => [slug, scheme] as const)))(
    "finds no violation in any %s demo in %s",
    { timeout: 60_000 },
    async (slug, scheme) => {
      // AxeBuilder reads frames through the page's context, so the page needs a context of its own.
      const context = await browser().newContext({
        viewport: DESKTOP_VIEWPORT,
        timezoneId: "Europe/Oslo",
        colorScheme: scheme,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      await page.goto(`${docsBaseUrl()}/components/${slug}`, { waitUntil: "load" });
      const regions = page.getByRole("region").filter({ has: page.locator("[data-demo-stage]") });
      const count = await regions.count();
      expect(count).toBeGreaterThan(0);
      for (let index = 0; index < count; index += 1) {
        await waitForDemoHydration(regions.nth(index));
      }
      const results = await new AxeBuilder({ page })
        .include("[data-demo-stage]")
        .options({ rules: { "label-content-name-mismatch": { enabled: true } } })
        .analyze();
      expect(results.violations.map(({ id, nodes }) => `${id} ${String(nodes.length)}`)).toEqual([]);
      await context.close();
    }
  );
});
