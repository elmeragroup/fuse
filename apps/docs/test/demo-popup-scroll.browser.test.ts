import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, sharedDemo } from "./demo-page";
import { docsBaseUrl } from "./docs-server";
import { settleFrames } from "./landing-page";

const browser = launchSuiteBrowser();

/** Opens a demo by its anchor, as a reader following an on-page link does, once it has hydrated. */
async function openAnchoredDemo(page: Page, slug: string, id: string, name: string): Promise<Locator> {
  await page.goto(`${docsBaseUrl()}/components/${slug}#${id}`, { waitUntil: "load" });
  return sharedDemo(page, name);
}

/** Frames to wait, so a scroll an opening popup schedules has happened. */
const SETTLE_FRAMES = 10;

describe("opening a popup in a demo", () => {
  // Each opens its list the way a reader does: a click for the Combobox and Select, typing for
  // the Autocomplete, which suggests only once there is text.
  it.each([
    ["combobox-field", "form", "In a form", "Grid operator", ""],
    ["select-field", "form", "In a form", "Plan", ""],
    ["autocomplete-field", "basic", "Suggestions", "Municipality", "O"],
  ] as const)("leaves the page where it is on /components/%s#%s", async (slug, id, name, label, typed) => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openAnchoredDemo(page, slug, id, name);
    await settleFrames(page, SETTLE_FRAMES);
    const before = await page.evaluate(() => window.scrollY);
    const field = demo.getByRole("combobox", { name: label });
    await field.click();
    if (typed !== "") {
      await field.pressSequentially(typed);
    }
    await page.getByRole("listbox").waitFor();
    await settleFrames(page, SETTLE_FRAMES);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    await page.close();
  });
});
