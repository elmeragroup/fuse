import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

describe("Button demos", () => {
  it("swaps the Save button's icon for the built-in spinner while pending", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "button", "Pending");
    const save = demo.getByRole("button", { name: "Save", exact: true });
    // DOM audit: the indicator is decorative, so the slot is its only handle; the button's
    // own icon is the one SVG that carries the inline-start marker.
    await expect.poll(async () => save.locator("[data-slot=button-pending-indicator]").count()).toBe(0);
    expect(
      await save.locator("svg[data-icon=inline-start]").evaluate((node) => getComputedStyle(node).display)
    ).not.toBe("none");

    await save.click();
    const saving = demo.getByRole("button", { name: "Saving", exact: true });
    await expect.poll(async () => saving.getAttribute("aria-busy")).toBe("true");
    await expect.poll(async () => saving.locator("[data-slot=button-pending-indicator]").count()).toBe(1);
    expect(
      await saving.locator("svg[data-icon=inline-start]").evaluate((node) => getComputedStyle(node).display)
    ).toBe("none");
    await page.close();
  });

  it("keeps the brand button's width and name while its own centred spinner shows", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "button", "Pending");
    const brand = demo.getByRole("button", { name: "Continue with Brand", exact: true });
    const resting = await brand.boundingBox();
    if (resting === null) {
      throw new Error("expected the brand button to be laid out");
    }
    const content = brand.locator("span").first();
    const overlay = brand.locator("svg.absolute");
    expect(await overlay.evaluate((node) => getComputedStyle(node).display)).toBe("none");

    await brand.click();
    // The documented recipe: the same button, still named, still the same box; the content
    // stays in flow and fades, the overlay spinner shows centred over it.
    await expect.poll(async () => brand.getAttribute("aria-busy")).toBe("true");
    const pending = await brand.boundingBox();
    expect(pending?.width).toBe(resting.width);
    expect(pending?.height).toBe(resting.height);
    expect(await content.evaluate((node) => getComputedStyle(node).opacity)).toBe("0");
    expect(await overlay.evaluate((node) => getComputedStyle(node).display)).toBe("block");
    const spinner = await overlay.boundingBox();
    if (spinner === null || pending === null) {
      throw new Error("expected the overlay spinner to be laid out");
    }
    expect(Math.abs(spinner.x + spinner.width / 2 - (pending.x + pending.width / 2))).toBeLessThan(0.5);
    expect(Math.abs(spinner.y + spinner.height / 2 - (pending.y + pending.height / 2))).toBeLessThan(0.5);
    // The viewBox-less wordmark keeps its intrinsic size under the fade.
    const wordmark = await brand.locator("span svg").first().boundingBox();
    expect(wordmark?.width).toBe(56);
    await expect.poll(async () => demo.getByRole("status").textContent()).toBe("Opening Brand…");
    await page.close();
  });
});
