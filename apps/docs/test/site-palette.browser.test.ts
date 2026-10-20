import type { BrowserContext, Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { INSTALL_COMMAND } from "../src/lib/docs-model";
import { focusedName, groupLabels, highlighted, isHighlighted } from "./command-page";
import { launchSuiteBrowser, waitForDocsShellHydration } from "./demo-page";
import { docsBaseUrl } from "./docs-server";
import { waitForLandingHydration } from "./landing-page";
import { canvas, isFocused, openStudio, toggle } from "./studio/page";
import { closeContext } from "./suite-browser";

const browser = launchSuiteBrowser();

/** The site palette's dialog. */
function palette(page: Page): Locator {
  return page.getByRole("dialog", { name: "Site search", exact: true });
}

/** The option named `name` in the group labelled `group`. */
function option(scope: Locator, group: string, name: string | RegExp): Locator {
  return scope.getByRole("group", { name: group, exact: true }).getByRole("option", { name });
}

/**
 * Opens a docs page and waits until the shell's passive effects have run, which is where the
 * palette listens for ⌘K. The shell hydration signal comes from a layout effect. The color-scheme
 * root subscribes to the device scheme in a passive effect of the same commit, and React runs one
 * commit's passive effects together, so once the document follows a scheme flip, the listener is
 * registered too. The page opens in light and ends in light.
 */
async function openDocs(context: BrowserContext, pathname: string): Promise<Page> {
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.goto(`${docsBaseUrl()}${pathname}`, { waitUntil: "domcontentloaded" });
  await waitForDocsShellHydration(page);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForFunction(
      (expected) => document.documentElement.getAttribute("data-theme") === expected,
      scheme
    );
  }
  return page;
}

async function newDocsContext(reducedMotion: "reduce" | "no-preference" = "reduce"): Promise<BrowserContext> {
  return browser().newContext({ colorScheme: "light", reducedMotion });
}

/**
 * Opens a docs page in a context that plays motion, with every animation slowed tenfold, so the
 * palette is still closing when the next key lands.
 */
async function openSlowDocs(pathname: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await newDocsContext("no-preference");
  const page = await openDocs(context, pathname);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.1 });
  return { context, page };
}

/** Closes the palette with `closeKey` and opens it with ⌘K while its exit animation runs. */
async function interruptClose(dialog: Locator, closeKey: "Escape" | "Meta+k"): Promise<void> {
  const page = dialog.page();
  const popup = await dialog.elementHandle();
  await page.keyboard.press(closeKey);
  await expect.poll(() => popup.getAttribute("data-ending-style")).toBe("");
  await page.keyboard.press("Meta+k");
  // The same popup: the opening kept it from its close.
  await expect.poll(() => popup.getAttribute("data-open")).toBe("");
  expect(await popup.evaluate((node) => node.isConnected)).toBe(true);
}

/**
 * Waits for the palette's fresh first page: focus in an empty search, the curated groups and the
 * first row highlighted.
 */
async function expectFreshFirstPage(dialog: Locator): Promise<void> {
  await expect.poll(() => focusedName(dialog.page())).toBe("Search the site");
  await expect.poll(() => dialog.getByRole("combobox").inputValue()).toBe("");
  await expect.poll(() => groupLabels(dialog)).toEqual(["This page", "Go to", "Settings", "Copy"]);
  await expect.poll(() => isHighlighted(dialog.getByRole("option").first())).toBe(true);
}

