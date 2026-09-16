import { describe, expect, it } from "vitest";

import { launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

describe("Focusable demos", () => {
  it("focuses the unavailable tooltip trigger without focus warnings", async () => {
    const page = await browser().newPage();
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "warning" || message.type() === "error") problems.push(message.text());
    });
    const demo = await openDemo(page, "focusable", "Tooltip trigger");
    const trigger = demo.getByRole("button", { name: "Closed meter" });
    await trigger.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect.poll(() => trigger.evaluate((element) => element === document.activeElement)).toBe(true);
    await page.getByRole("tooltip").waitFor();
    expect(await trigger.getAttribute("aria-disabled")).toBe("true");
    expect(problems).toEqual([]);
    await page.close();
  });
});
