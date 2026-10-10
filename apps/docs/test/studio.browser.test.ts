import type { CDPSession, Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { BRANDS } from "@elmeragroup/fuse/theme";

import { docsBaseUrl } from "./docs-server";
import { auditTargets, settleFrames } from "./landing-page";
import {
  ARTBOARDS,
  artboard,
  canvas,
  inspector,
  layers,
  newStudioContext,
  openStudio as openStudioPage,
} from "./studio-page";
import type { StudioContextOptions, StudioPage } from "./studio-page";
import { launchSuiteBrowser } from "./suite-browser";

const browser = launchSuiteBrowser();

const PHONE = { width: 390, height: 844 } as const;

type Box = { x: number; y: number; width: number; height: number };

/** Opens `/studio` in a fresh context; each test closes its page, and the suite the rest. */
async function openStudio(options: StudioContextOptions & { hash?: string } = {}): Promise<StudioPage> {
  return openStudioPage(browser(), options);
}

async function box(locator: Locator): Promise<Box> {
  const measured = await locator.boundingBox();
  if (measured === null) {
    throw new Error("the element has no box");
  }
  return measured;
}

function inside(inner: Box, outer: Box): boolean {
  return (
    inner.x >= outer.x - 1 &&
    inner.y >= outer.y - 1 &&
    inner.x + inner.width <= outer.x + outer.width + 1 &&
    inner.y + inner.height <= outer.y + outer.height + 1
  );
}

/** Whether `inner` shows in `outer`: whole when it fits, else from its top-left corner. */
function shown(inner: Box, outer: Box): boolean {
  if (inner.width <= outer.width && inner.height <= outer.height) {
    return inside(inner, outer);
  }
  return inside({ x: inner.x, y: inner.y, width: 0, height: 0 }, outer);
}

async function computedPrimary(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).getPropertyValue("--primary").trim());
}

async function zoomLabel(page: Page): Promise<string> {
  return (
    (await canvas(page)
      .getByText(/^\d+%$/u)
      .textContent()) ?? ""
  );
}

type Finger = { id: number; x: number; y: number };

/**
 * Sends one CDP touch event. A start or a move lists every finger down and presses or moves
 * them; an end lists the fingers that lift.
 */
async function touch(cdp: CDPSession, type: "touchStart" | "touchMove" | "touchEnd", fingers: Finger[]) {
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: fingers });
}

/** Whether the focused element sits inside `locator`. */
async function holdsFocus(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => element.contains(document.activeElement));
}

/** Whether `locator` is the focused element itself. */
async function isFocused(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => element === document.activeElement);
}

