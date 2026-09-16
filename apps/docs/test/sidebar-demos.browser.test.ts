import { describe, expect, it } from "vitest";

import { expectInside, launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

describe("Sidebar demos", () => {
  it("exposes a visible mobile-sidebar close button and returns focus to the trigger", async () => {
    const page = await browser().newPage({ viewport: { width: 390, height: 844 } });
    const demo = await openDemo(page, "sidebar", "Inset variant");
    const trigger = demo.getByRole("button", { name: "Toggle sidebar" });
    await trigger.click();
    const popup = page.getByRole("dialog", { name: "Sidebar" });
    const close = popup.getByRole("button", { name: "Close", exact: true });
    await close.waitFor();
    await expectInside(close, popup);
    await close.click();
    await expect.poll(() => popup.count()).toBe(0);
    await expect.poll(() => trigger.evaluate((element) => element === document.activeElement)).toBe(true);
    await page.close();
  });
});
