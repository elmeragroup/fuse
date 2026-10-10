import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { settleFrames } from "./landing-page";
import { artboard, canvas, inspector, openStudio } from "./studio-page";
import type { StudioRoute } from "./studio-page";
import { launchSuiteBrowser } from "./suite-browser";

const browser = launchSuiteBrowser();

const PHONE = { width: 390, height: 844 } as const;

const SELF_SERVICE = "Customer self-service";
const ADMIN = "Internal admin table";
const CHECKOUT = "Checkout form";
const SETTINGS = "Settings dialog";

const SCREENS_PAGE: StudioRoute = { path: "/studio/screens", artboard: SELF_SERVICE };

/** The admin table's first page of customers, each with a row menu, as the screen lists them. */
const CUSTOMERS = ["Nora Haugen", "Emil Larsen", "Sara Lund", "Jonas Berg", "Ida Moen", "Lukas Dahl"];

/** The admin table's second page, customers 7 to 12 of 24. */
const SECOND_PAGE = [
  "Maja Solberg",
  "Henrik Strand",
  "Ingrid Bakke",
  "Oskar Lie",
  "Thea Ruud",
  "Filip Nygaard",
];

type Popup = "listbox" | "menu" | "dialog" | "alertdialog";

/** Every menu, select and dialog trigger on the page, by its screen, name and the popup it opens. */
const TRIGGERS: readonly { board: string; name: string; popup: Popup }[] = [
  { board: ADMIN, name: "Status", popup: "listbox" },
  { board: ADMIN, name: "Add customer", popup: "dialog" },
  { board: ADMIN, name: "Toggle options", popup: "listbox" },
  ...CUSTOMERS.map((customer) => ({ board: ADMIN, name: `Actions for ${customer}`, popup: "menu" as const })),
  { board: CHECKOUT, name: "Select country", popup: "dialog" },
  { board: SETTINGS, name: "Settings", popup: "dialog" },
];

const RED = "rgb(255, 0, 0)";

function selection(page: Page): Locator {
  return inspector(page).getByRole("region", { name: "Selection", exact: true });
}

/** The Selection section's terms and values. */
function readout(page: Page): Promise<Record<string, string>> {
  // DOM audit: a description list's terms and details have no accessible pairing to query by.
  return selection(page)
    .locator("dl")
    .evaluate((list) =>
      Object.fromEntries(
        [...list.querySelectorAll("dt")].map((term) => [
          term.textContent.trim(),
          term.nextElementSibling?.textContent.trim() ?? "",
        ])
      )
    );
}

function outlineTag(page: Page): Locator {
  return canvas(page).locator("[data-part-outline]");
}

/** The settings dialog, which opens with the page. */
function settingsDialog(page: Page): Locator {
  return artboard(page, SETTINGS).getByRole("dialog", { name: "Workspace settings" });
}

/**
 * A locator's background as 8-bit sRGB channels. The browser converts the color itself, by
 * painting it, whatever notation it computed, so two colors in different notations compare.
 */
async function paintedBackground(locator: Locator): Promise<number[]> {
  return locator.evaluate((element) => {
    const context = document.createElement("canvas").getContext("2d");
    if (context === null) {
      throw new Error("No 2D canvas context");
    }
    context.fillStyle = getComputedStyle(element).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  });
}

/** A custom property as `locator`'s element computes it, painted to 8-bit sRGB as above. */
async function paintedProperty(locator: Locator, property: `--${string}`): Promise<number[]> {
  return locator.evaluate((element, name) => {
    const context = document.createElement("canvas").getContext("2d");
    if (context === null) {
      throw new Error("No 2D canvas context");
    }
    context.fillStyle = getComputedStyle(element).getPropertyValue(name);
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  }, property);
}

/** A studio share hash for a document, as the share codec writes it. */
function hashOf(json: string): string {
  return `#1.${Buffer.from(json, "utf8").toString("base64url")}`;
}

/** The swatch on a Selection row's color knob. */
function selectionSwatch(page: Page, name: string): Locator {
  // DOM audit: the swatch is presentational and has no role or name.
  return selection(page)
    .getByRole("button", { name: `Edit --${name}`, exact: true })
    .locator("[aria-hidden]")
    .first();
}

/** The outline's box on screen. */
async function outlineBox(page: Page): Promise<{ x: number; y: number }> {
  const box = await outlineTag(page).locator("div").first().boundingBox();
  if (box === null) {
    throw new Error("The part outline has no box");
  }
  return { x: box.x, y: box.y };
}

