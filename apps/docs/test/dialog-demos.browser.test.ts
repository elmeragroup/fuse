import { describe, expect, it } from "vitest";

import { launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

describe("Dialog demos", () => {
  it("opens long content at its focusable title and restores focus on dismissal", async () => {
    const page = await browser().newPage();
    const demo = await openDemo(page, "dialog", "Scrolling content");
    const trigger = demo.getByRole("button", { name: "Open the full terms" });
    await trigger.click();
    const popup = page.getByRole("dialog", { name: "Full terms" });
    const heading = popup.getByRole("heading", { name: "Full terms" });
    await expect.poll(() => heading.evaluate((element) => element === document.activeElement)).toBe(true);
    await expect.poll(() => popup.evaluate((element) => element.scrollTop)).toBe(0);
    await page.keyboard.press("Tab");
    await expect.poll(() => popup.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect.poll(() => trigger.evaluate((element) => element === document.activeElement)).toBe(true);
    await page.close();
  });
});
