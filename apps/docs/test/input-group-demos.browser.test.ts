import { describe, expect, it } from "vitest";

import { launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

describe("InputGroup demos", () => {
  it("copies, clears and resets the Button addons demo", async () => {
    const context = await browser().newContext({ permissions: ["clipboard-read", "clipboard-write"] });
    const page = await context.newPage();
    const demo = await openDemo(page, "input-group", "Button addons");
    await demo.getByRole("button", { name: "Copy", exact: true }).click();
    await expect.poll(() => demo.getByRole("status").textContent()).toBe("Meter number copied.");
    await demo.getByRole("button", { name: "Clear meter number" }).click();
    await expect.poll(() => demo.getByRole("textbox", { name: "Meter number" }).inputValue()).toBe("");
    await demo.getByRole("button", { name: "Reset example" }).click();
    await expect
      .poll(() => demo.getByRole("textbox", { name: "Meter number" }).inputValue())
      .toBe("707057500012345678");
    await context.close();
  });

  it("sends the Textarea demo's local message and resets the receipt", async () => {
    const page = await browser().newPage();
    const message = await openDemo(page, "input-group", "Textarea");
    await message.getByRole("textbox", { name: "Message to support" }).fill("Sample meter issue");
    await message.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(() => message.getByRole("status").textContent()).toContain("Sample meter issue");
    await message.getByRole("button", { name: "Reset example" }).click();
    await expect.poll(() => message.getByRole("status").textContent()).toBe("");
    await page.close();
  });
});
