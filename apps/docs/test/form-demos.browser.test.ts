import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

describe("Form demos", () => {
  it("submits once the checkbox makes the untouched phone field valid", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "form", "Schema validation");
    const phone = demo.getByRole("textbox", { name: "Mobile number" });
    const save = demo.getByRole("button", { name: "Save" });
    const status = demo.getByRole("status");
    const message = demo.getByRole("alert");

    await save.click();
    await expect
      .poll(async () => message.textContent())
      .toBe("Enter eight digits, or tick that you have no mobile number.");
    await expect.poll(async () => phone.getAttribute("aria-invalid")).toBe("true");

    // The cross-field rule `Form` would block: the field holding the error never changes.
    await demo.getByRole("checkbox", { name: "I have no mobile number" }).click();
    await save.click();
    await expect.poll(async () => status.textContent()).toBe("Saved.");
    await expect.poll(async () => message.count()).toBe(0);
    await expect.poll(async () => phone.getAttribute("aria-invalid")).toBeNull();

    await page.close();
  });
});
