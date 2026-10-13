import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { settleFrames } from "../landing-page";
import { launchSuiteBrowser } from "../suite-browser";
import {
  ARTBOARDS,
  artboard,
  background,
  canvas,
  inspector,
  layers,
  openStudio,
  openTokenSection,
  tokenRow,
} from "./page";
import type { StudioRoute } from "./page";

const browser = launchSuiteBrowser();

const PHONE = { width: 390, height: 844 } as const;

const LIGHT_BOARD = ARTBOARDS[0];
const DARK_BOARD = ARTBOARDS[1];

/** The Shape page, whose rung artboards pin a variant, so their bars carry the Variant toggle. */
const PINNED_BOARD = "Radius rungs · Internal";
const RUNGS_PAGE: StudioRoute = { path: "/studio/shape", artboard: PINNED_BOARD };

/** Tailwind's `lg`, the narrowest viewport the floating toolbar renders at. */
const LG = { width: 1024, height: 768 } as const;

/** The documented screen px between the toolbar and its anchor: an artboard's, and a part's. */
const ARTBOARD_GAP = 36;
const PART_GAP = 8;

const RED = "rgb(255, 0, 0)";

type Box = { x: number; y: number; width: number; height: number };

async function box(locator: Locator): Promise<Box> {
  const measured = await locator.boundingBox();
  if (measured === null) {
    throw new Error("the element has no box");
  }
  return measured;
}

/** The floating theme toolbar over a selected artboard. */
function artboardBar(page: Page): Locator {
  return canvas(page).getByRole("toolbar", { name: "Artboard theme", exact: true });
}

/** The floating theme toolbar over a picked part. */
function partBar(page: Page): Locator {
  return canvas(page).getByRole("toolbar", { name: "Part theme", exact: true });
}

/** An artboard's row in the Layers list. */
function layer(page: Page, name: string): Locator {
  return layers(page).getByRole("button", { name, exact: true });
}

/** A menu button of a theme toolbar, by its name before any token count. */
function menuButton(bar: Locator, name: string): Locator {
  return bar.getByRole("button", { name: new RegExp(`^${name}(?: \\d+ tokens)?$`, "u") });
}

/** The px Base UI keeps a popup inside its collision boundary, the canvas here, by default. */
const COLLISION_PADDING = 5;

/**
 * Where a toolbar sits against its anchor: the screen px between its bottom edge and the anchor's
 * top edge, and between its centre across and where Base UI centres it: over the anchor's
 * centre, shifted to stay {@link COLLISION_PADDING} inside the canvas.
 */
async function placementOver(
  page: Page,
  bar: Locator,
  anchor: Locator
): Promise<{ gap: number; offset: number }> {
  const above = await box(bar);
  const below = await box(anchor);
  const frame = await box(canvas(page));
  const half = above.width / 2;
  const centre = Math.min(
    Math.max(below.x + below.width / 2, frame.x + COLLISION_PADDING + half),
    frame.x + frame.width - COLLISION_PADDING - half
  );
  return { gap: below.y - (above.y + above.height), offset: above.x + half - centre };
}

/** {@link placementOver} for the artboard bar over the artboard `name`. */
async function placement(page: Page, name: string): Promise<{ gap: number; offset: number }> {
  return placementOver(page, artboardBar(page), artboard(page, name));
}

function inside(inner: Box, outer: Box): boolean {
  return (
    inner.x >= outer.x - 1 &&
    inner.y >= outer.y - 1 &&
    inner.x + inner.width <= outer.x + outer.width + 1 &&
    inner.y + inner.height <= outer.y + outer.height + 1
  );
}

/** Whether `menu` opens on `side` of `bar`, clear of it, and inside the canvas. */
async function menuClear(page: Page, menu: Locator, bar: Locator, side: "below" | "above"): Promise<boolean> {
  const popup = await box(menu);
  const toolbar = await box(bar);
  const clear =
    side === "below" ? popup.y >= toolbar.y + toolbar.height : popup.y + popup.height <= toolbar.y;
  return clear && inside(popup, await box(canvas(page)));
}

/** Whether the focused element is `locator`'s element. */
async function isFocused(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => element === document.activeElement);
}