/**
 * Counts `getBoundingClientRect` calls on HTML elements from now on. The wrapper sits on
 * `HTMLElement.prototype` and calls through to `Element.prototype`'s own method.
 */
async function countLayoutReads(page: Page): Promise<() => Promise<number>> {
  await page.evaluate(() => {
    sessionStorage.setItem("layoutReads", "0");
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(this: HTMLElement) {
      sessionStorage.setItem("layoutReads", String(Number(sessionStorage.getItem("layoutReads")) + 1));
      return Element.prototype.getBoundingClientRect.call(this);
    };
  });
  return async () => page.evaluate(() => Number(sessionStorage.getItem("layoutReads")));
}

/**
 * Tracks animation frame requests from now on and returns the most requests one callback ever
 * had pending at once. Two pending requests for one callback mean two frame loops run it.
 */
async function countPendingFrames(page: Page): Promise<() => Promise<number>> {
  await page.evaluate(() => {
    sessionStorage.setItem("mostPendingFrames", "0");
    const pending = new Map<number, FrameRequestCallback>();
    const request = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      const id = request((time) => {
        pending.delete(id);
        callback(time);
      });
      pending.set(id, callback);
      const same = [...pending.values()].filter((queued) => queued === callback).length;
      const most = Math.max(same, Number(sessionStorage.getItem("mostPendingFrames")));
      sessionStorage.setItem("mostPendingFrames", String(most));
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      pending.delete(id);
      cancel(id);
    };
  });
  return async () => page.evaluate(() => Number(sessionStorage.getItem("mostPendingFrames")));
}

async function frames(page: Page, count: number): Promise<void> {
  for (let frame = 0; frame < count; frame++) {
    await settleFrames(page);
  }
}

/** The admin table's customer names, in row order. */
async function customerNames(page: Page): Promise<string[]> {
  const rows = artboard(page, ADMIN).getByRole("table").getByRole("row");
  // The first row is the header; the name is each body row's second cell.
  const names = await rows.evaluateAll((elements) =>
    elements.slice(1).map((row) => row.querySelectorAll("td")[1]?.textContent.trim() ?? "")
  );
  return names;
}

async function background(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor);
}

/** The trigger's popup, which portals into the trigger's own artboard. */
function popupOf(page: Page, board: string, popup: Popup, trigger: string): Locator {
  const scope = artboard(page, board);
  // The settings dialog is named by its title, not by the trigger.
  return trigger === "Settings"
    ? scope.getByRole(popup, { name: "Workspace settings" })
    : scope.getByRole(popup).first();
}

