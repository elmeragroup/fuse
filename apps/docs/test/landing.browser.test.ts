import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT } from "./demo-page";
import { collectPageErrors, launchLandingSuite, TARGET_FLOOR_PX } from "./landing-page";

const { openLanding } = launchLandingSuite();

describe("landing page", () => {
  it("swaps the Components menu's stage as its entry links take hover or keyboard focus", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);

    await page.getByRole("button", { name: "Components", exact: true }).click();
    // DOM audit: the menu panel has no role, so it is found by its slot. The density demo in
    // the page has its own "Save reading" button, so the stage is looked up inside the panel.
    const panel = page.locator("[data-slot='navigation-menu-content']");
    const buttonStage = panel.getByRole("button", { name: "Save reading" });
    await buttonStage.waitFor();

    const entry = (name: string) => panel.getByRole("link", { name: new RegExp(`^${name}`, "u") });
    expect(await entry("Button").getAttribute("href")).toBe("/components/button");

    await entry("Button").focus();
    await page.keyboard.press("ArrowDown");
    await expect.poll(async () => panel.getByRole("switch", { name: "Price alerts" }).isVisible()).toBe(true);
    await expect.poll(async () => buttonStage.count()).toBe(0);

    await page.keyboard.press("Tab");
    await expect
      .poll(async () => panel.getByRole("meter", { name: "Monthly budget" }).isVisible())
      .toBe(true);

    await entry("Badge").hover();
    await expect.poll(async () => panel.getByText("Overdue", { exact: true }).isVisible()).toBe(true);
    await page.context().close();
  });

  it("gives every invoice row's button a target at least 24px tall", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    await page.getByRole("tab", { name: "Invoices" }).click();
    const invoices = page.getByRole("button", { name: /^\d{4}$/u });
    await expect.poll(async () => invoices.count()).toBeGreaterThan(0);

    // A press 1/4px inside each edge of a 24px band centred on the button must still land on it.
    const reach = TARGET_FLOOR_PX / 2 - 0.25;
    const misses = await invoices.evaluateAll(
      (buttons, offset) =>
        buttons.flatMap((button) => {
          // elementFromPoint only sees the viewport.
          button.scrollIntoView({ block: "center" });
          const rect = button.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          return [y - offset, y + offset].flatMap((probe) => {
            const hit = document.elementFromPoint(x, probe);
            return hit !== null && button.contains(hit)
              ? []
              : [`${button.textContent} at y=${String(probe)}`];
          });
        }),
      reach
    );
    expect(misses).toEqual([]);
    await page.context().close();
  });

  it("reports a refused clipboard write instead of raising an unhandled rejection", async () => {
    let errors: string[] = [];
    const page = await openLanding(DESKTOP_VIEWPORT, {
      prepare: async (target) => {
        errors = collectPageErrors(target);
        await target.addInitScript(() => {
          navigator.clipboard.writeText = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
        });
      },
    });

    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await page.getByRole("region", { name: "Notifications" }).getByText("Could not copy").waitFor();
    expect(await page.getByRole("button", { name: "Copy", exact: true }).isVisible()).toBe(true);
    expect(errors).toEqual([]);
    await page.context().close();
  });

  it("confirms a copy, then restores the Copy label", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, {
      prepare: async (target) => {
        await target.context().grantPermissions(["clipboard-read", "clipboard-write"]);
        await target.clock.install();
      },
    });
    // A paused clock keeps "Copied" up until the test moves time on, however busy the page is.
    await page.clock.pauseAt(Date.now() + 1000);

    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await page.getByRole("button", { name: "Copied", exact: true }).waitFor();
    // landing-install.tsx shows "Copied" for 1600ms.
    await page.clock.runFor(1600);
    await page.getByRole("button", { name: "Copy", exact: true }).waitFor();
    expect(await page.evaluate(async () => navigator.clipboard.readText())).toBe(
      "pnpm add @elmeragroup/fuse"
    );
    await page.context().close();
  });
});
