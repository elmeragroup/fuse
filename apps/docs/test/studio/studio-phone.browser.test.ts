import type { CDPSession, Locator } from "playwright";
import { describe, expect, it } from "vitest";

import { settleFrames } from "../landing-page";
import { launchSuiteBrowser } from "../suite-browser";
import {
  ARTBOARDS,
  artboard,
  box,
  canvas,
  holdsFocus,
  inside,
  inspector,
  isFocused,
  layers,
  openStudio as openStudioPage,
} from "./page";
import type { StudioContextOptions, StudioPage } from "./page";

const browser = launchSuiteBrowser();

const PHONE = { width: 390, height: 844 } as const;

/** Opens `/studio` in a fresh context; each test closes its page, and the suite the rest. */
async function openStudio(options: StudioContextOptions = {}): Promise<StudioPage> {
  return openStudioPage(browser(), options);
}

type Finger = { id: number; x: number; y: number };

/**
 * Sends one CDP touch event. A start or a move lists every finger down and presses or moves
 * them; an end lists the fingers that lift.
 */
async function touch(cdp: CDPSession, type: "touchStart" | "touchMove" | "touchEnd", fingers: Finger[]) {
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: fingers });
}

describe("theme studio on a phone and by touch", () => {
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

  // The studio's root clips its overflow, so a crowded bar would hide its last buttons without any
  // sideways scroll.
  it.each([
    { width: 320, height: 700 },
    { width: 390, height: 844 },
  ])("keeps every header button inside a $width px phone", async (viewport) => {
    const { page } = await openStudio({ viewport });
    const buttons = await page
      .getByRole("banner")
      .getByRole("button")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const { left, right } = element.getBoundingClientRect();
          return { name: element.getAttribute("aria-label") ?? element.textContent, left, right };
        })
      );
    expect(buttons.length).toBeGreaterThan(0);
    expect(
      buttons.filter(({ left, right }) => left < 0 || right > viewport.width).map(({ name }) => name)
    ).toEqual([]);
    await page.close();
  });

  it("mounts one token editor on a phone, the Sheet's, keeping the desktop panels' regions", async () => {
    const { page } = await openStudio({ viewport: PHONE });
    const editors = page.getByRole("textbox", { name: "Filter tokens", exact: true, includeHidden: true });
    expect(await editors.count()).toBe(0);
    // The desktop panels' regions stay, out of view, for the skip links and F6 to find.
    for (const name of ["Inspector", "Pages and layers"]) {
      const region = page.getByRole("complementary", { name, exact: true, includeHidden: true });
      expect(await region.count(), name).toBe(1);
    }

    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await page.getByRole("dialog", { name: "Inspector" }).waitFor({ state: "visible" });
    expect(await editors.count()).toBe(1);
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
});
