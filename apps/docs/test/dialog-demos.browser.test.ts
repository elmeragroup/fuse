import { describe, expect, it } from "vitest";

import { launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

describe("Dialog demos", () => {
  it("submits the form through its footer button and resets the local receipt", async () => {
    const page = await browser().newPage();
    const demo = await openDemo(page, "dialog", "Form");
    await demo.getByRole("button", { name: "Call me back" }).click();
    const dialog = page.getByRole("dialog", { name: "Call me back" });
    await dialog.getByRole("textbox", { name: "Name" }).fill("Kari Nordmann");
    await dialog.getByRole("textbox", { name: "Phone number" }).fill("91234567");
    await dialog.getByRole("radio", { name: "Afternoon" }).click();
    await dialog.getByRole("button", { name: "Book the call" }).click();
    await expect.poll(() => dialog.count()).toBe(0);
    await expect
      .poll(() => demo.getByRole("status").textContent())
      .toBe("We will call Kari Nordmann on 91234567 in the afternoon in this demo.");
    await demo.getByRole("button", { name: "Reset example" }).click();
    await expect.poll(() => demo.getByRole("status").textContent()).toBe("");
    await page.close();
  });

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
