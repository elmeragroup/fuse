import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

/**
 * Every demo on the page, the trigger that opens it, and the group/items it must
 * expose. `DropdownMenu.Label` only works inside a `Group`/`RadioGroup` (Base UI's
 * `GroupLabel` throws without group context), so each demo that has a label must open
 * into a named group — a top-level label aborts the popup render.
 */
const demos = [
  { title: "Basic", trigger: "Open", group: "Account", firstItem: "Profile" },
  { title: "Checkboxes", trigger: "View", group: "Editor", firstItem: "Show toolbar" },
  { title: "Radio group", trigger: "Panel", group: "Visible panel", firstItem: "Status bar" },
  { title: "Submenu", trigger: "Open", group: null, firstItem: "New tab" },
  { title: "Links", trigger: "Navigate", group: "Pages", firstItem: "Profile" },
  { title: "Destructive", trigger: "Open", group: "Account", firstItem: "Profile" },
] as const;

describe("DropdownMenu demos", () => {
  it.each(demos)("opens the $title demo's menu", async ({ title, trigger, group, firstItem }) => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "dropdown-menu", title);

    await demo.getByRole("button", { name: trigger, exact: true }).click();
    const menu = demo.getByRole("menu");
    await expect.poll(async () => menu.count()).toBe(1);
    if (group !== null) {
      await expect.poll(async () => demo.getByRole("group", { name: group, exact: true }).count()).toBe(1);
    }
    await expect.poll(async () => menu.getByText(firstItem).count()).toBe(1);

    await page.keyboard.press("Escape");
    await expect.poll(async () => menu.count()).toBe(0);
    await page.close();
  });
});
