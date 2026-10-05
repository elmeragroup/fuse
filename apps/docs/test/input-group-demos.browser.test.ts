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

  it("labels, describes and invalidates the grouped inputs through Field", async () => {
    const page = await browser().newPage();
    const demo = await openDemo(page, "input-group", "In a field");
    const describedBy = (name: string) =>
      demo.getByRole("textbox", { name, exact: true }).evaluate((input) =>
        (input.getAttribute("aria-describedby") ?? "")
          .split(/\s+/u)
          .filter(Boolean)
          .map((id) => document.getElementById(id)?.textContent)
          .join(" ")
      );

    const postalCode = demo.getByRole("textbox", { name: "Postal code", exact: true });
    await expect.poll(() => describedBy("Postal code")).toBe("Bergen");
    // The demo region also shows the source, so the city is found through the input's description.
    const cityId = await postalCode.getAttribute("aria-describedby");
    await page.locator(`[id="${cityId ?? ""}"]`).click();
    await expect.poll(() => postalCode.evaluate((input) => input === document.activeElement)).toBe(true);

    const mobile = demo.getByRole("textbox", { name: "Mobile number", exact: true });
    await expect.poll(() => mobile.getAttribute("aria-invalid")).toBe("true");
    await expect.poll(() => demo.getByRole("alert").textContent()).toBe("Enter 8 digits.");
    await expect
      .poll(() => describedBy("Mobile number"))
      .toBe("We send the order confirmation here. Enter 8 digits.");

    await mobile.fill("41234567");
    await expect.poll(() => demo.getByRole("alert").count()).toBe(0);
    await expect.poll(() => mobile.getAttribute("aria-invalid")).toBe(null);
    await page.close();
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