describe("site palette on the docs", () => {
  it("toggles on ⌘K and Ctrl+K, opens from the header button and hands focus back", async () => {
    const context = await newDocsContext();
    const page = await openDocs(context, "/components/button");
    const dialog = palette(page);

    await page.keyboard.press("Meta+k");
    await expect.poll(() => focusedName(page)).toBe("Search the site");
    await page.keyboard.press("Meta+k");
    await expect.poll(() => dialog.count()).toBe(0);

    await page.keyboard.press("Control+k");
    await expect.poll(() => focusedName(page)).toBe("Search the site");
    await page.keyboard.press("Control+k");
    await expect.poll(() => dialog.count()).toBe(0);

    const trigger = page.getByRole("banner").getByRole("button", { name: "Search", exact: true });
    expect(await trigger.getAttribute("aria-keyshortcuts")).toBe("Meta+K Control+K");
    await trigger.click();
    await expect.poll(() => focusedName(page)).toBe("Search the site");
    await page.keyboard.press("Escape");
    await expect.poll(() => dialog.count()).toBe(0);
    await expect.poll(() => isFocused(trigger)).toBe(true);
    await closeContext(context);
  });

  it("shows the curated groups, then ranks pages as the user types and opens the first", async () => {
    const context = await newDocsContext();
    const page = await openDocs(context, "/components/button");
    const dialog = palette(page);
    await page.keyboard.press("Meta+k");
    await expect.poll(() => groupLabels(dialog)).toEqual(["This page", "Go to", "Settings", "Copy"]);

    await page.keyboard.type("theme mat");
    await expect.poll(() => groupLabels(dialog)).toEqual(["Pages"]);
    await expect.poll(() => highlighted(dialog)).toMatch(/^Theme matrix/u);
    await page.keyboard.press("Enter");
    await page.waitForURL(`${docsBaseUrl()}/handbook/theme-matrix`);
    expect(await dialog.count()).toBe(0);
    await closeContext(context);
  });

  it("deep-links a demo hit to its anchor on the component's page", async () => {
    const context = await newDocsContext();
    const page = await openDocs(context, "/handbook/theming");
    const dialog = palette(page);
    await page.keyboard.press("Meta+k");
    await page.keyboard.type("hidden until found accordion");
    await option(dialog, "Demos", /^Hidden until found/u).click();
    await page.waitForURL(`${docsBaseUrl()}/components/accordion#hidden-until-found`);
    const demo = page.getByRole("region", { name: "Hidden until found", exact: true });
    await expect.poll(() => demo.evaluate((node) => node.getBoundingClientRect().top)).toBeLessThan(400);
    await closeContext(context);
  });

  it("lists the component page's sections under This page and jumps to one", async () => {
    const context = await newDocsContext();
    const page = await openDocs(context, "/components/dialog");
    const dialog = palette(page);
    await page.keyboard.press("Meta+k");
    const thisPage = dialog.getByRole("group", { name: "This page", exact: true });
    await expect.poll(() => thisPage.getByRole("option", { name: "API reference" }).count()).toBe(1);
    await expect.poll(() => thisPage.getByRole("option", { name: "Tokens consumed" }).count()).toBe(1);

    await page.keyboard.type("api reference");
    await expect.poll(() => groupLabels(dialog)).toContain("This page");
    await expect.poll(() => highlighted(dialog)).toBe("API reference");
    await page.keyboard.press("Enter");
    await page.waitForURL(`${docsBaseUrl()}/components/dialog#api-reference`);
    const heading = page.locator("#api-reference");
    await expect.poll(() => heading.evaluate((node) => node.getBoundingClientRect().top)).toBeLessThan(400);
    await closeContext(context);
  });

  it("drills into Appearance, marks the scheme in force and applies a pick", async () => {
    const context = await newDocsContext();
    const page = await openDocs(context, "/components/button");
    const dialog = palette(page);
    const tokens = page.getByRole("link", { name: "Tokens", exact: true });
    await tokens.focus();

    await page.keyboard.press("Meta+k");
    await option(dialog, "Settings", "Appearance").click();
    await expect.poll(() => focusedName(page)).toBe("Appearance");
    // A fresh context follows the device, so System is the scheme in force.
    const current = dialog.locator('[role="option"][aria-current="true"]');
    await expect.poll(() => current.allTextContents()).toEqual(["System"]);

    await page.keyboard.type("dark");
    await expect.poll(() => highlighted(dialog)).toBe("Dark");
    await page.keyboard.press("Enter");
    await expect.poll(() => dialog.count()).toBe(0);
    await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
    await expect.poll(() => isFocused(tokens)).toBe(true);

    await page.keyboard.press("Meta+k");
    await dialog.getByRole("option", { name: "Appearance" }).click();
    await expect.poll(() => current.allTextContents()).toEqual(["Dark"]);
    await closeContext(context);
  });

  it("disables the segments the preview brand does not serve", async () => {
    const context = await newDocsContext();
    const page = await openDocs(context, "/components/button");
    const dialog = palette(page);
    await page.keyboard.press("Meta+k");
    await dialog.getByRole("option", { name: "Brand" }).click();
    await dialog.getByRole("option", { name: "Fjordkraft Företag", exact: true }).click();
    await expect.poll(() => dialog.count()).toBe(0);

    await page.keyboard.press("Meta+k");
    await dialog.getByRole("option", { name: "Segment" }).click();
    const company = dialog.getByRole("option", { name: "Company", exact: true });
    const privateSegment = dialog.getByRole("option", { name: "Private", exact: true });
    await expect.poll(() => company.getAttribute("aria-current")).toBe("true");
    expect(await privateSegment.getAttribute("aria-disabled")).toBe("true");
    await closeContext(context);
  });

  it("goes back a page on Escape and on Backspace, and closes from the first page", async () => {
    const context = await newDocsContext();
    const page = await openDocs(context, "/components/button");
    const dialog = palette(page);
    await page.keyboard.press("Meta+k");
    await dialog.getByRole("option", { name: "Components" }).click();
    await expect.poll(() => focusedName(page)).toBe("Components");

    await page.keyboard.press("Escape");
    await expect.poll(() => focusedName(page)).toBe("Search the site");
    expect(await dialog.count()).toBe(1);

    await dialog.getByRole("option", { name: "Components" }).click();
    await expect.poll(() => focusedName(page)).toBe("Components");
    await page.keyboard.press("Backspace");
    await expect.poll(() => focusedName(page)).toBe("Search the site");

    await page.keyboard.press("Escape");
    await expect.poll(() => dialog.count()).toBe(0);
    await closeContext(context);
  });

  it("starts fresh when ⌘K reopens it before its exit animation ends", async () => {
    const { context, page } = await openSlowDocs("/components/button");
    const dialog = palette(page);
    const first = dialog.getByRole("option").first();

    await page.keyboard.press("Meta+k");
    await expect.poll(() => focusedName(page)).toBe("Search the site");
    await page.keyboard.type("theme");
    await expect.poll(() => groupLabels(dialog)).toContain("Pages");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => isHighlighted(first)).toBe(false);
    await interruptClose(dialog, "Escape");
    await expectFreshFirstPage(dialog);
    await closeContext(context);
  });

  // Guards the palette's own reset: `show()` sets the controlled stack back to the first page, also
  // on an opening that interrupts the close of a sub-page.
  it("reopens on the first page when ⌘K interrupts the close of a settings page", async () => {
    const { context, page } = await openSlowDocs("/components/button");
    const dialog = palette(page);
    const first = dialog.getByRole("option").first();

    await page.keyboard.press("Meta+k");
    await option(dialog, "Settings", "Appearance").click();
    await expect.poll(() => focusedName(page)).toBe("Appearance");
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => isHighlighted(first)).toBe(false);
    await interruptClose(dialog, "Meta+k");
    await expectFreshFirstPage(dialog);
    await closeContext(context);
  });

  // The drill-in case above resets through the palette's own `show()`, which puts the stack back
  // on the first page. This one stays on the first page with an empty query, so nothing the
  // palette controls changes, and only Command's own fresh start can move the highlight back.
  it("highlights the first row again when ⌘K reopens it mid-close after the arrows moved it", async () => {
    const { context, page } = await openSlowDocs("/components/button");
    const dialog = palette(page);
    const first = dialog.getByRole("option").first();

    await page.keyboard.press("Meta+k");
    await expect.poll(() => focusedName(page)).toBe("Search the site");
    await expect.poll(() => isHighlighted(first)).toBe(true);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => isHighlighted(first)).toBe(false);
    await interruptClose(dialog, "Meta+k");
    await expectFreshFirstPage(dialog);
    await closeContext(context);
  });

  it("opens a component from the Components page", async () => {
    const context = await newDocsContext();
    const page = await openDocs(context, "/handbook/theming");
    const dialog = palette(page);
    await page.keyboard.press("Meta+k");
    await dialog.getByRole("option", { name: "Components" }).click();
    await page.keyboard.type("tool");
    await dialog.getByRole("option", { name: "Toolbar", exact: true }).click();
    await page.waitForURL(`${docsBaseUrl()}/components/toolbar`);
    await closeContext(context);
  });

  it("copies the install command and says so in a toast", async () => {
    const context = await browser().newContext({
      colorScheme: "light",
      reducedMotion: "reduce",
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await openDocs(context, "/components/button");
    await page.keyboard.press("Meta+k");
    await option(palette(page), "Copy", "Copy install command").click();
    await page.getByText("Copied install command", { exact: true }).waitFor();
    expect(await page.evaluate(async () => navigator.clipboard.readText())).toBe(INSTALL_COMMAND);
    await closeContext(context);
  });
});

