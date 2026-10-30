import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

/** The demo file the frame page's "With a table" demo renders, read from disk as the oracle. */
const WITH_TABLE_SOURCE = readFileSync(
  fileURLToPath(new URL("../src/app/(docs)/components/frame/demos/frame-with-table.tsx", import.meta.url)),
  "utf8"
);

describe("demo frame", () => {
  it("names the demo in its header and opens on the Demo view, switched from the footer", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "frame", "With a table");
    // The header holds the heading alone: no control sits beside it.
    const heading = demo.getByRole("heading", { level: 2, name: "With a table" });
    await heading.waitFor();
    expect(await heading.locator("xpath=ancestor::header[1]").getByRole("button").count()).toBe(0);
    const tabs = demo.getByRole("tablist", { name: "With a table view" });
    expect(await tabs.getByRole("tab", { name: "Demo" }).getAttribute("aria-selected")).toBe("true");
    // The tabs sit below the views.
    const panel = demo.getByRole("tabpanel");
    const tabsBox = await tabs.boundingBox();
    const panelBox = await panel.boundingBox();
    expect(tabsBox?.y).toBeGreaterThan((panelBox?.y ?? 0) + (panelBox?.height ?? 0) - 1);
    // The code's actions show with the Code view only.
    expect(await demo.getByRole("button", { name: "Open code" }).isVisible()).toBe(false);
    expect(await demo.getByRole("button", { name: "Copy code" }).isVisible()).toBe(false);
    await tabs.getByRole("tab", { name: "Code" }).click();
    await expect.poll(() => demo.getByRole("button", { name: "Open code" }).isVisible()).toBe(true);
    expect(await demo.getByRole("button", { name: "Copy code" }).isVisible()).toBe(true);
    await page.close();
  });

  it("keeps the panel's height when switching to Code, from a 256px floor", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    // A short demo, which the floor lifts, and a tall one, whose source is longer than the demo.
    for (const [slug, title] of [
      ["button", "Variants"],
      ["frame", "With a table"],
    ] as const) {
      const demo = await openDemo(page, slug, title);
      const panel = demo.locator("[data-slot=frame-panel]").first();
      const tabs = demo.getByRole("tablist", { name: `${title} view` });
      const stage = await demo.locator("[data-demo-stage]").boundingBox();
      expect(stage?.height).toBeGreaterThanOrEqual(256);
      const demoBox = await panel.boundingBox();
      // The footer's offset from the panel's top, which the click's scroll into view leaves alone.
      const tabsOffset = ((await tabs.boundingBox())?.y ?? 0) - (demoBox?.y ?? 0);
      await tabs.getByRole("tab", { name: "Code" }).click();
      await demo.getByRole("button", { name: "Open code" }).waitFor();
      const codeBox = await panel.boundingBox();
      expect(Math.abs((codeBox?.height ?? 0) - (demoBox?.height ?? 0))).toBeLessThan(0.5);
      expect(Math.abs(((await tabs.boundingBox())?.y ?? 0) - (codeBox?.y ?? 0) - tabsOffset)).toBeLessThan(
        0.5
      );
    }
    await page.close();
  });

  it("scrolls long code lines sideways inside the Code view on a phone", async () => {
    const page = await browser().newPage({ viewport: { width: 390, height: 844 } });
    const demo = await openDemo(page, "button", "Variants");
    await demo.getByRole("tab", { name: "Code" }).click();
    const code = demo.locator("[data-demo-source] pre");
    await code.waitFor();
    // The variants line is wider than a phone, so the code block overflows its own box and scrolls
    // it sideways, while the page itself stays as wide as the viewport.
    const box = await code.evaluate((node) => {
      const before = node.scrollLeft;
      node.scrollLeft = 40;
      return {
        overflowX: getComputedStyle(node).overflowX,
        overflow: node.scrollWidth - node.clientWidth,
        scrolled: node.scrollLeft - before,
      };
    });
    expect(box.overflowX).toBe("auto");
    expect(box.overflow).toBeGreaterThan(0);
    expect(box.scrolled).toBe(40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.close();
  });

  it("copies the demo's source and says so", async () => {
    const context = await browser().newContext({
      viewport: DESKTOP_VIEWPORT,
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    const demo = await openDemo(page, "frame", "With a table");
    await demo.getByRole("tab", { name: "Code" }).click();
    await demo.getByRole("button", { name: "Copy code" }).click();
    await expect.poll(() => demo.getByRole("status").textContent()).toBe("Code copied to the clipboard");
    expect(await demo.getByRole("button", { name: "Copied" }).count()).toBe(1);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(WITH_TABLE_SOURCE.trimEnd());
    await context.close();
  });

  it("opens the source in a Sheet, inside a Frame headed with the file name", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "frame", "With a table");
    await demo.getByRole("tab", { name: "Code" }).click();
    await demo.getByRole("button", { name: "Open code" }).click();
    const sheet = page.getByRole("dialog", { name: "With a table" });
    await sheet.waitFor();
    const fileName = sheet.getByText("frame-with-table.tsx", { exact: true });
    // DOM audit: the Frame chrome is unlabelled; its slots are the handle on the composition.
    expect(await fileName.evaluate((node) => node.closest("[data-slot=frame-panel-header]") !== null)).toBe(
      true
    );
    const code = sheet.locator("pre");
    expect(await code.evaluate((node) => node.closest("[data-slot=frame-panel]") !== null)).toBe(true);
    expect((await code.textContent())?.trim()).toBe(WITH_TABLE_SOURCE.trim());
    expect(await sheet.getByRole("button", { name: "Copy code" }).isVisible()).toBe(true);
    await page.close();
  });
});
