/**
 * Unit under test: the Carousel page's demos, hydrated by Next. Oracles: each demo's own data
 * (four offers, six months three to a view at the desktop width, the room names) and the APG
 * carousel pattern, under which the rotation control comes first in the carousel's tab order.
 */
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, shareDemoPage, sharedDemo } from "./demo-page";

const browser = launchSuiteBrowser();

/** The `aria-disabled` picker button, which marks the current page. */
const CURRENT = '[aria-disabled="true"]';

describe("Carousel demos", () => {
  const page = shareDemoPage(browser, "carousel", DESKTOP_VIEWPORT);

  it("pages the basic demo with Next and marks the indicator for the new page", async () => {
    const demo = await sharedDemo(page(), "Basic");
    const picker = demo.getByRole("group", { name: "Choose slide to display", exact: true });
    await expect.poll(() => picker.getByRole("button").count()).toBe(4);
    await expect.poll(() => picker.locator(CURRENT).getAttribute("aria-label")).toBe("Slide 1 of 4");
    await demo.getByRole("button", { name: "Next slide", exact: true }).click();
    await expect.poll(() => picker.locator(CURRENT).getAttribute("aria-label")).toBe("Slide 2 of 4");
    await expect
      .poll(() => demo.getByRole("group", { name: "2 of 4", exact: true }).getAttribute("inert"))
      .toBeNull();
  });

  it("makes one indicator per page when three months show at once", async () => {
    const demo = await sharedDemo(page(), "Several slides at once");
    const picker = demo.getByRole("group", { name: "Choose slide to display", exact: true });
    // Six slides three to a view stop at four positions.
    await expect
      .poll(() => picker.getByRole("button").evaluateAll((buttons) => buttons.map((b) => b.ariaLabel)))
      .toEqual(["Slide 1 of 6", "Slide 2 of 6", "Slide 3 of 6", "Slide 4 of 6"]);
  });

  it("picks a slide by its named thumbnail", async () => {
    const demo = await sharedDemo(page(), "Thumbnails");
    await demo.getByRole("button", { name: "Garage", exact: true }).click();
    await expect
      .poll(() => demo.getByRole("button", { name: "Garage", exact: true }).getAttribute("aria-disabled"))
      .toBe("true");
    await expect
      .poll(() => demo.getByRole("group", { name: "Garage", exact: true }).getAttribute("inert"))
      .toBeNull();
  });

  it("puts the rotation control first in the tab order and the row below the slides", async () => {
    const demo = await sharedDemo(page(), "Automatic rotation");
    const carousel = demo.getByRole("region", { name: "News", exact: true });
    const control = carousel.getByRole("button", { name: "Stop automatic slide show", exact: true });
    const first = await carousel.evaluate(
      (region) => region.querySelector<HTMLElement>("button, [tabindex='0']")?.ariaLabel ?? null
    );
    expect(first).toBe("Stop automatic slide show");
    const controlBox = await control.boundingBox();
    const slideBox = await carousel.getByRole("group", { name: "1 of 3", exact: true }).boundingBox();
    expect(controlBox !== null && slideBox !== null && controlBox.y > slideBox.y + slideBox.height).toBe(
      true
    );
  });

  it("scrolls the vertical demo down with Next", async () => {
    const demo = await sharedDemo(page(), "Vertical");
    const carousel = demo.getByRole("region", { name: "How to switch", exact: true });
    await demo.getByRole("button", { name: "Next slide", exact: true }).click();
    await expect
      .poll(() =>
        carousel.evaluate((region) => region.querySelector("[tabindex='0'][aria-live]")?.scrollTop ?? 0)
      )
      .toBeGreaterThan(0);
    await expect
      .poll(() => demo.getByRole("group", { name: "2 of 4", exact: true }).getAttribute("inert"))
      .toBeNull();
  });

  it("follows the parent's index and the custom plan picker", async () => {
    const demo = await sharedDemo(page(), "Controlled page");
    await expect.poll(() => demo.getByText("Selected: Plus", { exact: true }).count()).toBe(1);
    await demo.getByRole("button", { name: "Premium", exact: true }).click();
    await expect.poll(() => demo.getByText("Selected: Premium", { exact: true }).count()).toBe(1);
    await expect
      .poll(() => demo.getByRole("button", { name: "Premium", exact: true }).getAttribute("aria-pressed"))
      .toBe("true");
  });
});