describe("site palette on the landing", () => {
  async function openLanding(context: BrowserContext): Promise<Page> {
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    // The brand marks feed the shaders, which this suite never looks at.
    await page.route("**/landing/marks/**", async (route) => route.abort());
    await page.goto(`${docsBaseUrl()}/`, { waitUntil: "load" });
    await waitForLandingHydration(page);
    return page;
  }

  it("toggles on Ctrl+K and ⌘K, opens from the nav and moves the landing's theme", async () => {
    const context = await browser().newContext({
      viewport: { width: 1280, height: 800 },
      colorScheme: "light",
      reducedMotion: "reduce",
    });
    const page = await openLanding(context);
    const dialog = palette(page);

    await page.keyboard.press("Control+k");
    await expect.poll(() => focusedName(page)).toBe("Search the site");
    await page.keyboard.press("Meta+k");
    await expect.poll(() => dialog.count()).toBe(0);

    await page.getByRole("banner").getByRole("button", { name: "Search", exact: true }).click();
    await expect
      .poll(() =>
        dialog.getByRole("group", { name: "Settings", exact: true }).getByRole("option").allTextContents()
      )
      .toEqual(["Appearance", "Landing theme"]);
    await dialog.getByRole("option", { name: "Landing theme" }).click();
    await expect
      .poll(() => dialog.locator('[role="option"][aria-current="true"]').allTextContents())
      .toEqual(["Elmera · Private · External"]);
    // The page matches every word of the query, in any order.
    await page.keyboard.type("internal telinet");
    await expect.poll(() => highlighted(dialog)).toBe("Telinet · Private · Internal");
    await page.keyboard.press("Enter");
    await expect.poll(() => dialog.count()).toBe(0);
    await page.waitForFunction(
      () =>
        document.documentElement.getAttribute("data-theme-brand") === "fkse" &&
        document.documentElement.getAttribute("data-theme-segment") === "private" &&
        document.documentElement.getAttribute("data-theme-variant") === "internal"
    );
    await closeContext(context);
  });
});

