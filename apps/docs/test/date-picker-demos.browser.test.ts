import { describe, expect, it } from "vitest";

import { expectInside, launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

describe("DatePicker demos", () => {
  it("fits presets horizontally at 320px and keeps keyboard selection and dismissal working", async () => {
    const page = await browser().newPage({ viewport: { width: 320, height: 740 } });
    const demo = await openDemo(page, "date-picker", "Presets");
    const trigger = demo.getByRole("button", { name: /Calendar/ });
    await trigger.click();
    const popup = page.getByRole("dialog", { name: "Calendar Delivery date", exact: true });
    await popup.waitFor();
    const bounds = await popup.boundingBox();
    if (!bounds) throw new Error("Expected calendar popup");
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    for (const day of await popup.getByRole("button").all()) await expectInside(day, popup);
    await popup.getByRole("radio", { name: "In a week" }).press("Space");
    await expect.poll(() => popup.getByRole("radio", { name: "In a week" }).isChecked()).toBe(true);
    await page.keyboard.press("Escape");
    await expect.poll(() => popup.count()).toBe(0);
    await expect.poll(() => trigger.evaluate((element) => element === document.activeElement)).toBe(true);
    await page.close();
  });

  for (const locale of ["en-US", "en-GB"]) {
    it(`hydrates date validation without browser-locale-dependent errors in ${locale}`, async () => {
      const page = await browser().newPage({ locale });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const demo = await openDemo(page, "date-picker", "Validation");
      await demo
        .locator("[data-demo-stage]")
        .getByText("Pick a date on or after 1 July 2026.", { exact: true })
        .waitFor();
      await demo.getByRole("spinbutton", { name: /month/ }).fill("07");
      await page.keyboard.press("Tab");
      await expect
        .poll(() =>
          demo
            .locator("[data-demo-stage]")
            .getByText("Pick a date on or after 1 July 2026.", { exact: true })
            .count()
        )
        .toBe(0);
      expect(errors).toEqual([]);
      await page.close();
    });
  }
});