async function colorScheme(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).colorScheme);
}

describe("the studio's theme toolbar", () => {
  it("opens over an artboard selected from the canvas or Layers, and a selected layer's row toggles it", async () => {
    const { context, page, errors } = await openStudio(browser());
    try {
      // A press on an artboard's empty corner selects it; the first fit shows every artboard.
      const dark = await box(artboard(page, DARK_BOARD));
      await page.mouse.click(dark.x + 3, dark.y + 3);
      expect(await layer(page, DARK_BOARD).getAttribute("aria-pressed")).toBe("true");
      await artboardBar(page).waitFor({ state: "visible" });
      expect((await placement(page, DARK_BOARD)).gap).toBeGreaterThan(0);
      expect(Math.abs((await placement(page, DARK_BOARD)).offset)).toBeLessThanOrEqual(1);

      await layer(page, LIGHT_BOARD).click();
      const bar = artboardBar(page);
      await bar.waitFor({ state: "visible" });
      // Opening moves no focus: the Layers press still hands it to the artboard.
      expect(
        await artboard(page, LIGHT_BOARD).evaluate((element) => element === document.activeElement)
      ).toBe(true);
      // Above the artboard and clear of its name label, centred across it.
      const label = await box(canvas(page).getByRole("button", { name: LIGHT_BOARD, exact: true }));
      const barBox = await box(bar);
      expect(barBox.y + barBox.height).toBeLessThanOrEqual(label.y);
      expect(Math.abs((await placement(page, LIGHT_BOARD)).offset)).toBeLessThanOrEqual(1);

      await layer(page, LIGHT_BOARD).click();
      await bar.waitFor({ state: "detached" });
      expect(await layer(page, LIGHT_BOARD).getAttribute("aria-pressed")).toBe("true");
      await layer(page, LIGHT_BOARD).click();
      await bar.waitFor({ state: "visible" });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("swaps to a part's bar with only the menus it has tokens for, and steps back with Escape", async () => {
    const { context, page } = await openStudio(browser());
    try {
      await artboard(page, LIGHT_BOARD)
        .getByRole("switch", { name: "Paperless invoices", exact: true })
        .click({ modifiers: ["Alt"] });
      const bar = partBar(page);
      await bar.waitFor({ state: "visible" });
      expect(await bar.getByText("switch", { exact: false }).first().isVisible()).toBe(true);
      // Switch's recipe reads five color roles: its track off and on, its thumb, its focus ring
      // and its invalid state. It reads no shape or type token.
      expect(await menuButton(bar, "Color").textContent()).toContain("5");
      for (const name of ["Shape", "Type", "Density"]) {
        expect(await menuButton(bar, name).count(), name).toBe(0);
      }
      await menuButton(bar, "Color").click();
      const menu = page.getByRole("dialog", { name: "Color", exact: true });
      await menu.waitFor({ state: "visible" });
      const rows = await menu
        .getByRole("group", { name: /^--/u })
        .evaluateAll((groups) => groups.map((group) => group.getAttribute("aria-label")));
      expect(rows).toEqual(["--background", "--primary", "--error", "--input", "--ring"]);

      // Escape closes the menu first, then drops the part, then clears the selection.
      await page.keyboard.press("Escape");
      await menu.waitFor({ state: "detached" });
      await expect.poll(async () => bar.isVisible()).toBe(true);
      await page.keyboard.press("Escape");
      await artboardBar(page).waitFor({ state: "visible" });
      expect(await partBar(page).count()).toBe(0);
      // The focused menu button stays in place on the artboard's bar.
      expect(await artboardBar(page).evaluate((element) => element.contains(document.activeElement))).toBe(
        true
      );
      await page.keyboard.press("Escape");
      await artboardBar(page).waitFor({ state: "detached" });
      expect(await layers(page).getByRole("button", { pressed: true }).count()).toBe(0);
      expect(await canvas(page).evaluate((element) => element === document.activeElement)).toBe(true);
    } finally {
      await context.close();
    }
  });

  it("edits a token from its Color menu on every artboard, shows the edit in the inspector, and undoes it", async () => {
    const { context, page } = await openStudio(browser());
    try {
      const save = (name: string) => artboard(page, name).getByRole("button", { name: "Save", exact: true });
      const before = await background(save(LIGHT_BOARD));
      const darkBefore = await background(save(DARK_BOARD));
      expect(before).not.toBe(RED);

      await layer(page, LIGHT_BOARD).click();
      await menuButton(artboardBar(page), "Color").click();
      const menu = page.getByRole("dialog", { name: "Color", exact: true });
      await menu.getByRole("button", { name: "Actions", exact: true }).click();
      await menu
        .getByRole("group", { name: "--primary", exact: true })
        .getByRole("button", { name: "Edit --primary", exact: true })
        .click();
      const field = page.getByRole("textbox", { name: "Color", exact: true });
      await field.fill("#ff0000");
      await page.keyboard.press("Escape");
      await field.waitFor({ state: "hidden" });

      // Every light artboard wears the edit; the dark ones keep their own scheme's value.
      await expect.poll(() => background(save(LIGHT_BOARD))).toBe(RED);
      expect(await background(save(ARTBOARDS[2]))).toBe(RED);
      expect(await background(save(DARK_BOARD))).toBe(darkBefore);
      // The inspector edits the selected artboard's scheme and marks the token edited.
      await menuButton(artboardBar(page), "Color").click();
      await menu.waitFor({ state: "detached" });
      await openTokenSection(page, "Actions");
      expect(await tokenRow(page, "primary").getByText("Edited", { exact: true }).count()).toBe(1);

      await canvas(page).getByRole("button", { name: "Undo", exact: true }).click();
      await expect.poll(() => background(save(LIGHT_BOARD))).toBe(before);
      expect(await tokenRow(page, "primary").getByText("Edited", { exact: true }).count()).toBe(0);
    } finally {
      await context.close();
    }
  });

  it("follows its artboard through a pan and a zoom out, stays inside the canvas, and hides with it", async () => {
    const { context, page } = await openStudio(browser());
    try {
      await layer(page, LIGHT_BOARD).click();
      await artboardBar(page).waitFor({ state: "visible" });
      // Room above the artboard for the toolbar, so the camera moves below only move it.
      const board = await box(artboard(page, LIGHT_BOARD));
      await page.mouse.move(board.x + board.width / 2, board.y + board.height / 2);
      await page.mouse.wheel(0, -120);
      await expect.poll(async () => (await box(artboard(page, LIGHT_BOARD))).y).toBeCloseTo(board.y + 120, 0);
      await settleFrames(page);
      // Unit under test: the toolbar's place against its artboard. Oracle: that place before the
      // camera moved, which every move keeps.
      const start = await placement(page, LIGHT_BOARD);

      await page.mouse.wheel(-60, -40);
      await expect.poll(async () => (await box(artboard(page, LIGHT_BOARD))).x).toBeCloseTo(board.x + 60, 0);
      await expect.poll(async () => (await placement(page, LIGHT_BOARD)).gap).toBeCloseTo(start.gap, 0);
      expect((await placement(page, LIGHT_BOARD)).offset).toBeCloseTo(start.offset, 0);

      // Zooming out around a point inside the artboard shrinks it within its last box.
      const panned = await box(artboard(page, LIGHT_BOARD));
      await page.mouse.move(panned.x + panned.width / 2, panned.y + panned.height / 2);
      await page.keyboard.down("Control");
      await page.mouse.wheel(0, 120);
      await page.keyboard.up("Control");
      await expect
        .poll(async () => (await box(artboard(page, LIGHT_BOARD))).width)
        .toBeLessThan(panned.width * 0.9);
      await expect.poll(async () => (await placement(page, LIGHT_BOARD)).gap).toBeCloseTo(start.gap, 0);
      expect((await placement(page, LIGHT_BOARD)).offset).toBeCloseTo(start.offset, 0);

      // Panned until the artboard's top leaves the canvas, it stays at the canvas's top, over the
      // artboard, rather than flipping beneath it.
      await page.mouse.wheel(0, 600);
      const frame = await box(canvas(page));
      await expect.poll(async () => (await box(artboard(page, LIGHT_BOARD))).y).toBeLessThan(frame.y);
      await settleFrames(page);
      const pinned = await box(artboardBar(page));
      const tall = await box(artboard(page, LIGHT_BOARD));
      expect(pinned.y).toBeGreaterThanOrEqual(frame.y);
      expect(pinned.y + pinned.height).toBeLessThan(tall.y + tall.height);

      // Once the artboard leaves the canvas, the toolbar hides until it returns.
      await page.mouse.wheel(0, 4000);
      await expect
        .poll(async () => {
          const gone = await box(artboard(page, LIGHT_BOARD));
          return gone.y + gone.height;
        })
        .toBeLessThan(frame.y);
      await expect.poll(async () => artboardBar(page).isVisible()).toBe(false);
      await page.mouse.wheel(0, -4000);
      await expect.poll(async () => artboardBar(page).isVisible()).toBe(true);
    } finally {
      await context.close();
    }
  });

  it("steps back from a part picked with the keyboard, then clears its artboard, while focus stays on the control", async () => {
    const { context, page } = await openStudio(browser());
    try {
      await page.keyboard.press("p");
      const save = artboard(page, LIGHT_BOARD).getByRole("button", { name: "Save", exact: true });
      await save.focus();
      await page.keyboard.press("Enter");
      await partBar(page).waitFor({ state: "visible" });

      await page.keyboard.press("Escape");
      await artboardBar(page).waitFor({ state: "visible" });
      expect(await isFocused(save)).toBe(true);
      await page.keyboard.press("Escape");
      await artboardBar(page).waitFor({ state: "detached" });
      expect(await layers(page).getByRole("button", { pressed: true }).count()).toBe(0);
      expect(await isFocused(save)).toBe(true);
    } finally {
      await context.close();
    }
  });

  it("leaves Escape in a text field to the field, keeping the artboard selected and its toolbar shown", async () => {
    const { context, page } = await openStudio(browser());
    try {
      await layer(page, LIGHT_BOARD).click();
      await artboardBar(page).waitFor({ state: "visible" });
      const filter = inspector(page).getByRole("textbox", { name: "Filter tokens", exact: true });
      await filter.focus();
      await page.keyboard.press("Escape");
      await settleFrames(page);
      expect(await layer(page, LIGHT_BOARD).getAttribute("aria-pressed")).toBe("true");
      expect(await artboardBar(page).isVisible()).toBe(true);
      expect(await isFocused(filter)).toBe(true);
    } finally {
      await context.close();
    }
  });

  it("opens a new target with no menu open, even one the last target's bar had open", async () => {
    const { context, page } = await openStudio(browser());
    try {
      await layer(page, LIGHT_BOARD).click();
      const bar = artboardBar(page);
      await bar.waitFor({ state: "visible" });
      await page.getByRole("button", { name: "Select part", exact: true }).click();
      await menuButton(bar, "Type").click();
      await page.getByRole("dialog", { name: "Type", exact: true }).waitFor({ state: "visible" });

      // The switch's part bar has no Type menu; Escape returns to the artboard's bar.
      await artboard(page, LIGHT_BOARD)
        .getByRole("switch", { name: "Paperless invoices", exact: true })
        .click();
      await partBar(page).waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      await bar.waitFor({ state: "visible" });
      await settleFrames(page);
      expect(
        await page
          .getByRole("dialog", { name: /^(?:Color|Shape|Type|Density)$/u, includeHidden: true })
          .count()
      ).toBe(0);
    } finally {
      await context.close();
    }
  });

  it("opens a menu taller than the room below the bar under the bar, scrolling, with the other menus in reach", async () => {
    const { context, page } = await openStudio(browser());
    try {
      await layer(page, LIGHT_BOARD).click();
      const bar = artboardBar(page);
      await menuButton(bar, "Color").click();
      const color = page.getByRole("dialog", { name: "Color", exact: true });
      await color.waitFor({ state: "visible" });
      await settleFrames(page);
      const below = await box(color);
      const above = await box(bar);
      expect(below.y).toBeGreaterThanOrEqual(above.y + above.height);
      expect(inside(below, await box(canvas(page)))).toBe(true);
      // Its knobs run on past the room, inside the popup.
      expect(await color.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

      await menuButton(bar, "Shape").click();
      await page.getByRole("dialog", { name: "Shape", exact: true }).waitFor({ state: "visible" });
      await color.waitFor({ state: "detached" });
    } finally {
      await context.close();
    }
  });

  it("keeps an open menu below the bar and inside the canvas through a zoom out and a window resize", async () => {
    const { context, page } = await openStudio(browser());
    try {
      await layer(page, LIGHT_BOARD).click();
      const bar = artboardBar(page);
      await menuButton(bar, "Color").click();
      const color = page.getByRole("dialog", { name: "Color", exact: true });
      await color.waitFor({ state: "visible" });

      // A wheel zoom out over the empty canvas, clear of the menu, moves the bar. The menu's
      // place is read once the artboard has shrunk, so it is the one after the camera move.
      const frame = await box(canvas(page));
      const before = (await box(artboard(page, LIGHT_BOARD))).width;
      await page.mouse.move(frame.x + 40, frame.y + frame.height / 2);
      await page.keyboard.down("Control");
      await page.mouse.wheel(0, 120);
      await page.keyboard.up("Control");
      await expect
        .poll(async () => (await box(artboard(page, LIGHT_BOARD))).width)
        .toBeLessThan(before * 0.9);
      await expect.poll(async () => menuClear(page, color, bar, "below")).toBe(true);

      await page.setViewportSize({ width: 1440, height: 600 });
      await expect.poll(async () => menuClear(page, color, bar, "below")).toBe(true);
      await menuButton(bar, "Shape").click();
      await page.getByRole("dialog", { name: "Shape", exact: true }).waitFor({ state: "visible" });
    } finally {
      await context.close();
    }
  });

  it("opens a menu above a part bar near the canvas's foot, clear of the bar", async () => {
    const { context, page } = await openStudio(browser());
    try {
      await layer(page, LIGHT_BOARD).click();
      await artboard(page, LIGHT_BOARD)
        .getByRole("button", { name: "Save", exact: true })
        .click({ modifiers: ["Alt"] });
      const bar = partBar(page);
      await bar.waitFor({ state: "visible" });

      // Pan the bar down until its foot sits 120px above the canvas's.
      const frame = await box(canvas(page));
      const start = await box(bar);
      const foot = frame.y + frame.height - 120;
      await page.mouse.move(frame.x + 40, frame.y + frame.height / 2);
      await page.mouse.wheel(0, start.y + start.height - foot);
      await expect.poll(async () => (await box(bar)).y + (await box(bar)).height).toBeCloseTo(foot, 0);

      await menuButton(bar, "Color").click();
      const color = page.getByRole("dialog", { name: "Color", exact: true });
      await color.waitFor({ state: "visible" });
      await expect.poll(async () => menuClear(page, color, bar, "above")).toBe(true);
    } finally {
      await context.close();
    }
  });

  it.each([
    {
      popup: "the Color menu",
      trigger: (bar: Locator) => bar.getByRole("button", { name: "Color", exact: true, includeHidden: true }),
      find: (page: Page) => page.getByRole("dialog", { name: "Color", exact: true }),
    },
    {
      popup: "the Brand list",
      trigger: (bar: Locator) =>
        bar.getByRole("combobox", { name: "Brand", exact: true, includeHidden: true }),
      find: (page: Page) => page.getByRole("listbox"),
    },
  ])(
    "hides once its artboard leaves the canvas, closing $popup, so one Escape clears the selection",
    async ({ trigger, find }) => {
      const { context, page } = await openStudio(browser());
      try {
        await layer(page, LIGHT_BOARD).click();
        const bar = artboardBar(page);
        // The trigger is read on the hidden bar too. A Select keeps its list mounted once its
        // trigger has had focus, so the trigger's expanded state, not the popup, tells closed.
        const opener = trigger(
          canvas(page).getByRole("toolbar", { name: "Artboard theme", exact: true, includeHidden: true })
        );
        await opener.click();
        const popup = find(page);
        await popup.waitFor({ state: "visible" });
        expect(await popup.evaluate((element) => element.contains(document.activeElement))).toBe(true);

        // A wheel over the artboard, clear of the popup, pans it up and out of the canvas.
        const board = await box(artboard(page, LIGHT_BOARD));
        await page.mouse.move(board.x + 10, board.y + board.height - 10);
        await page.mouse.wheel(0, 4000);
        await expect.poll(async () => bar.isVisible()).toBe(false);
        // Closed, not merely hidden, so it holds neither focus nor the next Escape.
        await expect.poll(async () => opener.getAttribute("aria-expanded")).toBe("false");
        expect(await isFocused(canvas(page))).toBe(true);

        await page.keyboard.press("Escape");
        await expect.poll(async () => layers(page).getByRole("button", { pressed: true }).count()).toBe(0);
      } finally {
        await context.close();
      }
    }
  );

  it("wraps its groups inside a narrow canvas at lg, keeping every control on the canvas and in the arrow-key order", async () => {
    const { context, page } = await openStudio(browser(), { viewport: LG, route: RUNGS_PAGE });
    try {
      await layer(page, PINNED_BOARD).click();
      const bar = artboardBar(page);
      await bar.waitFor({ state: "visible" });
      const brand = bar.getByRole("combobox", { name: "Brand", exact: true });
      for (const group of ["Variant", "Segment", "Scheme", "Density"]) {
        expect(await bar.getByRole("group", { name: group, exact: true }).count(), group).toBe(1);
      }
      const frame = await box(canvas(page));
      const controls = [...(await bar.getByRole("combobox").all()), ...(await bar.getByRole("button").all())];
      expect(controls.length).toBeGreaterThanOrEqual(13);
      for (const control of controls) {
        const label = (await control.getAttribute("aria-label")) ?? (await control.textContent()) ?? "";
        expect(inside(await box(control), frame), label).toBe(true);
      }

      // The arrow keys still run through every control in order, wrapping from the first, the
      // Brand Select, to the last, and on from the Brand Select into the Variant and Segment toggles.
      await brand.focus();
      await page.keyboard.press("ArrowLeft");
      expect(await isFocused(menuButton(bar, "Density"))).toBe(true);
      await page.keyboard.press("ArrowRight");
      expect(await isFocused(brand)).toBe(true);
      const variant = bar.getByRole("group", { name: "Variant", exact: true });
      await page.keyboard.press("ArrowRight");
      expect(await isFocused(variant.getByRole("button", { name: "Internal", exact: true }))).toBe(true);
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      const segment = bar.getByRole("group", { name: "Segment", exact: true });
      expect(await isFocused(segment.getByRole("button", { name: "Private", exact: true }))).toBe(true);
    } finally {
      await context.close();
    }
  });

  it("sits on its artboard again once an animated zoom-out glide lands", async () => {
    const { context, page } = await openStudio(browser(), { reducedMotion: "no-preference" });
    try {
      await layer(page, LIGHT_BOARD).click();
      await artboardBar(page).waitFor({ state: "visible" });
      await expect.poll(async () => canvas(page).getAttribute("data-gliding")).toBe("false");
      // Room above the artboard first, so the toolbar sits on it rather than pinned to the canvas.
      const framed = await box(artboard(page, LIGHT_BOARD));
      await page.mouse.move(framed.x + framed.width / 2, framed.y + framed.height / 2);
      await page.mouse.wheel(0, -60);
      await expect.poll(async () => (await box(artboard(page, LIGHT_BOARD))).y).toBeCloseTo(framed.y + 60, 0);
      await settleFrames(page);
      const start = await box(artboard(page, LIGHT_BOARD));

      // Ctrl+minus zooms out with a glide, shrinking the artboard around the canvas's centre,
      // inside its last box.
      await page.keyboard.press("ControlOrMeta+Minus");
      await expect.poll(async () => canvas(page).getAttribute("data-gliding")).toBe("true");
      await expect.poll(async () => canvas(page).getAttribute("data-gliding")).toBe("false");
      await settleFrames(page);
      const landed = await box(artboard(page, LIGHT_BOARD));
      expect(landed.width).toBeLessThan(start.width - 1);
      expect(landed.y).toBeGreaterThan(start.y);
      await expect.poll(async () => (await placement(page, LIGHT_BOARD)).gap).toBeCloseTo(ARTBOARD_GAP, 0);
      expect((await placement(page, LIGHT_BOARD)).offset).toBeCloseTo(0, 0);
    } finally {
      await context.close();
    }
  });

  it("follows a picked part that moves and resizes inside its artboard", async () => {
    const { context, page } = await openStudio(browser(), { reducedMotion: "no-preference" });
    try {
      // Framed alone, the artboard sits mid-canvas, so the bar centres over a part in it.
      await layer(page, LIGHT_BOARD).click();
      await expect.poll(async () => canvas(page).getAttribute("data-gliding")).toBe("false");
      const save = artboard(page, LIGHT_BOARD).getByRole("button", { name: "Save", exact: true });
      await save.click({ modifiers: ["Alt"] });
      const bar = partBar(page);
      await bar.waitFor({ state: "visible" });
      await expect.poll(async () => (await placementOver(page, bar, save)).gap).toBeCloseTo(PART_GAP, 0);
      expect((await placementOver(page, bar, save)).offset).toBeCloseTo(0, 0);
      const before = await box(save);

      // The dense metrics move the button up its artboard and shrink it.
      await inspector(page)
        .getByRole("group", { name: "Density", exact: true })
        .getByRole("button", { name: "Dense", exact: true })
        .click();
      await expect.poll(async () => (await box(save)).y).toBeLessThan(before.y - 1);
      expect((await box(save)).width).toBeLessThan(before.width - 1);
      await expect.poll(async () => (await placementOver(page, bar, save)).gap).toBeCloseTo(PART_GAP, 0);
      expect((await placementOver(page, bar, save)).offset).toBeCloseTo(0, 0);
    } finally {
      await context.close();
    }
  });

  it("is a stop in the F6 cycle whose arrow keys move between its controls", async () => {
    const { context, page } = await openStudio(browser());
    try {
      await layer(page, LIGHT_BOARD).click();
      const bar = artboardBar(page);
      await bar.waitFor({ state: "visible" });
      const focused = async () => bar.evaluate((element) => element === document.activeElement);
      for (let press = 0; press < 6 && !(await focused()); press++) {
        await page.keyboard.press("F6");
      }
      expect(await focused()).toBe(true);

      await page.keyboard.press("Tab");
      expect(await isFocused(bar.getByRole("combobox", { name: "Brand", exact: true }))).toBe(true);
      await page.keyboard.press("ArrowRight");
      const variant = bar.getByRole("group", { name: "Variant", exact: true });
      expect(await isFocused(variant.getByRole("button", { name: "Internal", exact: true }))).toBe(true);
    } finally {
      await context.close();
    }
  });

  it("wears the chrome's scheme while its artboard wears its own", async () => {
    const { context, page } = await openStudio(browser(), { colorScheme: "light" });
    try {
      await layer(page, DARK_BOARD).click();
      const bar = artboardBar(page);
      await bar.waitFor({ state: "visible" });
      expect(await colorScheme(artboard(page, DARK_BOARD))).toBe("dark");
      expect(await colorScheme(bar)).toBe("light");

      await page
        .getByRole("banner")
        .getByRole("group", { name: "Editor appearance", exact: true })
        .getByRole("button", { name: "Dark", exact: true })
        .click();
      await layer(page, LIGHT_BOARD).click();
      await expect.poll(() => colorScheme(bar)).toBe("dark");
      expect(await colorScheme(artboard(page, LIGHT_BOARD))).toBe("light");
    } finally {
      await context.close();
    }
  });

  it("does not render below lg, where the inspector Sheet edits the theme", async () => {
    const { context, page } = await openStudio(browser(), { viewport: PHONE });
    try {
      await page.getByRole("button", { name: "Pages and layers", exact: true }).click();
      const sheet = page.getByRole("dialog", { name: "Pages and layers" });
      await sheet.getByRole("button", { name: LIGHT_BOARD, exact: true }).click();
      await sheet.waitFor({ state: "detached" });
      await settleFrames(page);
      expect(await page.getByRole("toolbar", { name: "Artboard theme", includeHidden: true }).count()).toBe(
        0
      );
      expect(await page.getByRole("dialog", { name: "Theme toolbar", includeHidden: true }).count()).toBe(0);
    } finally {
      await context.close();
    }
  });
});
