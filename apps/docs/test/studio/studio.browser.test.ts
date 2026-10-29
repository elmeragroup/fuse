import type { Locator, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { BRANDS } from "@elmeragroup/fuse/theme";

import { docsBaseUrl } from "../docs-server";
import { auditTargets, settleFrames, waitForLandingHydration } from "../landing-page";
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
  newStudioContext,
  openStudio as openStudioPage,
} from "./page";
import type { Box, StudioContextOptions, StudioPage } from "./page";

const browser = launchSuiteBrowser();

/** Opens `/studio` in a fresh context; each test closes its page, and the suite the rest. */
async function openStudio(options: StudioContextOptions & { hash?: string } = {}): Promise<StudioPage> {
  return openStudioPage(browser(), options);
}

/** Whether `inner` shows in `outer`: whole when it fits, else from its top-left corner. */
function shown(inner: Box, outer: Box): boolean {
  if (inner.width <= outer.width && inner.height <= outer.height) {
    return inside(inner, outer);
  }
  return inside({ x: inner.x, y: inner.y, width: 0, height: 0 }, outer);
}

/** The floating theme toolbar's popup over the selected artboard or part. */
function themeBar(page: Page): Locator {
  return page.getByRole("group", { name: "Theme toolbar", exact: true });
}

/** Whether `control`'s top sits at or below `bar`'s bottom edge. */
function clearBelow(control: Box, bar: Box): boolean {
  return control.y >= bar.y + bar.height - 0.5;
}

