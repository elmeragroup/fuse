import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

/** The text of the option Base UI marks highlighted inside `scope`. */
function highlighted(scope: Locator): Promise<string | null> {
  return scope.locator('[role="option"][data-highlighted]').first().textContent();
}

/** The text of the demo's result line, which reports the last command run. */
function status(demo: Locator): Promise<string | null> {
  return demo
    .getByRole("status")
    .filter({ hasText: /^(?:Ran|Changed|Opened|No)\b/u })
    .textContent();
}

async function focusedName(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null);
}

/** The labels of the groups the palette lists inside `scope`, in order. */
function groupLabels(scope: Locator): Promise<string[]> {
  return scope.locator('[data-slot="command-label"]').allTextContents();
}

describe("Command demos", () => {
  it("runs a command from the palette in a dialog and closes it", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "command", "Palette in a dialog");
    await demo.getByRole("button", { name: "Open command palette", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Command palette", exact: true });
    await expect.poll(() => focusedName(page)).toBe("Search commands");
    await page.keyboard.type("invoices");
    await expect.poll(() => highlighted(dialog)).toBe("Open invoices");
    await page.keyboard.press("Enter");
    await expect.poll(() => dialog.count()).toBe(0);
    await expect.poll(() => status(demo)).toBe("Ran: Open invoices");
    await page.close();
  });

  it("runs a grouped action from its row and from its shortcut", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "command", "Groups with shortcuts");
    await expect.poll(() => demo.getByRole("group", { name: "Go to", exact: true }).count()).toBe(1);
    await demo.getByRole("option", { name: "Invoices", exact: true }).click();
    await expect.poll(() => status(demo)).toBe("Ran: Invoices");
    await demo.getByRole("combobox", { name: "Search actions", exact: true }).focus();
    await page.keyboard.press("Alt+KeyR");
    await expect.poll(() => status(demo)).toBe("Ran: Register meter reading");
    await page.close();
  });

  it("reaches every page level and goes back with Backspace", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "command", "Pages with Back");
    await demo.getByRole("combobox", { name: "Commands", exact: true }).focus();
    await expect.poll(() => highlighted(demo)).toBe("Customers");
    await page.keyboard.press("Enter");
    await expect.poll(() => focusedName(page)).toBe("Customers");
    await page.keyboard.type("grace");
    await expect.poll(() => highlighted(demo)).toBe("Grace Hopper");
    await page.keyboard.press("Enter");
    await expect.poll(() => focusedName(page)).toBe("Grace Hopper");
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => highlighted(demo)).toBe("Register meter reading");
    await page.keyboard.press("Enter");
    await expect.poll(() => status(demo)).toBe("Ran: Register meter reading: Grace Hopper");
    await page.keyboard.press("Backspace");
    await expect.poll(() => focusedName(page)).toBe("Customers");
    await expect.poll(() => demo.getByRole("combobox").inputValue()).toBe("");
    await page.keyboard.press("Backspace");
    await expect.poll(() => focusedName(page)).toBe("Commands");
    await page.close();
  });

  it("keeps the customer search when going back from a customer", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "command", "Keep the parent's query");
    await demo.getByRole("combobox", { name: "Customers", exact: true }).focus();
    await page.keyboard.type("hamilton");
    await expect.poll(() => highlighted(demo)).toContain("Margaret Hamilton");
    await page.keyboard.press("Enter");
    await expect.poll(() => focusedName(page)).toBe("Margaret Hamilton");
    await page.keyboard.press("Backspace");
    await expect.poll(() => focusedName(page)).toBe("Customers");
    await expect.poll(() => demo.getByRole("combobox").inputValue()).toBe("hamilton");
    await page.close();
  });

  it("goes back a page on Escape and closes from the first page", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "command", "Escape goes back a page");
    await demo.getByRole("button", { name: "Change settings", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Command palette", exact: true });
    await expect.poll(() => focusedName(page)).toBe("Settings");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect.poll(() => focusedName(page)).toBe("Theme");
    await page.keyboard.press("Escape");
    await expect.poll(() => focusedName(page)).toBe("Settings");
    await expect.poll(() => dialog.count()).toBe(1);
    await page.keyboard.press("Enter");
    await expect.poll(() => focusedName(page)).toBe("Language");
    await page.keyboard.press("Enter");
    await expect.poll(() => dialog.count()).toBe(0);
    await expect.poll(() => status(demo)).toBe("Changed Language: Norsk bokmål");
    await page.close();
  });

  it("lists the page's commands above the app's, from the header button and the shortcut", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "command", "One palette for the app");
    const dialog = page.getByRole("dialog", { name: "Command palette", exact: true });
    const opener = demo.getByRole("button", { name: "Search commands", exact: true });
    await opener.click();
    await expect.poll(() => focusedName(page)).toBe("Search commands");
    await expect.poll(() => groupLabels(dialog)).toEqual(["Customers", "Go to"]);
    await page.keyboard.type("grace");
    await expect.poll(() => highlighted(dialog)).toBe("Grace Hopper");
    await page.keyboard.press("Enter");
    await expect.poll(() => dialog.count()).toBe(0);
    await expect.poll(() => opener.evaluate((node) => node === document.activeElement)).toBe(true);
    await expect.poll(() => demo.getByRole("definition").first().textContent()).toBe("10232");

    await page.keyboard.press("ControlOrMeta+KeyK");
    await expect.poll(() => focusedName(page)).toBe("Search commands");
    await expect.poll(() => groupLabels(dialog)).toEqual(["Grace Hopper", "Go to"]);
    // The demo stops the shortcut's propagation, so the docs site's search stays closed.
    expect(await page.getByRole("dialog").count()).toBe(1);
    await page.keyboard.type("invoice");
    await expect.poll(() => highlighted(dialog)).toBe("Send invoice copy");
    await page.keyboard.press("Enter");
    await expect.poll(() => dialog.count()).toBe(0);
    await expect.poll(() => status(demo)).toBe("Ran: Send invoice copy: Grace Hopper");

    await page.keyboard.press("ControlOrMeta+KeyK");
    await expect.poll(() => focusedName(page)).toBe("Search commands");
    await page.keyboard.type("overview");
    await expect.poll(() => highlighted(dialog)).toBe("Overview");
    await page.keyboard.press("Enter");
    await expect.poll(() => dialog.count()).toBe(0);
    await page.keyboard.press("ControlOrMeta+KeyK");
    await expect.poll(() => focusedName(page)).toBe("Search commands");
    await expect.poll(() => groupLabels(dialog)).toEqual(["Go to"]);
    await page.keyboard.press("ControlOrMeta+KeyK");
    await expect.poll(() => dialog.count()).toBe(0);
    await page.close();
  });

  it("keeps the rows it showed while it closes onto another page", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, reducedMotion: "no-preference" });
    const demo = await openDemo(page, "command", "One palette for the app");
    // Slow every animation tenfold, so the popup is still closing when the test reads its rows.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Animation.enable");
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.1 });
    const dialog = page.getByRole("dialog", { name: "Command palette", exact: true });
    await demo.getByRole("button", { name: "Search commands", exact: true }).click();
    await expect.poll(() => focusedName(page)).toBe("Search commands");
    await expect.poll(() => highlighted(dialog)).toBe("Ada Lovelace");
    await expect.poll(() => groupLabels(dialog)).toEqual(["Customers", "Go to"]);
    const popup = await dialog.elementHandle();
    await page.keyboard.press("Enter");
    await expect.poll(() => popup.getAttribute("data-closed")).toBe("");
    // Ada's page is on screen and has passed her commands to the layout.
    await expect.poll(() => demo.getByRole("definition").first().textContent()).toBe("10231");
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        })
    );
    expect(await popup.evaluate((node) => node.isConnected)).toBe(true);
    expect(
      await popup.$$eval('[data-slot="command-label"]', (labels) => labels.map((label) => label.textContent))
    ).toEqual(["Customers", "Go to"]);
    await page.close();
  });

  it("wraps to the last of 2,000 meter points and opens it", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "command", "Long lists");
    await demo.getByRole("combobox", { name: "Search meter points", exact: true }).focus();
    await expect.poll(() => highlighted(demo)).toContain("Storgata 1");
    await expect.poll(() => demo.getByRole("option").count()).toBeLessThan(60);
    await page.keyboard.press("ArrowUp");
    await expect.poll(() => highlighted(demo)).toContain("Havnegata 200");
    await page.keyboard.press("Enter");
    await expect.poll(() => status(demo)).toBe("Opened Havnegata 200");
    await page.close();
  });
});