describe("the studio's Screens page", () => {
  it("opens every menu, select and dialog on its screens, and Escape closes each", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      // The settings dialog opens with the page; Cancel closes it.
      const settings = settingsDialog(page);
      await settings.waitFor({ state: "visible" });
      await settings.getByRole("button", { name: "Cancel", exact: true }).click();
      await settings.waitFor({ state: "hidden" });

      for (const { board, name, popup } of TRIGGERS) {
        await artboard(page, board)
          .getByRole("button", { name, exact: true })
          .or(artboard(page, board).getByRole("combobox", { name, exact: true }))
          .click();
        const opened = popupOf(page, board, popup, name);
        await opened.waitFor({ state: "visible" });
        await page.keyboard.press("Escape");
        await opened.waitFor({ state: "hidden" });
      }

      // The destructive action behind the settings dialog's Danger zone asks first.
      await artboard(page, SETTINGS).getByRole("button", { name: "Settings", exact: true }).click();
      await settings.getByRole("tab", { name: "Danger zone" }).click();
      await settings.getByRole("button", { name: "Delete workspace", exact: true }).click();
      const confirm = artboard(page, SETTINGS).getByRole("alertdialog");
      await confirm.waitFor({ state: "visible" });
      expect(await confirm.getByRole("heading").textContent()).toBe("Delete the Operations workspace?");
      await page.keyboard.press("Escape");
      await confirm.waitFor({ state: "hidden" });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("deletes the workspace from its confirmation, closing both dialogs with a toast", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      const settings = settingsDialog(page);
      await settings.getByRole("tab", { name: "Danger zone" }).click();
      await settings.getByRole("button", { name: "Delete workspace", exact: true }).click();
      const confirm = artboard(page, SETTINGS).getByRole("alertdialog");
      await confirm.getByRole("button", { name: "Delete workspace", exact: true }).click();
      await confirm.waitFor({ state: "hidden" });
      await settings.waitFor({ state: "hidden" });
      await artboard(page, SETTINGS)
        .getByText("The Operations workspace was deleted.", { exact: true })
        .first()
        .waitFor({ state: "visible" });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("changes the plan to the picked one with a toast, and lists every invoice on See all", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      const screen = artboard(page, SELF_SERVICE);
      const change = screen.getByRole("button", { name: "Change plan", exact: true });
      // DOM audit: the Current mark sits in the plan's item, beside its radio, not inside it.
      const planItem = (title: string) =>
        screen.locator('[data-slot="radio-item"]').filter({ hasText: title });
      await screen.getByRole("radio", { name: /^Fixed price/u }).click();
      await change.click();
      await screen
        .getByText("Your plan changes to Fixed price on 1 November.", { exact: true })
        .first()
        .waitFor({ state: "visible" });
      // The Current mark moves to the plan now on the account.
      expect(await planItem("Fixed price").textContent()).toContain("Current");
      expect(await planItem("Spot price").textContent()).not.toContain("Current");
      await change.click();
      await screen
        .getByText("Fixed price is already your plan.", { exact: true })
        .first()
        .waitFor({ state: "visible" });

      const invoices = screen.getByRole("table");
      expect(await invoices.getByRole("row").count()).toBe(4);
      await screen.getByRole("button", { name: "See all", exact: true }).click();
      expect(await invoices.getByRole("row").count()).toBe(7);
      await screen.getByRole("button", { name: "Show fewer", exact: true }).click();
      expect(await invoices.getByRole("row").count()).toBe(4);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("makes a screen's notifications an F6 stop while they hold a toast", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      const screen = artboard(page, SELF_SERVICE);
      await screen.getByRole("radio", { name: /^Fixed price/u }).click();
      await screen.getByRole("button", { name: "Change plan", exact: true }).click();
      const toast = screen
        .getByText("Your plan changes to Fixed price on 1 November.", { exact: true })
        .first();
      await toast.waitFor({ state: "visible" });
      // The pointer resting on the toast holds it open while the keys run.
      await toast.hover();
      // The screen's notifications are the cycle's last stop, so Shift+F6 from the top bar wraps
      // to them.
      await page.getByRole("banner").focus();
      await page.keyboard.press("Shift+F6");
      const notifications = screen.getByRole("region", { name: "Notifications", exact: true });
      await expect
        .poll(async () => notifications.evaluate((region) => region === document.activeElement))
        .toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("runs every customer row command: profile, pausing, closing and adding a customer", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      const screen = artboard(page, ADMIN);
      const row = screen.getByRole("row").filter({ hasText: "Nora Haugen" });
      const command = async (name: string) => {
        await screen.getByRole("button", { name: "Actions for Nora Haugen", exact: true }).click();
        await screen.getByRole("menuitem", { name, exact: true }).click();
      };

      await command("Open profile");
      const profile = screen.getByRole("dialog", { name: "Nora Haugen" });
      await profile.waitFor({ state: "visible" });
      expect(await profile.textContent()).toContain("40213");
      expect(await profile.textContent()).toContain("NOK 1 240");
      await profile.getByRole("button", { name: "Close", exact: true }).first().click();
      await profile.waitFor({ state: "hidden" });

      await command("Pause deliveries");
      await row.getByText("Paused", { exact: true }).waitFor();
      await command("Resume deliveries");
      await row.getByText("Active", { exact: true }).waitFor();
      await command("Close account");
      await row.getByText("Closed", { exact: true }).waitFor();
      await screen.getByRole("button", { name: "Actions for Nora Haugen", exact: true }).click();
      expect(
        await screen
          .getByRole("menuitem", { name: "Pause deliveries", exact: true })
          .getAttribute("aria-disabled")
      ).toBe("true");
      await screen.getByRole("menuitem", { name: "Reopen account", exact: true }).click();
      await row.getByText("Active", { exact: true }).waitFor();

      await screen.getByRole("button", { name: "Add customer", exact: true }).click();
      const add = screen.getByRole("dialog", { name: "Add customer" });
      await add.getByRole("textbox", { name: "Name", exact: true }).fill("Kari Nordmann");
      await add.getByRole("button", { name: "Add customer", exact: true }).click();
      await add.waitFor({ state: "hidden" });
      await screen.getByRole("row").filter({ hasText: "Kari Nordmann" }).waitFor();
      expect(await screen.getByText(/ customers$/u).textContent()).toBe("1 selected · 25 customers");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("selects a Button's part on Alt+click and lists the tokens it reads, with their knobs", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      const button = artboard(page, SELF_SERVICE).getByRole("button", { name: "Change plan", exact: true });
      await button.click({ modifiers: ["Alt"] });

      await selection(page).waitFor({ state: "visible" });
      const facts = await readout(page);
      expect(facts.Slot).toBe("button");
      expect(facts.Component).toBe("button");
      // PART_DENSITY files Button under the control role (packages/fuse density-roles.ts).
      expect(facts["Density role"]).toBe("control");
      expect(facts.Size).toMatch(/^\d+(\.\d)? × \d+(\.\d)? px$/u);
      // Button's recipe paints the default variant with bg-primary.
      expect(await selection(page).getByRole("group", { name: "--primary", exact: true }).isVisible()).toBe(
        true
      );
      expect(await outlineTag(page).textContent()).toBe("button");
      // The part's artboard is selected with it.
      expect(await inspector(page).getByRole("region", { name: "Artboard" }).isVisible()).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("picks a part without using it: Alt+click on a select trigger leaves its list closed", async () => {
    const { context, page } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      const trigger = artboard(page, ADMIN).getByRole("combobox", { name: "Status", exact: true });
      await trigger.click({ modifiers: ["Alt"] });
      // The press lands on the trigger's value text, the nearest element with a slot.
      await expect.poll(async () => (await readout(page)).Slot).toBe("select-value");
      expect(await artboard(page, ADMIN).getByRole("listbox").count()).toBe(0);

      // A plain click still uses it.
      await trigger.click();
      await artboard(page, ADMIN).getByRole("listbox").waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
    } finally {
      await context.close();
    }
  });

  it("recolors the selected Button from the --primary knob in the Selection section", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      const button = artboard(page, SELF_SERVICE).getByRole("button", { name: "Change plan", exact: true });
      expect(await background(button)).not.toBe(RED);
      await button.click({ modifiers: ["Alt"] });

      await selection(page)
        .getByRole("group", { name: "--primary", exact: true })
        .getByRole("button", { name: "Edit --primary", exact: true })
        .click();
      const field = page.getByRole("textbox", { name: "Color", exact: true });
      await field.fill("#ff0000");
      await page.keyboard.press("Escape");
      await field.waitFor({ state: "hidden" });

      await expect.poll(() => background(button)).toBe(RED);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("clears the selected part with Escape while the Settings dialog stays open", async () => {
    const { context, page } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      await settingsDialog(page).waitFor({ state: "visible" });
      await artboard(page, SELF_SERVICE)
        .getByRole("button", { name: "Change plan", exact: true })
        .click({ modifiers: ["Alt"] });
      await selection(page).waitFor({ state: "visible" });

      await page.keyboard.press("Escape");
      await selection(page).waitFor({ state: "hidden" });
      expect(await outlineTag(page).count()).toBe(0);
      expect(await inspector(page).getByRole("region", { name: "Base theme" }).isVisible()).toBe(true);
      // Escape from another artboard is not the dialog's to take.
      expect(await settingsDialog(page).isVisible()).toBe(true);
    } finally {
      await context.close();
    }
  });

  it("closes the Settings dialog with Escape from inside it", async () => {
    const { context, page } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      const settings = settingsDialog(page);
      await settings.getByRole("tab", { name: "Notifications", exact: true }).click();
      await page.keyboard.press("Escape");
      await settings.waitFor({ state: "hidden" });
    } finally {
      await context.close();
    }
  });

  it("clears a part picked in Select part mode from the toolbar with Escape", async () => {
    const { context, page } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      await page.getByRole("button", { name: "Select part", exact: true }).click();
      await artboard(page, CHECKOUT).getByRole("button", { name: "Confirm order", exact: true }).click();
      await expect.poll(async () => (await readout(page)).Slot).toBe("button");

      await page.keyboard.press("Escape");
      await selection(page).waitFor({ state: "hidden" });
      expect(await outlineTag(page).count()).toBe(0);
    } finally {
      await context.close();
    }
  });

  it("picks a focused control with Enter or Space in Select part mode, without using it", async () => {
    const { context, page } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      await page.keyboard.press("p");
      const status = artboard(page, ADMIN).getByRole("combobox", { name: "Status", exact: true });
      await status.focus();
      await page.keyboard.press("Enter");
      await expect.poll(async () => (await readout(page)).Slot).toBe("select-trigger");
      expect(await artboard(page, ADMIN).getByRole("listbox").count()).toBe(0);

      const check = artboard(page, ADMIN).getByRole("checkbox", { name: "Select Nora Haugen", exact: true });
      await check.focus();
      await page.keyboard.press("Space");
      await expect.poll(async () => (await readout(page)).Slot).toBe("checkbox");
      expect(await check.getAttribute("aria-checked")).toBe("false");
    } finally {
      await context.close();
    }
  });

  it("refuses a Selection edit that loops through the base theme, not only the part's variant", async () => {
    // The opening base is external elma, which declares button-outline: var(--foreground).
    // Internal themes declare button-outline: var(--border), so the internal admin table alone
    // would admit the alias, yet the edit applies to every Light artboard.
    const { context, page, errors } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      await artboard(page, ADMIN)
        .getByRole("button", { name: "Add customer", exact: true })
        .click({ modifiers: ["Alt"] });
      await selection(page)
        .getByRole("group", { name: "--foreground", exact: true })
        .getByRole("button", { name: "Edit --foreground", exact: true })
        .click();
      const field = page.getByRole("textbox", { name: "Color", exact: true });
      await field.fill("var(--button-outline)");
      await expect.poll(() => field.getAttribute("aria-invalid")).toBe("true");
      await page.getByText("Links --foreground back to itself", { exact: true }).waitFor();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("describes a part in its artboard's scheme, whichever scheme the inspector edits", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      const button = artboard(page, SELF_SERVICE).getByRole("button", { name: "Change plan", exact: true });
      await button.click({ modifiers: ["Alt"] });
      await expect.poll(async () => (await readout(page)).Scheme).toBe("Light");
      const painted = await paintedBackground(button);
      await expect.poll(() => paintedBackground(selectionSwatch(page, "primary"))).toEqual(painted);

      await inspector(page)
        .getByRole("group", { name: "Edited scheme", exact: true })
        .getByRole("button", { name: "Dark", exact: true })
        .click();
      expect((await readout(page)).Scheme).toBe("Light");
      await frames(page, 2);
      expect(await paintedBackground(selectionSwatch(page, "primary"))).toEqual(painted);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("shows on a pinned part the declaration its artboard wears after a source token's edit", async () => {
    // External elma restates button-outline: var(--foreground) beside a --foreground edit;
    // the internal admin table wears its own variant's button-outline: var(--border) instead.
    const { context, page, errors } = await openStudio(browser(), {
      route: SCREENS_PAGE,
      hash: hashOf('{"t":"external-elma-private","l":{"foreground":"#ff0000"}}'),
    });
    try {
      const board = artboard(page, ADMIN);
      await board.getByRole("button", { name: "Add customer", exact: true }).click({ modifiers: ["Alt"] });
      const row = selection(page).getByRole("group", { name: "--button-outline", exact: true });
      await row
        .getByRole("button", {
          name: "Detach --button-outline from --border to a literal value",
          exact: true,
        })
        .waitFor();
      const worn = await paintedProperty(board, "--button-outline");
      expect(worn).not.toEqual([255, 0, 0]);
      await expect.poll(() => paintedBackground(selectionSwatch(page, "button-outline"))).toEqual(worn);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("offers one retry when a pinned variant's values fail, and the Selection rows fill after it", async () => {
    let failing = true;
    const { context, page, errors } = await openStudio(browser(), {
      route: SCREENS_PAGE,
      // The opening base is external elma, so the internal screens pin the one other seed.
      prepare: async (opening) => {
        await opening.route("**/_next/static/chunks/**", async (route) => {
          const response = await route.fetch();
          const body = await response.text();
          if (failing && /slug"?:"internal-elma-private"/u.test(body)) {
            await route.abort();
            return;
          }
          await route.fulfill({ response, body });
        });
      },
    });
    try {
      // The toast's title, and the live region's copy of it.
      await page.getByText("The theme's values could not load", { exact: true }).first().waitFor();
      await artboard(page, ADMIN)
        .getByRole("button", { name: "Add customer", exact: true })
        .click({ modifiers: ["Alt"] });
      await expect.poll(async () => (await readout(page)).Slot).toBe("button");
      const primary = selection(page).getByRole("group", { name: "--primary", exact: true });
      expect(await primary.count()).toBe(0);

      failing = false;
      // The notifications are F6's last stop, so Shift+F6 from the top bar wraps to them, which
      // expands them for assistive technology too.
      await page.getByRole("banner").focus();
      await page.keyboard.press("Shift+F6");
      const retry = page
        .getByRole("region", { name: "Notifications", exact: true })
        .getByRole("button", { name: "Retry", exact: true });
      expect(await retry.count()).toBe(1);
      await retry.click();
      await primary.waitFor({ state: "visible" });
      // The aborted chunk request logs a console error; nothing else may.
      expect(errors.filter((error) => !error.includes("Failed to load resource"))).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("describes a part in its artboard's pinned variant", async () => {
    const { context, page } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      // Self-service pins the external variant and the admin table the internal one, so one of
      // the two differs from the base theme whichever variant it is.
      const external = artboard(page, SELF_SERVICE).getByRole("button", { name: "Change plan", exact: true });
      const internal = artboard(page, ADMIN).getByRole("button", { name: "Add customer", exact: true });
      expect(await paintedBackground(external)).not.toEqual(await paintedBackground(internal));

      for (const button of [external, internal]) {
        await button.click({ modifiers: ["Alt"] });
        await expect.poll(async () => (await readout(page)).Slot).toBe("button");
        const painted = await paintedBackground(button);
        await expect.poll(() => paintedBackground(selectionSwatch(page, "primary"))).toEqual(painted);
      }
    } finally {
      await context.close();
    }
  });

  it("reads no layout while a picked part sits idle, and its outline follows a pan", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      await artboard(page, SELF_SERVICE)
        .getByRole("button", { name: "Change plan", exact: true })
        .click({ modifiers: ["Alt"] });
      await selection(page).waitFor({ state: "visible" });
      await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
      await frames(page, 2);
      const reads = await countLayoutReads(page);
      await frames(page, 30);
      expect(await reads()).toBe(0);

      const before = await outlineBox(page);
      const box = await canvas(page).boundingBox();
      if (box === null) {
        throw new Error("The canvas has no box");
      }
      await page.mouse.move(box.x + 20, box.y + box.height - 120);
      await page.mouse.wheel(0, 80);
      await expect.poll(async () => (await outlineBox(page)).y).toBeCloseTo(before.y - 80, 0);
      expect((await outlineBox(page)).x).toBeCloseTo(before.x, 0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("keeps one outline frame pending while its part moves during a camera glide", async () => {
    const { context, page, errors } = await openStudio(browser(), {
      route: SCREENS_PAGE,
      reducedMotion: "no-preference",
    });
    try {
      const button = artboard(page, SELF_SERVICE).getByRole("button", { name: "Change plan", exact: true });
      await button.click({ modifiers: ["Alt"] });
      await selection(page).waitFor({ state: "visible" });
      const mostPending = await countPendingFrames(page);

      // The part slides inside its artboard while the camera glides to frame that artboard.
      await button.evaluate((element) => {
        element.style.transition = "translate 600ms linear";
        element.getBoundingClientRect();
        element.style.translate = "0 40px";
      });
      await page.keyboard.press("Shift+Digit2");
      expect(await canvas(page).getAttribute("data-gliding")).toBe("true");
      await expect.poll(() => canvas(page).getAttribute("data-gliding")).toBe("false");
      await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
      await frames(page, 2);

      const part = await button.boundingBox();
      if (part === null) {
        throw new Error("The picked part has no box");
      }
      const outline = await outlineBox(page);
      expect(outline.x).toBeCloseTo(part.x, 0);
      expect(outline.y).toBeCloseTo(part.y, 0);
      expect(await mostPending()).toBe(1);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("settles the metrics of a part picked while its transition already runs", async () => {
    const { context, page, errors } = await openStudio(browser(), {
      route: SCREENS_PAGE,
      reducedMotion: "no-preference",
    });
    try {
      const button = artboard(page, SELF_SERVICE).getByRole("button", { name: "Change plan", exact: true });
      // A radius changes neither the part's size nor the artboard's DOM, so only the running
      // transition tells that the readout must follow.
      await button.evaluate((element) => {
        element.style.transition = "border-radius 800ms linear";
        element.getBoundingClientRect();
        element.style.borderRadius = "20px";
      });
      await button.click({ modifiers: ["Alt"] });
      await expect.poll(async () => (await readout(page)).Slot).toBe("button");
      // Still mid-transition: one per corner's longhand.
      expect(await button.evaluate((element) => element.getAnimations().length)).toBeGreaterThan(0);

      await expect.poll(() => button.evaluate((element) => element.getAnimations().length)).toBe(0);
      await frames(page, 2);
      expect((await readout(page)).Radius).toBe("20 px");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("drops a picked part when its element leaves the page", async () => {
    const { context, page } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      const settings = settingsDialog(page);
      await settings.getByRole("button", { name: "Save changes", exact: true }).click({ modifiers: ["Alt"] });
      await expect.poll(async () => (await readout(page)).Slot).toBe("button");

      await settings.getByRole("button", { name: "Cancel", exact: true }).click();
      await settings.waitFor({ state: "hidden" });
      await selection(page).waitFor({ state: "hidden" });
      expect(await outlineTag(page).count()).toBe(0);
    } finally {
      await context.close();
    }
  });

  it("keeps the Settings draft across tabs, saves it with a toast and discards it on Cancel", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      const screen = artboard(page, SETTINGS);
      const settings = settingsDialog(page);
      const name = settings.getByRole("textbox", { name: "Workspace name", exact: true });
      await name.fill("Field team");
      const news = () => settings.getByRole("switch", { name: "Product news", exact: true });
      await settings.getByRole("tab", { name: "Notifications", exact: true }).click();
      await news().click();
      await settings.getByRole("tab", { name: "General", exact: true }).click();
      expect(await name.inputValue()).toBe("Field team");
      await settings.getByRole("tab", { name: "Notifications", exact: true }).click();
      expect(await news().getAttribute("aria-checked")).toBe("true");

      await settings.getByRole("button", { name: "Save changes", exact: true }).click();
      await settings.waitFor({ state: "hidden" });
      await screen.getByText("Settings saved", { exact: true }).waitFor({ state: "visible" });
      const title = screen.getByRole("heading", { level: 2, name: /workspace$/u });
      expect(await title.textContent()).toBe("Field team workspace");

      await screen.getByRole("button", { name: "Settings", exact: true }).click();
      await name.fill("Scratch");
      await settings.getByRole("button", { name: "Cancel", exact: true }).click();
      await settings.waitFor({ state: "hidden" });
      expect(await title.textContent()).toBe("Field team workspace");
      await screen.getByRole("button", { name: "Settings", exact: true }).click();
      expect(await name.inputValue()).toBe("Field team");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("filters and pages the admin table's 24 customers, keeping the selection", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      const screen = artboard(page, ADMIN);
      const count = screen.getByText(/selected/u);
      expect(await customerNames(page)).toEqual(CUSTOMERS);
      expect(await count.textContent()).toBe("1 selected · 24 customers");

      // Selecting on one page survives a visit to another.
      await screen.getByRole("checkbox", { name: "Select Sara Lund", exact: true }).click();
      await screen.getByRole("link", { name: "2", exact: true }).click();
      expect(await customerNames(page)).toEqual(SECOND_PAGE);
      await screen.getByRole("link", { name: "Previous", exact: false }).click();
      expect(
        await screen
          .getByRole("checkbox", { name: "Select Sara Lund", exact: true })
          .getAttribute("aria-checked")
      ).toBe("true");
      expect(await count.textContent()).toBe("2 selected · 24 customers");

      const search = screen.getByRole("textbox", { name: "Search customers", exact: true });
      await search.fill("lund");
      expect(await customerNames(page)).toEqual(["Sara Lund", "Hanna Lunde"]);
      expect(await count.textContent()).toBe("2 selected · 2 of 24 customers");
      await search.fill("4025");
      expect(await customerNames(page)).toEqual(["Emma Vik", "Mathias Eide", "Sofie Holm", "Kristian Aas"]);
      await search.fill("");

      await screen.getByRole("combobox", { name: "Status", exact: true }).click();
      await screen.getByRole("option", { name: "Paused", exact: true }).click();
      expect(await customerNames(page)).toEqual(["Emil Larsen", "Ingrid Bakke", "Sofie Holm", "Ella Myhre"]);

      await screen.getByRole("combobox", { name: "Status", exact: true }).click();
      await screen.getByRole("option", { name: "All statuses", exact: true }).click();
      await screen.getByRole("combobox", { name: "Region", exact: true }).fill("West");
      await screen.getByRole("option", { name: "West", exact: true }).click();
      expect(await customerNames(page)).toEqual([
        "Nora Haugen",
        "Lukas Dahl",
        "Ingrid Bakke",
        "Mathias Eide",
        "Julie Moe",
        "Martin Sæther",
      ]);
      expect(await count.textContent()).toBe("2 selected · 6 of 24 customers");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("submits the checkout through its Form, showing errors until the fields are valid", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      const screen = artboard(page, CHECKOUT);
      const confirm = screen.getByRole("button", { name: "Confirm order", exact: true });
      const confirmed = screen.getByRole("alert").filter({ hasText: "Order confirmed" });

      // The email starts invalid, and its error blocks the submit.
      await confirm.click();
      await screen.getByText("Enter an email address like name@example.com.").waitFor({ state: "visible" });
      expect(await confirmed.count()).toBe(0);

      await screen.getByRole("textbox", { name: "Email", exact: true }).fill("nora.haugen@example.com");
      const first = screen.getByRole("textbox", { name: "First name", exact: true });
      await first.fill("");
      await confirm.click();
      expect(await first.getAttribute("aria-invalid")).toBe("true");
      expect(await confirmed.count()).toBe(0);

      await first.fill("Nora");
      await confirm.click();
      await confirmed.waitFor({ state: "visible" });
      const summary = await confirmed.textContent();
      expect(summary).toContain("Nora Haugen");
      expect(summary).toContain("nora.haugen@example.com");
      expect(summary).toContain("NOK 39");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("blocks the checkout on a start date before 1 November 2026 and shows the date's error", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      const screen = artboard(page, CHECKOUT);
      const confirm = screen.getByRole("button", { name: "Confirm order", exact: true });
      const confirmed = screen.getByRole("alert").filter({ hasText: "Order confirmed" });
      const dateError = screen.getByText("Choose a start date from 1 November 2026 on.");
      await screen.getByRole("textbox", { name: "Email", exact: true }).fill("nora.haugen@example.com");

      // The en-US segments read month, day, year; one step down moves the start to October.
      const month = screen
        .getByRole("group", { name: "Start date", exact: true })
        .getByRole("spinbutton")
        .first();
      await month.focus();
      await page.keyboard.press("ArrowDown");
      await confirm.click();
      await dateError.waitFor({ state: "visible" });
      expect(await confirmed.count()).toBe(0);

      await month.focus();
      await page.keyboard.press("ArrowUp");
      await confirm.click();
      await confirmed.waitFor({ state: "visible" });
      expect(await confirmed.textContent()).toContain("1 November 2026");
      expect(await dateError.count()).toBe(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("blocks the checkout while the start date has an empty segment, and confirms once it is filled", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      const screen = artboard(page, CHECKOUT);
      const confirm = screen.getByRole("button", { name: "Confirm order", exact: true });
      const confirmed = screen.getByRole("alert").filter({ hasText: "Order confirmed" });
      const dateError = screen.getByText("Enter a complete start date.");
      await screen.getByRole("textbox", { name: "Email", exact: true }).fill("nora.haugen@example.com");

      // The en-US segments read month, day, year; Backspace empties the day's "01".
      const day = screen
        .getByRole("group", { name: "Start date", exact: true })
        .getByRole("spinbutton")
        .nth(1);
      await day.focus();
      await page.keyboard.press("Backspace");
      expect(await day.getAttribute("aria-valuetext")).toBe("Empty");
      await confirm.click();
      await dateError.waitFor({ state: "visible" });
      expect(await confirmed.count()).toBe(0);

      // Typing the day back gives the same date as before, which the field does not report.
      await day.focus();
      await page.keyboard.type("1");
      await confirm.click();
      await confirmed.waitFor({ state: "visible" });
      expect(await confirmed.textContent()).toContain("1 November 2026");
      expect(await dateError.count()).toBe(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("picks a part with a plain click in Select part mode, toggled with P", async () => {
    const { context, page } = await openStudio(browser(), { route: SCREENS_PAGE });
    try {
      await page.keyboard.press("p");
      expect(
        await page.getByRole("button", { name: "Select part", exact: true }).getAttribute("aria-pressed")
      ).toBe("true");
      await artboard(page, CHECKOUT).getByRole("button", { name: "Confirm order", exact: true }).click();
      await expect.poll(async () => (await readout(page)).Slot).toBe("button");
    } finally {
      await context.close();
    }
  });

  it("fits a phone without sideways page scroll", async () => {
    const { context, page } = await openStudio(browser(), { route: SCREENS_PAGE, viewport: PHONE });
    try {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally {
      await context.close();
    }
  });
});
