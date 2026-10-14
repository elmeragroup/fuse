import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

describe("Popover demos", () => {
  it("opens the anchored popover from its trigger, beside the anchor, and toggles it", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "popover", "Anchor");
    const trigger = demo.getByRole("button", { name: "Why this address?" });
    const address = demo.getByRole("paragraph").filter({ hasText: "Storgata 1, 0155 Oslo" });
    const popup = page.getByRole("dialog", { name: "Delivery address" });

    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("true");
    await expect.poll(() => popup.evaluate((element) => element.contains(document.activeElement))).toBe(true);

    // `anchor` wins over the trigger: the popup opens to the right of the address, not the button.
    // Polled, since the popup slides in from the anchor side as it opens.
    const anchorRight = await address.evaluate((element) => element.getBoundingClientRect().right);
    await expect
      .poll(() => popup.evaluate((element) => element.getBoundingClientRect().left))
      .toBeGreaterThanOrEqual(anchorRight - 1);

    await page.keyboard.press("Escape");
    await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("false");
    await expect.poll(() => trigger.evaluate((element) => element === document.activeElement)).toBe(true);
    await expect.poll(() => popup.isHidden()).toBe(true);

    await trigger.click();
    await trigger.click();
    await expect.poll(() => popup.isHidden()).toBe(true);
    await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("false");
    await page.close();
  });
});
