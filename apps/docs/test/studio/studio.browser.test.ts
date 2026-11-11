import type { Locator, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auditTargets, settleFrames } from "../landing-page";
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
});
