import { describe, expect, it } from "vitest";

import { expectInside, launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

describe("DateRangePicker demos", () => {
  // The library suite owns the field-box containment contract at a 240px container
  // (date-range-picker.browser.test.tsx); the docs check is that each real demo stage
  // still holds its field boxes at the narrowest preview width.
  for (const name of ["Basic", "Controlled", "Validation", "States"]) {
    it(`keeps the ${name} demo's field box inside its stage at 320px`, async () => {
      const page = await browser().newPage({ viewport: { width: 320, height: 844 } });
      const demo = await openDemo(page, "date-range-picker", name);
      // DOM audit: the stage and field boxes have no landmark role of their own.
      const stage = demo.locator("[data-demo-stage]");
      for (const group of await demo.locator('[data-slot="field-group"]').all()) {
        await expectInside(group, stage);
        for (const control of await group.getByRole("spinbutton").all()) await expectInside(control, group);
        await expectInside(group.getByRole("button"), group);
      }
      await page.close();
    });
  }

  it("opens the dialog demo's range picker, dismisses the calendar and then the dialog", async () => {
    const page = await browser().newPage({ viewport: { width: 320, height: 844 } });
    const demo = await openDemo(page, "date-range-picker", "Inside a dialog");
    const modalTrigger = demo.getByRole("button", { name: "Edit order", exact: true });
    await expectInside(modalTrigger, demo.locator("[data-demo-stage]"));
    await modalTrigger.click();
    const modal = page.getByRole("dialog", { name: "Edit order", exact: true });
    const modalGroup = modal.locator('[data-slot="field-group"]');
    await expectInside(modalGroup, modal);
    for (const segment of await modalGroup.getByRole("spinbutton").all())
      await expectInside(segment, modalGroup);
    const calendarTrigger = modalGroup.getByRole("button");
    await expectInside(calendarTrigger, modalGroup);
    await calendarTrigger.click();
    const calendar = page.getByRole("dialog", { name: "Calendar Delivery window", exact: true });
    await calendar.waitFor();
    await page.keyboard.press("Escape");
    await expect.poll(() => calendar.count()).toBe(0);
    expect(await modal.isVisible()).toBe(true);
    await page.keyboard.press("Escape");
    await expect.poll(() => modal.count()).toBe(0);
    await page.close();
  });
});
