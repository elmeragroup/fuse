import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

describe("Field demos", () => {
  it("names the choice card's checkbox from the wrapping Field.Label", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "field", "Choice card");
    // The name proves the card contract: the control is named by the Field.Label that
    // wraps the nested Field.Root, not by copy of its own.
    const control = demo.getByRole("checkbox", {
      name: "Fixed price Lock the kilowatt-hour rate for twelve months.",
    });

    await control.waitFor();
    await expect.poll(async () => control.getAttribute("aria-checked")).toBe("false");

    await control.click();
    await expect.poll(async () => control.getAttribute("aria-checked")).toBe("true");

    await page.close();
  });

  it("toggles the error message from validation state outside the field", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "field", "Error message");
    const input = demo.getByRole("textbox", { name: "Email" });

    const message = demo.getByRole("alert");
    await expect.poll(async () => message.textContent()).toBe("Enter a work email.");

    await input.fill("ada@example.com");
    await expect.poll(async () => message.count()).toBe(0);

    await input.fill("ada");
    await expect.poll(async () => message.textContent()).toBe("Enter a work email.");

    await page.close();
  });

  it("groups the field set's library checkboxes under the legend", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "field", "Field set");
    const group = demo.getByRole("group", { name: "Notifications" });

    await group.waitFor();
    const email = group.getByRole("checkbox", { name: "Email" });
    const sms = group.getByRole("checkbox", { name: "SMS" });
    await expect.poll(async () => email.getAttribute("aria-checked")).toBe("true");
    await expect.poll(async () => sms.getAttribute("aria-checked")).toBe("false");

    await group.getByText("SMS").click();
    await expect.poll(async () => sms.getAttribute("aria-checked")).toBe("true");

    await page.close();
  });
});
