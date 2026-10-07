import { describe, expect, it } from "vitest";

import { launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

describe("Toast demos", () => {
  it("handles the expected promise failure without a page error", async () => {
    const page = await browser().newPage();
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
    // DOM audit: the demo-owned portal must appear exactly once, failure notification included.
    expect(await promise.locator('[data-slot="toast-viewport"]').count()).toBe(1);
    expect(errors).toEqual([]);
    await page.close();
  });

  it("keeps simultaneous Statuses and Action notifications in separate preview viewports", async () => {
    const page = await browser().newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const statuses = await openDemo(page, "toast", "Statuses");
    const action = page.getByRole("region", { name: "Action", exact: true });
    await action.waitFor();
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
    for (const demo of [statuses, action]) {
      // DOM audit: each preview must contain its own single portal viewport, including live notifications.
      expect(await demo.locator('[data-slot="toast-viewport"]').count()).toBe(1);
    }
    expect(errors).toEqual([]);
    await page.close();
  });

  it("keeps both placements inside the Placement preview and centers bottom-center in it", async () => {
    // At 720px the docs sidebar leaves the preview narrower than the 340px toast column.
    const page = await browser().newPage({ viewport: { width: 720, height: 900 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const placement = await openDemo(page, "toast", "Placement");
    const viewport = placement.locator('[data-slot="toast-viewport"]');
    await viewport.waitFor({ state: "attached" });

    // Each button sets its placement and raises a toast titled with the button's name.
    for (const title of ["Bottom right", "Bottom center"] as const) {
      await placement.getByRole("button", { name: title, exact: true }).click();
      await placement.getByRole("heading", { name: title, exact: true, includeHidden: true }).waitFor();
      // The viewport portals into the preview's own container.
      const insets = () =>
        viewport.evaluate((node, name) => {
          const container = node.parentElement;
          const toast = [...node.querySelectorAll('[data-slot="toast-root"]')].find(
            (root) => root.querySelector('[data-slot="toast-title"]')?.textContent === name
          );
          if (container === null || toast === undefined) {
            return null;
          }
          const outer = container.getBoundingClientRect();
          const inner = toast.getBoundingClientRect();
          return { left: inner.left - outer.left, right: outer.right - inner.right };
        }, title);
      await expect
        .poll(async () => {
          const box = await insets();
          return box !== null && box.left >= -1 && box.right >= -1;
        })
        .toBe(true);
      if (title === "Bottom center") {
        await expect
          .poll(async () => {
            const box = await insets();
            return box === null ? Number.POSITIVE_INFINITY : Math.abs(box.left - box.right);
          })
          .toBeLessThanOrEqual(1);
      }
    }
    expect(errors).toEqual([]);
    await page.close();
  });

  it("fires five stacked notifications and closes them all", async () => {
    const page = await browser().newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const stacking = await openDemo(page, "toast", "Stacking");
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
