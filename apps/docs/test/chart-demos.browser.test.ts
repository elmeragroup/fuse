// Unit under test: the chart page's composed scenario demos as the docs build serves them. Oracles:
// the demos' own fixture constants, counted by hand. October 2025 has 31 days, and the October view
// stops at noon on the 31st, so 30 days hold usage and the 31st is pending. Config order puts the
// second series at data-series 1, which Down, Down and Enter select (CONTRACT section 9.4).
import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo } from "./demo-page";

describe("chart scenario demos in Chromium", () => {
  const browser = launchSuiteBrowser();

  async function demo(name: string): Promise<{ page: Page; demo: Locator }> {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, timezoneId: "Europe/Oslo" });
    return { page, demo: await openDemo(page, "chart", name) };
  }

  it.each(["Usage and price", "A month of usage and price", "Total price"])(
    "selects the second series from the keyboard in %s",
    async (name) => {
      const { page, demo: chart } = await demo(name);
      // The plot's single tab stop is its listbox's option.
      await chart.getByRole("option").focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      // DOM audit: Root's data-selected and the toggle's data-series are the selection contract.
      await expect
        .poll(async () => chart.locator('[data-slot="chart"]').getAttribute("data-selected"))
        .toBe("");
      expect(
        await chart.locator('[data-slot="chart-legend-toggle"][data-series="1"]').getAttribute("aria-pressed")
      ).toBe("true");
      await page.close();
    }
  );

  it("lists S12's October days in a data table, with the 31st pending and no Sparkline", async () => {
    const { page, demo: month } = await demo("A month of usage and price");
    const days = month.getByRole("table", { name: "Usage per day, October 2025" });
    const rows = days.locator("tbody tr");
    expect(await rows.count()).toBe(31);
    const last = rows.filter({ hasText: "2025-10-31" });
    expect(await last.locator("td").nth(1).textContent()).toBe("Pending");
    // DOM audit: Sparklines are the cell renderer's output under test.
    expect(await last.locator('[data-slot="sparkline"]').count()).toBe(0);
    expect(await days.locator('[data-slot="sparkline"]').count()).toBe(30);
    // The chart's own table prints the pending usage once, beside a price.
    expect(await month.locator('[data-slot="chart-table"] td', { hasText: "no data yet" }).count()).toBe(1);
    await page.close();
  });
});
