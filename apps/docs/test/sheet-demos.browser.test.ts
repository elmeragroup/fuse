import { describe, expect, it } from "vitest";

import { launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

describe("Sheet demos", () => {
  it("submits the form through its footer button and resets the local receipt", async () => {
    const page = await browser().newPage();
    const demo = await openDemo(page, "sheet", "Form");
    await demo.getByRole("button", { name: "Report a reading" }).click();
    const dialog = page.getByRole("dialog", { name: "Report a reading" });
    await dialog.getByRole("textbox", { name: "Meter number" }).fill("707057500012345678");
    await dialog.getByRole("spinbutton", { name: "Reading" }).fill("12345");
    await dialog.getByRole("button", { name: "Send reading" }).click();
    await expect.poll(() => dialog.count()).toBe(0);
    await expect.poll(() => demo.getByRole("status").textContent()).toContain("Reading 12345 recorded");
    await demo.getByRole("button", { name: "Reset example" }).click();
    await expect.poll(() => demo.getByRole("status").textContent()).toBe("");
    await page.close();
  });
});