/** Whether `locator` holds still across two frames, once the camera's glide has ended. */
async function settled(page: Page, locator: Locator): Promise<boolean> {
  const before = await box(locator);
  await settleFrames(page);
  const after = await box(locator);
  return before.x === after.x && before.y === after.y;
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

describe("theme studio", () => {
  /**
   * The checks of the opening chrome share one page. They tab, select an artboard and navigate, so
   * they run in declaration order, each leaving the next its start: none focuses before the skip
   * link, and only the last navigates.
   */
  describe("on one opened page", () => {
    let opened: StudioPage | undefined;
    beforeAll(async () => {
      opened = await openStudio();
    });
    afterAll(async () => {
      await opened?.context.close();
    });
    const chrome = (): StudioPage => {
      if (opened === undefined) {
        throw new Error("The shared studio page opens in beforeAll.");
      }
      return opened;
    };

    it("renders the chrome and the five artboards", async () => {
      const { page, errors } = chrome();
      expect(await page.getByRole("banner").getByText("Theme studio", { exact: true }).isVisible()).toBe(
        true
      );
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
    });

    it("truncates a long layer name inside the panel, keeping the whole name as its accessible name", async () => {
      const { page } = chrome();
      const row = layers(page).getByRole("button", { name: ARTBOARDS[0], exact: true });
      expect(inside(await box(row), await box(layers(page)))).toBe(true);
      const label = await row.evaluate((element) => {
        const text = element.querySelector("span");
        return text === null
          ? undefined
          : { clipped: text.scrollWidth > text.clientWidth, overflow: getComputedStyle(text).textOverflow };
      });
      expect(label).toEqual({ clipped: true, overflow: "ellipsis" });
    });

    it("skips from the page start to the inspector without touching the share link", async () => {
      const { page } = chrome();
      const hash = new URL(page.url()).hash;
      await page.keyboard.press("Tab");
      expect(await isFocused(page.getByRole("link", { name: "Skip to canvas", exact: true }))).toBe(true);
      await page.keyboard.press("Tab");
      expect(await isFocused(page.getByRole("link", { name: "Skip to inspector", exact: true }))).toBe(true);

      await page.keyboard.press("Enter");
      await expect.poll(async () => holdsFocus(inspector(page))).toBe(true);
      expect(new URL(page.url()).hash).toBe(hash);
    });

    it("keeps every chrome control at the 24px target floor", async () => {
      const { page } = chrome();
      // A selection gives the inspector its controls.
      await layers(page).getByRole("button", { name: ARTBOARDS[0], exact: true }).click();
      for (const region of [page.getByRole("banner"), layers(page), inspector(page)]) {
        const audit = await auditTargets(region);
        expect(audit.targets).toBeGreaterThan(0);
        expect(audit.misses).toEqual([]);
      }
    });

    it("announces the pages as links, marking the current one", async () => {
      const { page } = chrome();
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
    });
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

  it("keeps a visited page current while hidden, and shows it with its input on Back", async () => {
    const { page, errors } = await openStudio();
    const field = artboard(page, ARTBOARDS[0]).getByRole("textbox", { name: "Full name" });
    await field.fill("Kari Nordmann");
    const pages = layers(page).getByRole("region", { name: "Pages", exact: true });
    await pages.getByRole("link", { name: "Color", exact: true }).click();
    await artboard(page, "Role pairs · Light").waitFor({ state: "visible" });
    await pages.getByRole("link", { name: "Type", exact: true }).click();
    await page.waitForURL(/\/studio\/type$/u);

    // Next keeps the visited pages mounted in hidden Activity boundaries, and React renders their
    // updates at idle priority. A base theme picked here reaches the hidden Overview there.
    await page.getByRole("button", { name: /^Base theme/u }).click();
    await page.getByRole("menuitemradio", { name: BRANDS.fkas.displayName, exact: true }).click();
    await page.keyboard.press("Escape");
    const hidden = canvas(page).getByRole("region", { name: ARTBOARDS[0], exact: true, includeHidden: true });
    expect(await hidden.isVisible()).toBe(false);
    await expect.poll(async () => hidden.getAttribute("data-theme-brand")).toBe("fkas");

    await page.goBack();
    await page.goBack();
    await page.waitForURL(/\/studio$/u);
    const frame = await box(canvas(page));
    for (const name of ARTBOARDS) {
      await artboard(page, name).waitFor({ state: "visible" });
      expect(shown(await box(artboard(page, name)), frame), name).toBe(true);
    }
    expect(await field.inputValue()).toBe("Kari Nordmann");
    expect(errors).toEqual([]);
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

  it("is linked from the docs header and the landing's Docs menu", async () => {
    const context = await newStudioContext(browser());
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(`${docsBaseUrl()}/docs`, { waitUntil: "load" });
    const header = page.getByRole("banner").getByRole("link", { name: "Studio", exact: true });
    expect(await header.getAttribute("href")).toBe("/studio");

    await page.goto(`${docsBaseUrl()}/`, { waitUntil: "load" });
    await waitForLandingHydration(page);
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

  it("cycles focus through the regions with F6, back with Shift+F6, and leaves F6 to a text field", async () => {
    const { page } = await openStudio();
    // Figma's order: the top bar, the Pages and Layers panel, the canvas, its toolbar, the inspector.
    const bar = page.getByRole("banner");
    const regions = [
      bar,
      layers(page),
      canvas(page),
      canvas(page).getByRole("toolbar", { name: "Toolbar", exact: true }),
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

  it("keeps the canvas bar's disabled Undo and Redo focusable in its arrow-key order", async () => {
    // No link edits, so the history is empty and both are disabled.
    const { page } = await openStudio();
    const bar = canvas(page).getByRole("toolbar", { name: "Toolbar", exact: true });
    const undo = bar.getByRole("button", { name: "Undo", exact: true });
    const redo = bar.getByRole("button", { name: "Redo", exact: true });
    for (const control of [undo, redo]) {
      expect(await control.getAttribute("aria-disabled")).toBe("true");
      expect(await control.getAttribute("disabled")).toBeNull();
    }

    // Select part is the item before the History group.
    await bar.getByRole("button", { name: "Select part", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => isFocused(undo)).toBe(true);
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => isFocused(redo)).toBe(true);
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
      canvas(page).getByRole("toolbar", { name: "Toolbar", exact: true }),
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

  it("pans a clipped control into view below the theme toolbar pinned to the canvas's top as Tab reaches it at 400%", async () => {
    const { page } = await openStudio();
    const name = ARTBOARDS[0];
    const frame = await box(canvas(page));
    await layers(page).getByRole("button", { name, exact: true }).focus();
    await page.keyboard.press("Enter");
    for (let step = 0; step < 8; step++) {
      await page.keyboard.press("ControlOrMeta+Equal");
    }
    expect(await zoomLabel(page)).toBe("400%");
    const bar = await box(themeBar(page));
    expect(Math.abs(bar.y - frame.y - 8)).toBeLessThanOrEqual(1);

    const focused = page.locator(":focus");
    for (const key of ["Tab", "Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"]) {
      await page.keyboard.press(key);
      expect(await holdsFocus(artboard(page, name))).toBe(true);
      await expect.poll(async () => clearBelow(await box(focused), bar)).toBe(true);
      expect(shown(await box(focused), frame)).toBe(true);
    }
    // Only the camera pans: the zoom holds, and focus never scrolls the canvas natively.
    expect(await zoomLabel(page)).toBe("400%");
    expect(await canvas(page).evaluate((element) => [element.scrollLeft, element.scrollTop])).toEqual([0, 0]);
    await page.close();
  });

  it("reveals the first Tab stop below the pinned theme toolbar while the zoom to 400% still glides", async () => {
    const { page } = await openStudio({ reducedMotion: "no-preference" });
    const name = ARTBOARDS[0];
    await layers(page).getByRole("button", { name, exact: true }).focus();
    await page.keyboard.press("Enter");
    for (let step = 0; step < 8; step++) {
      await page.keyboard.press("ControlOrMeta+Equal");
    }
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect
      .poll(
        async () =>
          (await settled(page, focused)) && clearBelow(await box(focused), await box(themeBar(page)))
      )
      .toBe(true);
    await page.close();
  });

  it("reveals a control below the theme toolbar that pins as a zoom out glides its hidden artboard into view", async () => {
    const { page } = await openStudio({ reducedMotion: "no-preference" });
    const name = ARTBOARDS[0];
    const frame = await box(canvas(page));
    await layers(page).getByRole("button", { name, exact: true }).focus();
    await page.keyboard.press("Enter");
    for (let step = 0; step < 8; step++) {
      await page.keyboard.press("ControlOrMeta+Equal");
    }
    await expect.poll(async () => settled(page, artboard(page, name))).toBe(true);
    const focused = page.locator(":focus");
    await page.keyboard.press("Tab");
    await expect.poll(async () => settled(page, focused)).toBe(true);
    await focused.evaluate((element) => {
      element.setAttribute("data-test-target", "");
    });
    const marked = page.locator("[data-test-target]");
    await page.keyboard.press("Tab");
    await expect.poll(async () => settled(page, focused)).toBe(true);

    // Six steps zoom 400% out to 50% around the canvas's centre, scaling every offset from it by
    // 1/8. Pan the artboard 600 px past the canvas's left edge, which hides the bar, and so far
    // down that the marked control lands 30 px below the canvas's top at 50%. The artboard's top is
    // then above the canvas, so the bar pins there, over the control.
    const board = await box(artboard(page, name));
    const centre = { x: frame.width / 2, y: frame.height / 2 };
    const top = (await box(marked)).y - frame.y;
    await page.mouse.move(frame.x + centre.x, frame.y + centre.y);
    await page.mouse.wheel(board.x + board.width - frame.x + 600, top - centre.y - 8 * (30 - centre.y));
    await expect.poll(async () => themeBar(page).isVisible()).toBe(false);

    for (let step = 0; step < 6; step++) {
      await page.keyboard.press("ControlOrMeta+Minus");
    }
    await page.keyboard.press("Shift+Tab");
    expect(await isFocused(marked)).toBe(true);
    await expect
      .poll(
        async () => (await settled(page, marked)) && clearBelow(await box(marked), await box(themeBar(page)))
      )
      .toBe(true);
    expect(await zoomLabel(page)).toBe("50%");
    await page.close();
  });

  it("moves a focused control out from under the pinned theme toolbar as Tab returns to it", async () => {
    const { page } = await openStudio();
    const name = ARTBOARDS[0];
    const frame = await box(canvas(page));
    await layers(page).getByRole("button", { name, exact: true }).focus();
    await page.keyboard.press("Enter");
    for (let step = 0; step < 8; step++) {
      await page.keyboard.press("ControlOrMeta+Equal");
    }
    const focused = page.locator(":focus");
    // Tab on to the first button, switch or checkbox under 40 layout pixels tall.
    let found = false;
    for (let step = 0; step < 12 && !found; step++) {
      await page.keyboard.press("Tab");
      found = await focused.evaluate(
        (element) =>
          element instanceof HTMLElement &&
          element.matches(
            'button, [role="button"], [role="switch"], [role="checkbox"], input[type="checkbox"]'
          ) &&
          element.offsetHeight < 40
      );
    }
    expect(found).toBe(true);
    await focused.evaluate((element) => {
      element.setAttribute("data-test-target", "");
    });
    const marked = page.locator("[data-test-target]");
    await page.keyboard.press("Shift+Tab");
    // Shift+Tab's own reveal settles before the pan, so nothing moves the control afterwards.
    await expect.poll(async () => settled(page, marked)).toBe(true);

    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
    const bar = await box(themeBar(page));
    await page.mouse.wheel(0, (await box(marked)).y - (bar.y + bar.height / 2));
    // Fresh boxes, with no key press between this check and the Tab it judges.
    await expect
      .poll(async () => {
        const top = (await box(marked)).y;
        const band = await box(themeBar(page));
        return top > band.y && top < band.y + band.height && (await settled(page, marked));
      })
      .toBe(true);

    await page.keyboard.press("Tab");
    expect(await isFocused(marked)).toBe(true);
    await expect.poll(async () => clearBelow(await box(marked), await box(themeBar(page)))).toBe(true);
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
