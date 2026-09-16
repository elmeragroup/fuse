import { chromium } from "playwright";
import type { Browser, Locator, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { docsBaseUrl } from "./docs-server";

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
  await browser.close();
});

async function openDemo(page: Page, slug: string, name: string): Promise<Locator> {
  page.setDefaultTimeout(5000);
  await page.goto(`${docsBaseUrl()}/components/${slug}`, { waitUntil: "load" });
  const demo = page.getByRole("region", { name, exact: true });
  await demo.waitFor();
  return demo;
}

async function expectInside(element: Locator, container: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const outer = await container.boundingBox();
      const inner = await element.boundingBox();
      return (
        outer !== null &&
        inner !== null &&
        inner.x >= outer.x - 1 &&
        inner.x + inner.width <= outer.x + outer.width + 1
      );
    })
    .toBe(true);
}

describe("component cleanup regressions", () => {
  for (const width of [320, 390, 1113]) {
    it(`keeps card sections, date fields and pagination reachable at ${width}px`, async () => {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      const cardDemo = await openDemo(page, "card", "Horizontal");
      // DOM audit: Card's semantic slots identify the four layout sections whose bounds must not overlap.
      const card = cardDemo.locator('[data-slot="card"]');
      const parts = card.locator(":scope > *");
      const boxes = await parts.evaluateAll((elements) =>
        elements.map((element) => {
          const { left, right, top, bottom } = element.getBoundingClientRect();
          return { left, right, top, bottom };
        })
      );
      for (const part of await parts.all()) await expectInside(part, card);
      for (const [index, box] of boxes.entries()) {
        for (const other of boxes.slice(index + 1)) {
          expect(
            box.right <= other.left ||
              other.right <= box.left ||
              box.bottom <= other.top ||
              other.bottom <= box.top
          ).toBe(true);
        }
      }
      for (const name of ["Basic", "Controlled", "Validation", "States"]) {
        const demo = await openDemo(page, "date-range-picker", name);
        // DOM audit: the stage and field boxes have no landmark role of their own.
        const stage = demo.locator("[data-demo-stage]");
        for (const group of await demo.locator('[data-slot="field-group"]').all()) {
          await expectInside(group, stage);
          for (const control of await group.getByRole("spinbutton").all()) await expectInside(control, group);
          await expectInside(group.getByRole("button"), group);
        }
      }
      const modalDemo = await openDemo(page, "date-range-picker", "Inside a dialog");
      const modalTrigger = modalDemo.getByRole("button", { name: "Edit order", exact: true });
      await expectInside(modalTrigger, modalDemo.locator("[data-demo-stage]"));
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
      const pagination = await openDemo(page, "pagination", "Controlled");
      const navigation = pagination.getByRole("navigation");
      for (const link of await navigation.getByRole("link").all()) await expectInside(link, navigation);
      await navigation.getByRole("link", { name: "Go to next page" }).click();
      await expect
        .poll(() => navigation.getByRole("link", { name: "3", exact: true }).getAttribute("aria-current"))
        .toBe("page");
      const ellipsis = page.getByRole("region", { name: "Ellipsis", exact: true }).getByRole("navigation");
      for (const link of await ellipsis.getByRole("link").all()) await expectInside(link, ellipsis);
      await page.close();
    });
  }

  it("fits presets horizontally at 320px and keeps keyboard selection and dismissal working", async () => {
    const page = await browser.newPage({ viewport: { width: 320, height: 740 } });
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
      const page = await browser.newPage({ locale });
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

  it("opens long content at its title and restores focus on dismissal", async () => {
    const page = await browser.newPage();
    const demo = await openDemo(page, "dialog", "Scrolling content");
    const trigger = demo.getByRole("button", { name: "Open the full terms" });
    await trigger.click();
    const popup = page.getByRole("dialog", { name: "Full terms" });
    const heading = popup.getByRole("heading", { name: "Full terms" });
    await expect.poll(() => heading.evaluate((element) => element === document.activeElement)).toBe(true);
    await expect.poll(() => popup.evaluate((element) => element.scrollTop)).toBe(0);
    await page.keyboard.press("Tab");
    await expect.poll(() => popup.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect.poll(() => trigger.evaluate((element) => element === document.activeElement)).toBe(true);
    await page.close();
  });

  it("exposes a visible mobile-sidebar close button", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const demo = await openDemo(page, "sidebar", "Inset variant");
    const trigger = demo.getByRole("button", { name: "Toggle sidebar" });
    await trigger.click();
    const popup = page.getByRole("dialog", { name: "Sidebar" });
    const close = popup.getByRole("button", { name: "Close", exact: true });
    await close.waitFor();
    await expectInside(close, popup);
    await close.click();
    await expect.poll(() => popup.count()).toBe(0);
    await expect.poll(() => trigger.evaluate((element) => element === document.activeElement)).toBe(true);
    await page.close();
  });

  it("clears, copies, resets and locally sends the InputGroup examples", async () => {
    const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
    const page = await context.newPage();
    const demo = await openDemo(page, "input-group", "Button addons");
    await demo.getByRole("button", { name: "Copy", exact: true }).click();
    await expect.poll(() => demo.getByRole("status").textContent()).toBe("Meter number copied.");
    await demo.getByRole("button", { name: "Clear meter number" }).click();
    await expect.poll(() => demo.getByRole("textbox", { name: "Meter number" }).inputValue()).toBe("");
    await demo.getByRole("button", { name: "Reset example" }).click();
    await expect
      .poll(() => demo.getByRole("textbox", { name: "Meter number" }).inputValue())
      .toBe("707057500012345678");
    const message = page.getByRole("region", { name: "Textarea", exact: true });
    await message.getByRole("textbox", { name: "Message to support" }).fill("Sample meter issue");
    await message.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(() => message.getByRole("status").textContent()).toContain("Sample meter issue");
    await message.getByRole("button", { name: "Reset example" }).click();
    await expect.poll(() => message.getByRole("status").textContent()).toBe("");
    await context.close();
  });

  it("focuses the unavailable tooltip trigger without native-button or focus warnings", async () => {
    const page = await browser.newPage();
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "warning" || message.type() === "error") problems.push(message.text());
    });
    const demo = await openDemo(page, "focusable", "Tooltip trigger");
    const trigger = demo.getByRole("button", { name: "Closed meter" });
    await trigger.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect.poll(() => trigger.evaluate((element) => element === document.activeElement)).toBe(true);
    await page.getByRole("tooltip").waitFor();
    expect(await trigger.getAttribute("aria-disabled")).toBe("true");
    expect(problems).toEqual([]);
    await page.close();
  });

  it("submits the sheet through its footer button and resets the local receipt", async () => {
    const page = await browser.newPage();
    const demo = await openDemo(page, "sheet", "Form");
    await demo.getByRole("button", { name: "Report a reading" }).click();
    const dialog = page.getByRole("dialog", { name: "Report a reading" });
    await dialog.getByRole("textbox", { name: "Meter number" }).fill("707057500012345678");
    await dialog.getByRole("spinbutton", { name: "Reading" }).fill("12345");
    await dialog.getByRole("button", { name: "Send reading" }).click();
    await expect.poll(() => dialog.count()).toBe(0);
    await expect.poll(() => demo.getByRole("status").textContent()).toContain("Reading 12345 recorded");
    await demo.getByRole("button", { name: "Reset example" }).click();
    await expect.poll(() => demo.getByRole("status").textContent()).toBe("");
    await page.close();
  });

  it("keeps expected toast failures handled and simultaneous examples separate", async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const promise = await openDemo(page, "toast", "Promise");
    // The portal mounts after hydration; wait for the demo-owned notification surface before dispatching.
    await promise.locator('[data-slot="toast-viewport"]').waitFor({ state: "attached" });
    await promise.getByRole("button", { name: "Save (error)" }).click();
    // Base UI announces high-priority toasts through a live region and hides their visual root until focused.
    await promise
      .getByRole("heading", { name: "Could not save", exact: true, includeHidden: true })
      .waitFor();
    expect(errors).toEqual([]);
    const statuses = page.getByRole("region", { name: "Statuses", exact: true });
    const action = page.getByRole("region", { name: "Action", exact: true });
    await statuses.getByRole("button", { name: "Info", exact: true }).click();
    await action.getByRole("button", { name: "Delete invoice" }).click();
    await statuses.getByRole("heading", { name: "Syncing", exact: true, includeHidden: true }).waitFor();
    await action
      .getByRole("heading", { name: "Invoice deleted", exact: true, includeHidden: true })
      .waitFor();
    await action.getByRole("button", { name: "Undo" }).click();
    await action
      .getByRole("heading", { name: "Invoice restored", exact: true, includeHidden: true })
      .waitFor();
    for (const demo of [promise, statuses, action]) {
      // DOM audit: each preview must contain its own single portal viewport, including live notifications.
      expect(await demo.locator('[data-slot="toast-viewport"]').count()).toBe(1);
    }
    const stacking = page.getByRole("region", { name: "Stacking", exact: true });
    await stacking.getByRole("button", { name: "Fire five" }).click();
    await stacking.getByRole("heading", { name: "Draft stored", exact: true, includeHidden: true }).waitFor();
    await stacking.getByRole("button", { name: "Close all" }).click();
    await expect
      .poll(() =>
        stacking.getByRole("heading", { name: "Draft stored", exact: true, includeHidden: true }).count()
      )
      .toBe(0);
    expect(errors).toEqual([]);
    await page.close();
  });
});
