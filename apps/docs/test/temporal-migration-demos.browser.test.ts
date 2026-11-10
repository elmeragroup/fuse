import { describe, expect, it } from "vitest";

import { launchSuiteBrowser, openDemoAt, waitForAllDemos } from "./demo-page";
import { docsBaseUrl } from "./docs-server";

const browser = launchSuiteBrowser();

const PAGE = "/handbook/temporal-migration";

/** The narrowest phone window the page is shot at for review. */
const PHONE_VIEWPORT = { width: 375, height: 812 } as const;

describe("Temporal migration demos", () => {
  it("takes ISO text from @internationalized/date and reports the typed day as ISO text and a parseDate call", async () => {
    const page = await browser().newPage();
    const demo = await openDemoAt(page, PAGE, "Temporal in, ISO out");
    const stage = demo.locator("[data-demo-stage]");
    await stage.getByText("ISO for the server: 2026-10-05", { exact: true }).waitFor();
    await demo.getByRole("spinbutton", { name: "day, Moving date" }).click();
    await page.keyboard.type("12");
    await stage.getByText("ISO for the server: 2026-10-12", { exact: true }).waitFor();
    await stage
      .getByText('Back to @internationalized/date: parseDate("2026-10-12")', { exact: true })
      .waitFor();
    await page.close();
  });

  it("shows the error the server returns under the picker's name, focuses it, and saves a weekday", async () => {
    const page = await browser().newPage();
    const demo = await openDemoAt(page, PAGE, "Server errors by name");
    const stage = demo.locator("[data-demo-stage]");
    const save = demo.getByRole("button", { name: "Save" });
    await save.click();
    await stage.getByText("We do not move people on weekends.", { exact: true }).waitFor();
    const group = demo.getByRole("group", { name: "Moving date" });
    await expect.poll(() => group.getAttribute("data-invalid")).toBe("true");
    // The returned error moves focus to the picker's first segment, before anything else is pressed.
    const month = demo.getByRole("spinbutton", { name: "month, Moving date" });
    await expect.poll(() => month.evaluate((element) => element === document.activeElement)).toBe(true);

    await demo.getByRole("spinbutton", { name: "day, Moving date" }).click();
    await page.keyboard.type("12");
    await expect
      .poll(() => stage.getByText("We do not move people on weekends.", { exact: true }).count())
      .toBe(0);
    await save.click();
    await stage.getByText("Saved 2026-10-12.", { exact: true }).waitFor();
    await page.close();
  });

  it("fits a 375px window without scrolling sideways", async () => {
    const page = await browser().newPage({ viewport: PHONE_VIEWPORT });
    page.setDefaultTimeout(10_000);
    await page.goto(`${docsBaseUrl()}${PAGE}`, { waitUntil: "load" });
    await waitForAllDemos(page);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    await page.close();
  });
});