describe("site palette in the studio", () => {
  it.each(["reduce", "no-preference"] as const)(
    "toggles on ⌘K and runs a registered tool command (motion: %s)",
    async (reducedMotion) => {
      const { context, page } = await openStudio(browser(), { reducedMotion });
      const dialog = palette(page);

      await page.keyboard.press("Meta+k");
      await expect.poll(() => focusedName(page)).toBe("Search the site");
      const thisPage = dialog.getByRole("group", { name: "This page", exact: true });
      const hand = thisPage.getByRole("option", { name: /^Hand tool/u });
      expect(await hand.getAttribute("aria-keyshortcuts")).toBe("H");
      expect(await thisPage.getByRole("option", { name: /^Undo/u }).getAttribute("aria-disabled")).toBe(
        "true"
      );
      await page.keyboard.press("Control+k");
      await expect.poll(() => dialog.count()).toBe(0);

      await page.getByRole("banner").getByRole("button", { name: "Search", exact: true }).click();
      // Keys reach the query only once the palette has focused its input; a loaded runner moves
      // focus there after the click returns.
      await expect.poll(() => focusedName(page)).toBe("Search the site");
      await page.keyboard.type("hand");
      await expect.poll(() => highlighted(dialog)).toMatch(/^Hand tool/u);
      await page.keyboard.press("Enter");
      await expect.poll(() => dialog.count()).toBe(0);
      await expect.poll(() => toggle(canvas(page), "Tool", "Hand").getAttribute("aria-pressed")).toBe("true");
      await closeContext(context);
    }
  );
});
