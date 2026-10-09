import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

describe("Form demos", () => {
  it("routes the server's errors to the text fields and the date picker, and clears the picker's on a new date", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "form", "Server errors");
    const picker = demo.getByRole("group", { name: "Start date", exact: true });
    // The demo's source panel holds the same copy, so the errors are found by their role.
    const alert = (text: string) => demo.getByRole("alert").filter({ hasText: text });
    const pickerError = alert("We cannot connect you before the first of next month.");

    await demo.getByRole("button", { name: "Sign up" }).click();
    await expect.poll(async () => pickerError.count()).toBe(1);
    const errorId = await pickerError.getAttribute("id");
    await expect.poll(async () => (await picker.getAttribute("aria-describedby"))?.split(" ")).toContain(errorId);
    await expect.poll(async () => alert("This address is already registered.").count()).toBe(1);

    await demo.getByRole("button", { name: /^calendar/i }).click();
    await page.getByRole("gridcell", { name: /July 20, 2026/ }).click();
    await expect.poll(async () => pickerError.count()).toBe(0);
    await expect.poll(async () => alert("This address is already registered.").count()).toBe(1);

    await page.close();
  });

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
