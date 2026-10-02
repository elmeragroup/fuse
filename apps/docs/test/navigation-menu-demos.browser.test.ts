import type { Locator } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

async function box(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const measured = await locator.boundingBox();
  if (measured === null) {
    throw new Error("expected a rendered element");
  }
  return measured;
}

describe("NavigationMenu demos", () => {
  it("opens the nested demo's submenu in a second popup beside its trigger", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "navigation-menu", "Nested submenus");

    await demo.getByRole("button", { name: "Home", exact: true }).click();
    const submenuTrigger = page.getByRole("button", { name: /^Electric car/u });
    await submenuTrigger.click();
    const charger = page.getByRole("link", { name: /^Home charger/u });
    await charger.waitFor();

    const triggerBox = await box(submenuTrigger);
    expect((await box(charger)).x).toBeGreaterThanOrEqual(triggerBox.x + triggerBox.width);
    await expect.poll(async () => page.getByRole("link", { name: /^Spot price/u }).isVisible()).toBe(true);
    await page.close();
  });

  it("opens the inline demo at its default audience and swaps the panel for another", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "navigation-menu", "Nested inline submenus");

    await demo.getByRole("button", { name: "Electricity", exact: true }).click();
    await page.getByRole("link", { name: /^Spot price/u }).waitFor();

    await page.getByRole("button", { name: /^Businesses/u }).click();
    await page.getByRole("link", { name: /^Power contracts/u }).waitFor();
    await expect.poll(async () => page.getByRole("link", { name: /^Spot price/u }).count()).toBe(0);
    await page.close();
  });

  it("stacks the inline demo's panel below its audience list on a phone", async () => {
    const page = await browser().newPage({ viewport: { width: 390, height: 844 } });
    const demo = await openDemo(page, "navigation-menu", "Nested inline submenus");

    await demo.getByRole("button", { name: "Electricity", exact: true }).click();
    const spot = page.getByRole("link", { name: /^Spot price/u });
    await spot.waitFor();

    const lastAudience = await box(page.getByRole("button", { name: /^Businesses/u }));
    const spotBox = await box(spot);
    expect(spotBox.y).toBeGreaterThanOrEqual(lastAudience.y + lastAudience.height);
    expect(spotBox.x).toBeGreaterThanOrEqual(0);
    expect(spotBox.x + spotBox.width).toBeLessThanOrEqual(390);
    await page.close();
  });
});