describe("theme studio", () => {
  it("renders the chrome and the five artboards", async () => {
    const { page, errors } = await openStudio();
    expect(await page.getByRole("banner").getByText("Theme studio", { exact: true }).isVisible()).toBe(true);
    expect(await layers(page).isVisible()).toBe(true);
    expect(await inspector(page).getByRole("heading", { name: "Base theme" }).isVisible()).toBe(true);
    for (const name of ARTBOARDS) {
      expect(await artboard(page, name).isVisible(), name).toBe(true);
      expect(await layers(page).getByRole("button", { name, exact: true }).isVisible(), name).toBe(true);
    }
    // The toolbar's tools and zoom are real buttons with names.
    for (const name of ["Select", "Hand", "Zoom out", "Zoom in"]) {
      expect(await canvas(page).getByRole("button", { name, exact: true }).count(), name).toBe(1);
    }
    expect(errors).toEqual([]);
    await page.close();
  });

  it("frames every artboard inside the canvas on Shift+1", async () => {
    const { page } = await openStudio();
    const frame = await box(canvas(page));
    // Pan far away first, so the fit has work to do.
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
    await page.mouse.wheel(4000, 3000);
    await expect.poll(async () => inside(await box(artboard(page, ARTBOARDS[0])), frame)).toBe(false);

    await page.keyboard.press("Shift+Digit1");
    for (const name of ARTBOARDS) {
      await expect
        .poll(async () => inside(await box(artboard(page, name)), frame), { message: name })
        .toBe(true);
    }
    await page.close();
  });

  it("zooms around the cursor on ctrl + wheel, keeping the artboard edge under it", async () => {
    const { page } = await openStudio();
    const target = artboard(page, ARTBOARDS[0]);
    const before = await box(target);
    const cursor = { x: before.x, y: before.y + before.height / 2 };
    await page.mouse.move(cursor.x, cursor.y);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -40);
    await page.keyboard.up("Control");

    await expect.poll(async () => (await box(target)).width).toBeGreaterThan(before.width * 1.2);
    const after = await box(target);
    expect(Math.abs(after.x - cursor.x)).toBeLessThanOrEqual(1);
    await page.close();
  });

  it("pans with the Hand tool and with Space + drag", async () => {
    const { page } = await openStudio();
    const target = artboard(page, ARTBOARDS[0]);

    await canvas(page).getByRole("button", { name: "Hand", exact: true }).click();
    let start = await box(target);
    // Pressing on the artboard's content pans; the Hand tool keeps the press from its controls.
    await page.mouse.move(start.x + 40, start.y + 40);
    await page.mouse.down();
    await page.mouse.move(start.x + 140, start.y + 90, { steps: 4 });
    await page.mouse.up();
    let moved = await box(target);
    expect(Math.abs(moved.x - start.x - 100)).toBeLessThanOrEqual(1);
    expect(Math.abs(moved.y - start.y - 50)).toBeLessThanOrEqual(1);

    await page.keyboard.press("v");
    expect(
      await canvas(page).getByRole("button", { name: "Select", exact: true }).getAttribute("aria-pressed")
    ).toBe("true");
    start = moved;
    const frame = await box(canvas(page));
    // A press on the empty canvas moves focus off the toolbar, so Space holds the hand instead of
    // pressing the focused tool.
    await page.mouse.click(frame.x + 20, frame.y + 20);
    await page.mouse.move(frame.x + 20, frame.y + 20);
    await page.keyboard.down("Space");
    await page.mouse.down();
    await page.mouse.move(frame.x - 40, frame.y + 80, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    moved = await box(target);
    expect(Math.abs(moved.x - start.x + 60)).toBeLessThanOrEqual(1);
    expect(Math.abs(moved.y - start.y - 60)).toBeLessThanOrEqual(1);
    await page.close();
  });

  it("re-themes the artboards, not the chrome, when the brand changes", async () => {
    const { page } = await openStudio();
    const target = artboard(page, ARTBOARDS[0]);
    const chrome = page.getByRole("banner");
    const before = { board: await computedPrimary(target), chrome: await computedPrimary(chrome) };

    await page.getByRole("button", { name: /^Base theme/u }).click();
    await page.getByRole("menuitemradio", { name: BRANDS.fkas.displayName, exact: true }).click();
    await page.keyboard.press("Escape");

    await expect.poll(async () => computedPrimary(target)).not.toBe(before.board);
    expect(await computedPrimary(chrome)).toBe(before.chrome);
    expect(await inspector(page).getByText("external-fkas-private", { exact: true }).isVisible()).toBe(true);
    await page.close();
  });

  it("turns one artboard dark from the inspector while the document stays light", async () => {
    const { page } = await openStudio();
    const name = ARTBOARDS[0];
    await canvas(page).getByRole("button", { name, exact: true }).click();
    const scheme = inspector(page).getByRole("group", { name: "Scheme", exact: true });
    await scheme.getByRole("button", { name: "Dark", exact: true }).click();

    const target = artboard(page, name);
    await expect
      .poll(async () => target.evaluate((element) => getComputedStyle(element).colorScheme))
      .toBe("dark");
    expect(await page.locator("html").getAttribute("data-theme")).toBeNull();
    expect(await page.locator("html").evaluate((element) => getComputedStyle(element).colorScheme)).not.toBe(
      "dark"
    );
    // Its neighbour keeps its own scheme.
    expect(
      await artboard(page, ARTBOARDS[2]).evaluate((element) => getComputedStyle(element).colorScheme)
    ).not.toBe("dark");
    await page.close();
  });

  it("selects and frames an artboard from the Layers list", async () => {
    const { page } = await openStudio();
    const name = ARTBOARDS[4];
    const before = await box(artboard(page, name));
    await layers(page).getByRole("button", { name, exact: true }).click();

    expect(await layers(page).getByRole("button", { name, exact: true }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(await inspector(page).getByRole("heading", { name: "Artboard" }).isVisible()).toBe(true);
    const frame = await box(canvas(page));
    await expect.poll(async () => (await box(artboard(page, name))).width).toBeGreaterThan(before.width);
    const framed = await box(artboard(page, name));
    expect(inside(framed, frame)).toBe(true);
    expect(Math.abs(framed.x + framed.width / 2 - (frame.x + frame.width / 2))).toBeLessThanOrEqual(1);
    await page.close();
  });

  it("announces the pages as links, marking the current one", async () => {
    const { page } = await openStudio();
    const pages = layers(page).getByRole("region", { name: "Pages", exact: true });
    expect(await pages.getByRole("link").allTextContents()).toEqual([
      "Overview",
      "Density",
      "Shape",
      "Color",
      "Type",
      "Screens",
    ]);
    expect(await pages.getByRole("button").count()).toBe(0);
    const current = async () =>
      pages.getByRole("link").evaluateAll((links) =>
        links.flatMap((link) => {
          const mark = link.getAttribute("aria-current");
          return mark === null ? [] : [[link.textContent, mark]];
        })
      );
    expect(await current()).toEqual([["Overview", "page"]]);

    await pages.getByRole("link", { name: "Shape", exact: true }).click();
    await page.waitForURL(/\/studio\/shape$/u);
    await expect.poll(current).toEqual([["Shape", "page"]]);
    await page.close();
  });

  it("truncates a long layer name inside the panel, keeping the whole name as its accessible name", async () => {
    const { page } = await openStudio();
    const row = layers(page).getByRole("button", { name: ARTBOARDS[0], exact: true });
    expect(inside(await box(row), await box(layers(page)))).toBe(true);
    const label = await row.evaluate((element) => {
      const text = element.querySelector("span");
      return text === null
        ? undefined
        : { clipped: text.scrollWidth > text.clientWidth, overflow: getComputedStyle(text).textOverflow };
    });
    expect(label).toEqual({ clipped: true, overflow: "ellipsis" });
    await page.close();
  });

  it("paints the artboard names in the chrome's text color while the chrome is dark", async () => {
    const { page } = await openStudio({ colorScheme: "dark" });
    const chromeText = await layers(page).evaluate((element) => getComputedStyle(element).color);
    for (const name of ARTBOARDS) {
      const label = canvas(page).getByRole("button", { name, exact: true });
      // The chrome turns dark after hydration, and the Button eases its color into the change.
      await expect
        .poll(async () => label.evaluate((element) => getComputedStyle(element).color), { message: name })
        .toBe(chromeText);
    }
    await page.close();
  });

  it("selects an artboard from a press on its label's top edge at 400%, holding the label still", async () => {
    const { page } = await openStudio();
    const name = ARTBOARDS[0];
    const corner = await box(artboard(page, name));
    // Zooming about the artboard's top-left corner keeps it, and the label above it, in place.
    await page.mouse.move(corner.x, corner.y);
    await page.keyboard.down("Control");
    for (let step = 0; step < 12; step++) {
      await page.mouse.wheel(0, -200);
    }
    await page.keyboard.up("Control");
    await expect.poll(async () => zoomLabel(page)).toBe("400%");
    await settleFrames(page);

    const label = canvas(page).getByRole("button", { name, exact: true });
    const before = await box(label);
    await page.mouse.move(before.x + 10, before.y + 2);
    await page.mouse.down();
    await settleFrames(page);
    // Only Button's own 1px press nudge, at screen size: the label's offset holds.
    const pressed = await box(label);
    expect(pressed.x).toBe(before.x);
    expect(pressed.y - before.y).toBeGreaterThanOrEqual(0);
    expect(pressed.y - before.y).toBeLessThanOrEqual(1);
    await page.mouse.up();

    expect(await layers(page).getByRole("button", { name, exact: true }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    await page.close();
  });

  it("opens a menu and the dialog inside their artboard, and Escape closes them", async () => {
    const { page } = await openStudio();
    const name = ARTBOARDS[0];
    await layers(page).getByRole("button", { name, exact: true }).click();
    const target = artboard(page, name);

    await target.getByRole("button", { name: "More actions" }).click();
    const menu = target.getByRole("menu");
    await expect.poll(async () => menu.count()).toBe(1);
    expect(await menu.getByRole("menuitem", { name: "Rename" }).isVisible()).toBe(true);
    await page.keyboard.press("Escape");
    await expect.poll(async () => menu.count()).toBe(0);

    await target.getByRole("button", { name: "Share access" }).click();
    const dialog = target.getByRole("dialog", { name: "Share access" });
    await dialog.waitFor({ state: "visible" });
    expect(inside(await box(dialog), await box(target))).toBe(true);
    await page.keyboard.press("Escape");
    await expect.poll(async () => dialog.count()).toBe(0);

    await target.getByRole("combobox", { name: "Language" }).click();
    const listbox = target.getByRole("listbox");
    await expect.poll(async () => listbox.count()).toBe(1);
    await listbox.getByRole("option", { name: "Svenska" }).click();
    await expect
      .poll(async () => target.getByRole("combobox", { name: "Language" }).textContent())
      .toContain("Svenska");
    await page.close();
  });

  it("ignores the canvas shortcuts while typing in an artboard's field", async () => {
    const { page } = await openStudio();
    const zoom = await zoomLabel(page);
    const field = artboard(page, ARTBOARDS[0]).getByRole("textbox", { name: "Full name" });
    await field.click();
    await page.keyboard.press("End");
    await page.keyboard.type("h");
    await page.keyboard.press("Shift+Digit1");

    expect(await field.inputValue()).toBe("Alex Bergh!");
    expect(
      await canvas(page).getByRole("button", { name: "Select", exact: true }).getAttribute("aria-pressed")
    ).toBe("true");
    expect(await zoomLabel(page)).toBe(zoom);
    await page.close();
  });

  it("keeps every chrome control at the 24px target floor", async () => {
    const { page } = await openStudio();
    // A selection gives the inspector its controls.
    await layers(page).getByRole("button", { name: ARTBOARDS[0], exact: true }).click();
    for (const region of [page.getByRole("banner"), layers(page), inspector(page)]) {
      const audit = await auditTargets(region);
      expect(audit.targets).toBeGreaterThan(0);
      expect(audit.misses).toEqual([]);
    }
    await page.close();
  });

  it("is linked from the docs header and the landing's Docs menu", async () => {
    const context = await newStudioContext(browser());
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(`${docsBaseUrl()}/docs`, { waitUntil: "load" });
    const header = page.getByRole("banner").getByRole("link", { name: "Studio", exact: true });
    expect(await header.getAttribute("href")).toBe("/studio");

    await page.goto(`${docsBaseUrl()}/`, { waitUntil: "load" });
    await page.locator("next-route-announcer").waitFor({ state: "attached" });
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("button", { name: "Docs", exact: true })
      .click();
    // DOM audit: the menu panel has no role, so it is found by its slot.
    const panel = page.locator("[data-slot='navigation-menu-content']");
    const entry = panel.getByRole("link", { name: /^Theme studio/u });
    await entry.waitFor({ state: "visible" });
    expect(await entry.getAttribute("href")).toBe("/studio");
    await context.close();
  });

  it("skips from the page start to the inspector without touching the share link", async () => {
    const { page } = await openStudio();
    const hash = new URL(page.url()).hash;
    await page.keyboard.press("Tab");
    expect(await isFocused(page.getByRole("link", { name: "Skip to canvas", exact: true }))).toBe(true);
    await page.keyboard.press("Tab");
    expect(await isFocused(page.getByRole("link", { name: "Skip to inspector", exact: true }))).toBe(true);

    await page.keyboard.press("Enter");
    await expect.poll(async () => holdsFocus(inspector(page))).toBe(true);
    expect(new URL(page.url()).hash).toBe(hash);
    await page.close();
  });

  it("cycles focus through the regions with F6, back with Shift+F6, and leaves F6 to a text field", async () => {
    const { page } = await openStudio();
    // Figma's order: the top bar, the Pages and Layers panel, the canvas, its toolbar, the inspector.
    const bar = page.getByRole("banner");
    const regions = [
      bar,
      layers(page),
      canvas(page),
      canvas(page).getByRole("group", { name: "Toolbar", exact: true }),
      inspector(page),
    ];
    for (const [index, region] of [...regions, bar].entries()) {
      await page.keyboard.press("F6");
      await expect.poll(async () => isFocused(region), { message: `F6 ${String(index + 1)}` }).toBe(true);
    }
    for (const [index, region] of [...regions].reverse().entries()) {
      await page.keyboard.press("Shift+F6");
      await expect
        .poll(async () => isFocused(region), { message: `Shift+F6 ${String(index + 1)}` })
        .toBe(true);
    }

    const field = inspector(page).getByRole("textbox").first();
    await field.focus();
    await page.keyboard.press("F6");
    expect(await isFocused(field)).toBe(true);
    await page.close();
  });

  it("keeps F6 the cycle's while a toast shows, with the notifications as one more stop", async () => {
    const { page } = await openStudio({ hash: "#1.not-a-studio-link" });
    const toast = page.getByText("The link's edits could not be read", { exact: true }).first();
    await toast.waitFor();
    // The pointer resting on the toast holds it open while the keys run.
    await toast.hover();
    const bar = page.getByRole("banner");
    const regions = [
      bar,
      layers(page),
      canvas(page),
      canvas(page).getByRole("group", { name: "Toolbar", exact: true }),
      inspector(page),
      page.getByRole("region", { name: "Notifications", exact: true }),
    ];
    for (const [index, region] of [...regions, bar].entries()) {
      await page.keyboard.press("F6");
      await expect.poll(async () => isFocused(region), { message: `F6 ${String(index + 1)}` }).toBe(true);
    }
    for (const [index, region] of [...regions].reverse().entries()) {
      await page.keyboard.press("Shift+F6");
      await expect
        .poll(async () => isFocused(region), { message: `Shift+F6 ${String(index + 1)}` })
        .toBe(true);
    }

    const field = inspector(page).getByRole("textbox").first();
    await field.focus();
    await page.keyboard.press("F6");
    await settleFrames(page);
    expect(await isFocused(field)).toBe(true);
    await page.close();
  });

  it("opens the inspector Sheet from its skip link on a phone", async () => {
    const { page } = await openStudio({ viewport: PHONE });
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    expect(await isFocused(page.getByRole("link", { name: "Skip to inspector", exact: true }))).toBe(true);

    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog", { name: "Inspector" });
    await sheet.waitFor({ state: "visible" });
    await expect.poll(async () => holdsFocus(sheet)).toBe(true);
    await page.close();
  });

  it("frames the first artboard across a phone, while Shift+1 still fits every artboard", async () => {
    const { page } = await openStudio({ viewport: PHONE });
    const frame = await box(canvas(page));
    expect((await box(artboard(page, ARTBOARDS[0]))).width).toBeGreaterThanOrEqual(0.8 * frame.width);

    await page.keyboard.press("Shift+Digit1");
    for (const name of ARTBOARDS) {
      await expect
        .poll(async () => inside(await box(artboard(page, name)), frame), { message: name })
        .toBe(true);
    }
    await page.close();
  });

  it("fills a phone with the canvas, without sideways scroll, and opens the inspector as a Sheet", async () => {
    const { page } = await openStudio({ viewport: PHONE, colorScheme: "dark" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await inspector(page).isVisible()).toBe(false);

    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Inspector" });
    await sheet.waitFor({ state: "visible" });
    expect(await sheet.getByRole("heading", { name: "Base theme" }).isVisible()).toBe(true);
    await page.keyboard.press("Escape");
    await expect.poll(async () => sheet.count()).toBe(0);
    await page.close();
  });

  it("hands focus to the artboard a phone picks from the layers Sheet", async () => {
    const { page } = await openStudio({ viewport: PHONE });
    await page.getByRole("button", { name: "Pages and layers", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Pages and layers" });
    await sheet.waitFor({ state: "visible" });
    const name = ARTBOARDS[4];
    await sheet.getByRole("button", { name, exact: true }).click();

    await expect.poll(async () => sheet.count()).toBe(0);
    const target = artboard(page, name);
    // The Sheet's focus return places focus on the artboard's first control.
    await expect.poll(async () => holdsFocus(target)).toBe(true);
    expect(inside(await box(target), await box(canvas(page)))).toBe(true);
    await page.close();
  });

  it("keeps panning with the finger left after a pinch", async () => {
    const { page } = await openStudio({ hasTouch: true });
    const cdp = await page.context().newCDPSession(page);
    const target = artboard(page, ARTBOARDS[0]);
    const frame = await box(canvas(page));
    const start = await box(target);
    // Empty canvas, clear of the artboards and the toolbar.
    const x = frame.x + 24;
    const y = frame.y + frame.height / 2;

    await touch(cdp, "touchStart", [{ id: 1, x, y }]);
    await touch(cdp, "touchMove", [{ id: 1, x: x + 30, y }]);
    await touch(cdp, "touchStart", [
      { id: 1, x: x + 30, y },
      { id: 2, x: x + 130, y },
    ]);
    // Both fingers move 20 px right, 100 px apart throughout: a pan without zoom.
    await touch(cdp, "touchMove", [
      { id: 1, x: x + 50, y },
      { id: 2, x: x + 150, y },
    ]);
    // The second finger lifts; the first keeps panning, 40 px down.
    await touch(cdp, "touchEnd", [{ id: 2, x: x + 150, y }]);
    await touch(cdp, "touchMove", [{ id: 1, x: x + 50, y: y + 40 }]);
    await touch(cdp, "touchEnd", [{ id: 1, x: x + 50, y: y + 40 }]);

    await expect.poll(async () => (await box(target)).y - start.y).toBeCloseTo(40, 0);
    const moved = await box(target);
    expect(Math.abs(moved.x - start.x - 50)).toBeLessThanOrEqual(1);
    expect(Math.abs(moved.width - start.width)).toBeLessThanOrEqual(1);
    await page.close();
  });

  it("selects the artboard a phone taps, and clears the selection on a tap on empty canvas", async () => {
    const { page } = await openStudio({ viewport: PHONE, hasTouch: true });
    const cdp = await page.context().newCDPSession(page);
    const name = ARTBOARDS[0];
    const target = artboard(page, name);
    const tap = async (x: number, y: number) => {
      await touch(cdp, "touchStart", [{ id: 1, x, y }]);
      await touch(cdp, "touchEnd", [{ id: 1, x, y }]);
    };
    /** Opens the phone's layers Sheet, runs `inside` on it, and closes it again. */
    const withLayers = async <T>(inside: (sheet: Locator) => Promise<T>): Promise<T> => {
      await page.getByRole("button", { name: "Pages and layers", exact: true }).click();
      const sheet = page.getByRole("dialog", { name: "Pages and layers" });
      await sheet.waitFor({ state: "visible" });
      const result = await inside(sheet);
      if ((await sheet.count()) > 0) {
        await page.keyboard.press("Escape");
      }
      await expect.poll(async () => sheet.count()).toBe(0);
      return result;
    };
    const pressedLayers = async () =>
      withLayers(async (sheet) => sheet.getByRole("button", { pressed: true }).allTextContents());

    await withLayers(async (sheet) => sheet.getByRole("button", { name, exact: true }).click());
    expect(await pressedLayers()).toEqual([name]);
    const start = await box(target);

    // The fit leaves the canvas's corner clear of every artboard and the toolbar.
    const frame = await box(canvas(page));
    await tap(frame.x + 20, frame.y + 20);
    expect(await pressedLayers()).toEqual([]);

    // The artboard's top-left corner: inside its padding, clear of its controls.
    await tap(start.x + 3, start.y + 3);
    expect(await pressedLayers()).toEqual([name]);
    // Neither tap moved the camera.
    expect(await box(target)).toEqual(start);
    await page.close();
  });

  it("leaves a touch drag inside an open dialog or menu to the overlay", async () => {
    const { page } = await openStudio({ hasTouch: true });
    const cdp = await page.context().newCDPSession(page);
    const name = ARTBOARDS[0];
    await layers(page).getByRole("button", { name, exact: true }).click();
    const target = artboard(page, name);

    const drag = async (from: { x: number; y: number }) => {
      await touch(cdp, "touchStart", [{ id: 1, ...from }]);
      await touch(cdp, "touchMove", [{ id: 1, x: from.x + 60, y: from.y + 40 }]);
      await touch(cdp, "touchEnd", [{ id: 1, x: from.x + 60, y: from.y + 40 }]);
    };

    await target.getByRole("button", { name: "Share access" }).click();
    const dialog = target.getByRole("dialog", { name: "Share access" });
    await dialog.waitFor({ state: "visible" });
    let before = await box(target);
    const text = await box(dialog.getByText(/^Invite someone/u));
    await drag({ x: text.x + 8, y: text.y + text.height / 2 });
    await settleFrames(page);
    expect(await box(target)).toEqual(before);
    await page.keyboard.press("Escape");
    await expect.poll(async () => dialog.count()).toBe(0);

    await target.getByRole("button", { name: "More actions" }).click();
    const menu = target.getByRole("menu");
    await menu.waitFor({ state: "visible" });
    before = await box(target);
    // The menu's corner, inside its padding and clear of its items.
    const corner = await box(menu);
    await drag({ x: corner.x + 2, y: corner.y + 2 });
    await settleFrames(page);
    expect(await box(target)).toEqual(before);
    await page.close();
  });

  it("hands focus from a layer into its artboard, and frames the artboard Tab enters", async () => {
    const { page } = await openStudio();
    const name = ARTBOARDS[4];
    const target = artboard(page, name);
    const frame = await box(canvas(page));
    await layers(page).getByRole("button", { name, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => target.evaluate((element) => element === document.activeElement))
      .toBe(true);

    await page.keyboard.press("Tab");
    expect(await holdsFocus(target)).toBe(true);
    await expect.poll(async () => inside(await box(target), frame)).toBe(true);

    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
    await page.mouse.wheel(4000, 0);
    await expect.poll(async () => inside(await box(target), frame)).toBe(false);
    await page.keyboard.press("Tab");
    expect(await holdsFocus(target)).toBe(true);
    await expect.poll(async () => inside(await box(target), frame)).toBe(true);
    // Focus never scrolls the canvas natively; the camera alone moves.
    expect(await canvas(page).evaluate((element) => [element.scrollLeft, element.scrollTop])).toEqual([0, 0]);
    await page.close();
  });

  it("pans a clipped control into view as Tab reaches it at 400%", async () => {
    const { page } = await openStudio();
    const name = ARTBOARDS[0];
    const frame = await box(canvas(page));
    await layers(page).getByRole("button", { name, exact: true }).focus();
    await page.keyboard.press("Enter");
    for (let step = 0; step < 8; step++) {
      await page.keyboard.press("ControlOrMeta+Equal");
    }
    expect(await zoomLabel(page)).toBe("400%");

    // The artboard covers the canvas, so only its controls can be clipped. The tab panel, a tab
    // stop larger than the canvas, shows from its start.
    for (let step = 0; step < 4; step++) {
      await page.keyboard.press("Tab");
      expect(await holdsFocus(artboard(page, name))).toBe(true);
      const focused = page.locator(":focus");
      await expect.poll(async () => shown(await box(focused), frame)).toBe(true);
    }
    expect(await zoomLabel(page)).toBe("400%");
    expect(await canvas(page).evaluate((element) => [element.scrollLeft, element.scrollTop])).toEqual([0, 0]);
    await page.close();
  });

  it("reveals a control below the canvas above the floating toolbar at 400%", async () => {
    const { page } = await openStudio();
    const name = ARTBOARDS[0];
    const frame = await box(canvas(page));
    const toolbar = canvas(page)
      .locator("[data-canvas-overlay]")
      .filter({ has: page.getByRole("button", { name: "Zoom in", exact: true }) });
    const toolbarTop = (await box(toolbar)).y;
    await layers(page).getByRole("button", { name, exact: true }).focus();
    await page.keyboard.press("Enter");
    for (let step = 0; step < 8; step++) {
      await page.keyboard.press("ControlOrMeta+Equal");
    }

    // The fifth stop, the language select, sits below the canvas once the tab panel has shown.
    for (let step = 0; step < 5; step++) {
      await page.keyboard.press("Tab");
    }
    const focused = page.locator(":focus");
    expect(await focused.getAttribute("role")).toBe("combobox");
    await expect.poll(async () => shown(await box(focused), frame)).toBe(true);
    const control = await box(focused);
    expect(control.y + control.height).toBeLessThanOrEqual(toolbarTop);
    await page.close();
  });

  it("continues a wheel pan from where an interrupted glide was drawn", async () => {
    const { page } = await openStudio({ reducedMotion: "no-preference" });
    // A slow device, where a render scheduled after the wheel would land frames late.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const frame = await box(canvas(page));
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
    await page.mouse.wheel(4000, 3000);
    const name = ARTBOARDS[0];
    await expect.poll(async () => inside(await box(artboard(page, name)), frame)).toBe(false);

    // In one page task: start the zoom-to-fit glide, seek it 100 ms in, read where the artboard
    // is drawn, wheel 100 px down, and read it again in the next frame and a frame after the pan
    // commits. A glide lasts 280 ms.
    const [drawn, next, after] = await page.evaluate(async (label) => {
      const frames = async (count: number) => {
        for (let index = 0; index < count; index += 1) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      };
      // DOM audit: the canvas and the artboard are found by their roles' accessible names.
      const studio = document.querySelector<HTMLElement>("[aria-label='Canvas']");
      const board = studio?.querySelector<HTMLElement>(`[role='region'][aria-label='${label}']`);
      if (studio === null || board === null || board === undefined) {
        throw new Error("the canvas or the artboard is missing");
      }
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "!", code: "Digit1", shiftKey: true }));
      for (let wait = 0; wait < 10 && studio.getAnimations().length === 0; wait += 1) {
        await frames(1);
      }
      const glide = studio.getAnimations();
      if (glide.length === 0) {
        throw new Error("the zoom to fit did not glide");
      }
      // Seeked, not paused: removing the transition must cancel it, as it does for a user.
      for (const animation of glide) {
        animation.currentTime = 100;
      }
      const rect = (element: HTMLElement) => {
        const { x, y, width } = element.getBoundingClientRect();
        return { x, y, width };
      };
      const before = rect(board);
      const { left, top } = studio.getBoundingClientRect();
      studio.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: 100,
          clientX: left + 10,
          clientY: top + 10,
          bubbles: true,
          cancelable: true,
        })
      );
      // The frame after the wheel already draws the pan, not the glide playing on.
      const nextFrame = await new Promise<ReturnType<typeof rect>>((resolve) => {
        requestAnimationFrame(() => {
          resolve(rect(board));
        });
      });
      // The pan commits through React, which a slow runner can hold past a fixed frame count, and
      // the seeked glide plays on until then. The commit drops `data-gliding` and cancels the glide.
      for (let wait = 0; wait < 30 && studio.dataset.gliding === "true"; wait += 1) {
        await frames(1);
      }
      await frames(1);
      return [before, nextFrame, rect(board)];
    }, name);

    for (const [moment, seen] of [
      ["next frame", next],
      ["after the commit", after],
    ] as const) {
      expect(Math.abs(seen.x - drawn.x), moment).toBeLessThanOrEqual(3);
      expect(Math.abs(seen.y - (drawn.y - 100)), moment).toBeLessThanOrEqual(3);
      expect(Math.abs(seen.width - drawn.width), moment).toBeLessThanOrEqual(3);
    }
    await page.close();
  });
});
