import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT } from "./demo-page";
import { DASHBOARD_FIRST, dashboard, PHONE_VIEWPORT, row, searchTable } from "./landing-dashboard";
import { collectPageErrors, launchLandingSuite, TARGET_FLOOR_PX } from "./landing-page";
import { decodePng } from "./png";
import { box, isFocused } from "./studio/page";
import type { Box } from "./studio/page";

const { openLanding } = launchLandingSuite();

/** The sides of a box, in the order the side checks report them. */
const ALL_SIDES = ["top", "right", "bottom", "left"] as const;

type Side = (typeof ALL_SIDES)[number];

/** Both forced-colors modes, for the checks that hold in each. */
const FORCED_COLORS = ["none", "active"] as const;

type ForcedColors = (typeof FORCED_COLORS)[number];

/**
 * How far past a box a frame reaches. The picked brand tile's focus outline is 2px wide at a 6px
 * offset, so it ends 8px out.
 */
const FRAME_MARGIN_PX = 10;

/** How far into a box the `insideSides` band reaches, the width of the picked tile's border. */
const INSIDE_BAND_PX = 4;

/**
 * How far from each corner the side checks start. A focus outline follows the mark's 12px corner
 * radius, so near a corner it crosses the box's square edge. On a side shorter than three times
 * this, the check skips a third of the side at each end and samples the middle third.
 */
const CORNER_PX = 16;

/**
 * The smallest channel difference that counts as a change. Moving focus between rows shifts
 * antialiased text by one or two levels; an outline or a border in a system color moves a
 * channel by far more.
 */
const CHANGE_FLOOR = 40;

/** The landing's brand picker tiles. */
function brandTiles(page: Page): Locator {
  return page.getByRole("region", { name: /^Try it yourself/u }).getByRole("button");
}

/** The mark at the top of a brand tile, the box that draws the tile's focus and its picked cue. */
function tileMark(tile: Locator): Locator {
  return tile.locator("span").first();
}

/** Emulates `forcedColors` and checks that the page sees it. */
async function emulateForcedColors(page: Page, forcedColors: ForcedColors): Promise<void> {
  await page.emulateMedia({ forcedColors });
  expect(await page.evaluate(() => window.matchMedia("(forced-colors: active)").matches)).toBe(
    forcedColors === "active"
  );
}

/**
 * Focuses `control` after a key press, so it matches `:focus-visible` as a Tab would make it, and
 * checks that it does.
 */
async function focusByKeyboard(control: Locator): Promise<void> {
  await control.page().keyboard.press("Shift");
  await control.focus();
  expect(await control.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
}

/** Clicks `control` from a script, so no pointer leaves a hover face in a later shot. */
async function clickWithoutPointer(control: Locator): Promise<void> {
  await control.dispatchEvent("click");
}

/** Opens the Dashboard's Order search and waits for its table to load. */
async function openOrderSearch(page: Page): Promise<void> {
  const app = dashboard(page);
  await app.scrollIntoViewIfNeeded();
  await app.getByRole("button", { name: "Order search", exact: true }).click();
  await expect.poll(async () => searchTable(app).getAttribute("aria-busy")).toBeNull();
}

/** The button in Order search that opens the order numbered `id`. */
function searchOpener(page: Page, id: string): Locator {
  return searchTable(dashboard(page)).getByRole("button", { name: id, exact: true });
}

/** The Order search row an opener sits in. */
function tableRow(opener: Locator): Locator {
  return opener.locator("xpath=ancestor::tr[1]");
}

/** Makes an Order search opener's order current: it opens the detail Sheet, which Escape dismisses. */
async function pickOrder(opener: Locator): Promise<void> {
  await clickWithoutPointer(opener);
  const detail = opener.page().getByRole("dialog");
  await detail.waitFor();
  await opener.page().keyboard.press("Escape");
  await expect.poll(async () => detail.count()).toBe(0);
}

/**
 * Scrolls the table that holds `target`, a table row, to its far end, and returns the part of the
 * row the scroller still shows, in whole pixels.
 */
async function scrollRowToEnd(target: Locator): Promise<Box> {
  return target.evaluate((element) => {
    element.scrollIntoView({ block: "center", inline: "nearest" });
    let scroller = element.parentElement;
    while (scroller !== null && !["auto", "scroll"].includes(getComputedStyle(scroller).overflowX)) {
      scroller = scroller.parentElement;
    }
    if (scroller === null) throw new Error("expected the table inside a sideways scroller");
    scroller.scrollLeft = scroller.scrollWidth;
    const view = scroller.getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    const x = Math.ceil(Math.max(view.left, bounds.left));
    const y = Math.ceil(bounds.top);
    return {
      x,
      y,
      width: Math.floor(Math.min(view.right, bounds.right)) - x,
      height: Math.floor(bounds.bottom) - y,
    };
  });
}

/** A screenshot of a box and the margin around it, with where the box sits in the shot. */
type Frame = {
  readonly shot: Buffer;
  readonly box: Box;
  readonly inset: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
};

/**
 * Screenshots `element` with `FRAME_MARGIN_PX` around it. Given an earlier frame, it first checks
 * that the element has not moved, so the two frames show the same pixels.
 */
async function frame(element: Locator, sameAs?: Frame): Promise<Frame> {
  await element.scrollIntoViewIfNeeded();
  const bounds = await box(element);
  if (sameAs !== undefined) {
    expect(bounds).toEqual(sameAs.box);
  }
  const x = Math.round(bounds.x) - FRAME_MARGIN_PX;
  const y = Math.round(bounds.y) - FRAME_MARGIN_PX;
  const right = Math.round(bounds.x + bounds.width) + FRAME_MARGIN_PX;
  const bottom = Math.round(bounds.y + bounds.height) + FRAME_MARGIN_PX;
  const shot = await element
    .page()
    .screenshot({ clip: { x, y, width: right - x, height: bottom - y }, animations: "disabled" });
  return {
    shot,
    box: bounds,
    inset: {
      left: FRAME_MARGIN_PX,
      top: FRAME_MARGIN_PX,
      right: right - x - FRAME_MARGIN_PX,
      bottom: bottom - y - FRAME_MARGIN_PX,
    },
  };
}

/** Where a pixel sits in a shot. */
type Point = { readonly x: number; readonly y: number };

/** The pixels where two same-sized shots differ by at least `CHANGE_FLOOR` in some channel. */
function changedPoints(before: Buffer, after: Buffer): readonly Point[] {
  const a = decodePng(before);
  const b = decodePng(after);
  const points: Point[] = [];
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      const to = b.pixel(x, y);
      if (
        a.pixel(x, y).some((channel, index) => Math.abs(channel - (to[index] ?? channel)) >= CHANGE_FLOOR)
      ) {
        points.push({ x, y });
      }
    }
  }
  return points;
}

/**
 * The sides of `after`'s box that the change from `before` strokes whole: every column of the top
 * and bottom sides and every row of the left and right sides, corners aside. A changed pixel
 * counts for the side it lies nearest, at any depth inside or outside the box, so an outline
 * passes at any offset and a clipped stretch fails its side.
 */
function strokedSides(before: Frame, after: Frame): readonly Side[] {
  const { inset } = after;
  const along = {
    top: new Set<number>(),
    right: new Set<number>(),
    bottom: new Set<number>(),
    left: new Set<number>(),
  };
  for (const { x, y } of changedPoints(before.shot, after.shot)) {
    const distance = {
      top: Math.abs(y - inset.top),
      right: Math.abs(x - (inset.right - 1)),
      bottom: Math.abs(y - (inset.bottom - 1)),
      left: Math.abs(x - inset.left),
    };
    const nearest = Math.min(...Object.values(distance));
    for (const side of ALL_SIDES) {
      if (distance[side] === nearest) along[side].add(side === "top" || side === "bottom" ? x : y);
    }
  }
  const span = (start: number, end: number) => {
    const trim = Math.min(CORNER_PX, Math.floor((end - start) / 3));
    return { from: start + trim, to: end - trim };
  };
  const across = span(inset.left, inset.right);
  const down = span(inset.top, inset.bottom);
  const spans = { top: across, bottom: across, left: down, right: down };
  return ALL_SIDES.filter((side) => {
    const { from, to } = spans[side];
    if (from >= to) throw new Error(`expected the ${side} side to leave pixels to check`);
    for (let position = from; position < to; position += 1) {
      if (!along[side].has(position)) return false;
    }
    return true;
  });
}

/**
 * The sides of `after`'s box where it differs from `before` in the `INSIDE_BAND_PX` band just
 * inside the box, corners aside.
 */
function insideSides(before: Frame, after: Frame): readonly Side[] {
  const { inset } = after;
  const changed = new Set<Side>();
  for (const { x, y } of changedPoints(before.shot, after.shot)) {
    const inside = x >= inset.left && x < inset.right && y >= inset.top && y < inset.bottom;
    const nearCorner =
      (x < inset.left + CORNER_PX || x >= inset.right - CORNER_PX) &&
      (y < inset.top + CORNER_PX || y >= inset.bottom - CORNER_PX);
    if (!inside || nearCorner) {
      continue;
    }
    if (y < inset.top + INSIDE_BAND_PX) changed.add("top");
    if (x >= inset.right - INSIDE_BAND_PX) changed.add("right");
    if (y >= inset.bottom - INSIDE_BAND_PX) changed.add("bottom");
    if (x < inset.left + INSIDE_BAND_PX) changed.add("left");
  }
  return ALL_SIDES.filter((side) => changed.has(side));
}

describe("landing page", () => {
  it("swaps the Components menu's stage as its entry links take hover or keyboard focus", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);

    await page.getByRole("button", { name: "Components", exact: true }).click();
    // The menu panel has no role, so it is found by its slot. The density demo in
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

  it("floats the bulk action bar clear of Order search's pagination and returns focus when it clears", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { search: DASHBOARD_FIRST });
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    await app.getByRole("button", { name: "Order search", exact: true }).click();
    const table = searchTable(app);
    await expect.poll(async () => table.getAttribute("aria-busy")).toBeNull();

    // Row 0 is the header, whose checkbox selects the whole page.
    const checkbox = table.getByRole("row").nth(1).getByRole("checkbox");
    await checkbox.click();
    const bar = app.getByRole("toolbar", { name: "Bulk actions" });
    await bar.waitFor();
    expect(await bar.textContent()).toContain("1\u00a0selected");
    // The bar sits wholly above the pagination row, so it covers none of its controls.
    const barBox = await bar.boundingBox();
    const pageControls = await app.getByRole("button", { name: "Go to next page" }).boundingBox();
    if (barBox === null || pageControls === null)
      throw new Error("expected the bar and the pagination on screen");
    expect(barBox.y + barBox.height).toBeLessThan(pageControls.y);

    await bar.getByRole("button", { name: "Clear selection" }).click();
    await expect.poll(async () => bar.count()).toBe(0);
    expect(await checkbox.isChecked()).toBe(false);
    expect(await checkbox.evaluate((element) => element === document.activeElement)).toBe(true);
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

  // Each row is a focus an ancestor can clip: the phone's brand rail scrolls sideways and clips
  // its block axis too, and the product shot's window clips its tab panel. `indicator` is the box
  // that draws the focus, when that is not the control. The current-row test below checks the
  // focus of a Dashboard queue row, which its list clips.
  it.each<{
    readonly control: string;
    readonly forcedColors: ForcedColors;
    readonly viewport: { readonly width: number; readonly height: number };
    readonly target: (page: Page) => Locator;
    readonly indicator?: (target: Locator) => Locator;
  }>([
    // The landing opens on Elmera, the first tile, so it is picked.
    ...FORCED_COLORS.map((forcedColors) => ({
      control: "the picked brand tile on a phone",
      forcedColors,
      viewport: PHONE_VIEWPORT,
      target: (page: Page) => brandTiles(page).first(),
      indicator: tileMark,
    })),
    {
      control: "a brand tile",
      forcedColors: "active",
      viewport: DESKTOP_VIEWPORT,
      target: (page) => brandTiles(page).nth(1),
      indicator: tileMark,
    },
    // The panel is taller than the desktop viewport less the sticky header, so the viewport is taller here.
    ...FORCED_COLORS.map((forcedColors) => ({
      control: "the product shot's tab panel",
      forcedColors,
      viewport: { width: 1280, height: 1000 },
      target: (page: Page) => page.getByRole("tabpanel", { name: "Overview" }),
    })),
  ])(
    "shows the full keyboard focus indicator on $control (forced colors: $forcedColors)",
    async ({ forcedColors, viewport, target, indicator }) => {
      const page = await openLanding(viewport);
      await emulateForcedColors(page, forcedColors);
      const control = target(page);
      const drawn = indicator?.(control) ?? control;

      const resting = await frame(drawn);
      await focusByKeyboard(control);
      const focused = await frame(drawn, resting);

      expect(strokedSides(resting, focused)).toEqual(ALL_SIDES);
      await page.context().close();
    }
  );

  it.each(FORCED_COLORS)(
    "scrolls the brand tile Tab reaches on a phone into the rail and shows its full keyboard focus indicator (forced colors: %s)",
    async (forcedColors) => {
      const page = await openLanding(PHONE_VIEWPORT);
      await emulateForcedColors(page, forcedColors);
      const tiles = brandTiles(page);
      const next = tileMark(tiles.nth(1));
      await focusByKeyboard(tiles.first());
      // On a 390px phone the second tile starts 316px in, so 74px of it shows before the Tab.
      await page.keyboard.press("Tab");
      expect(await isFocused(tiles.nth(1))).toBe(true);

      // The frame around the mark holds its focus outline, so the rail must show all of it.
      const inRail = await next.evaluate((mark, margin) => {
        const rail = mark.closest(".landing-rail")?.getBoundingClientRect();
        const bounds = mark.getBoundingClientRect();
        return rail !== undefined && bounds.left - margin >= rail.left && bounds.right + margin <= rail.right;
      }, FRAME_MARGIN_PX);
      expect(inRail).toBe(true);

      const focused = await frame(next);
      await tiles.nth(1).blur();
      const resting = await frame(next, focused);
      expect(strokedSides(resting, focused)).toEqual(ALL_SIDES);
      await page.context().close();
    }
  );

  it.each(FORCED_COLORS)(
    "shows separate selection and keyboard focus indicators on the picked brand tile (forced colors: %s)",
    async (forcedColors) => {
      const page = await openLanding(DESKTOP_VIEWPORT);
      await emulateForcedColors(page, forcedColors);
      const tiles = brandTiles(page);
      // The landing opens on Elmera, the first tile.
      const picked = tiles.first();
      expect(await picked.getAttribute("aria-pressed")).toBe("true");
      expect(await tiles.nth(1).getAttribute("aria-pressed")).toBe("false");

      const pickedResting = await frame(tileMark(picked));
      const unpicked = await frame(tileMark(tiles.nth(1)));
      // The suite blocks the brand mark artwork in both modes, so each mark is an empty box. Forced
      // colors also drop the picked tile's fill, so there only a cue of its own sets it apart.
      expect(insideSides(unpicked, pickedResting)).toEqual(ALL_SIDES);

      await focusByKeyboard(picked);
      const pickedFocused = await frame(tileMark(picked), pickedResting);
      // Focus adds an outline and leaves the picked cue inside the mark as it was.
      expect(strokedSides(pickedResting, pickedFocused)).toEqual(ALL_SIDES);
      expect(insideSides(pickedResting, pickedFocused)).toEqual([]);
      await page.context().close();
    }
  );

  // Order search's current row is the table row holding the opener with `aria-current`. Each view
  // has a `control` that takes focus and opens the order, and a `current` box that carries the cue.
  it.each<{
    readonly view: string;
    readonly colorScheme: "light" | "dark";
    readonly prepare?: (page: Page) => Promise<void>;
    readonly target: (page: Page) => Locator;
    readonly current?: (target: Locator) => Locator;
    readonly pick: (control: Locator) => Promise<void>;
  }>(
    (["light", "dark"] as const).flatMap((colorScheme) => [
      {
        view: "the Dashboard queue",
        colorScheme,
        // The landing opens with the first row current, so this one is not.
        target: (page: Page) => row(dashboard(page), "Camilla Røed"),
        pick: clickWithoutPointer,
      },
      {
        view: "Order search",
        colorScheme,
        prepare: openOrderSearch,
        target: (page: Page) => searchOpener(page, "284133"),
        current: tableRow,
        pick: pickOrder,
      },
    ])
  )(
    "shows the current row of $view and its keyboard focus apart in forced-colors mode ($colorScheme)",
    async ({ colorScheme, prepare, target, current, pick }) => {
      const page = await openLanding(DESKTOP_VIEWPORT, { search: DASHBOARD_FIRST, colorScheme });
      await prepare?.(page);
      await emulateForcedColors(page, "active");
      const control = target(page);
      const cue = current?.(control) ?? control;
      expect(await control.getAttribute("aria-current")).toBe("false");

      // Where the row is the control, one frame shows both, so the row reuses the control's.
      const shoot = async (sameAs?: { readonly control: Frame; readonly row: Frame }) => {
        const shot = await frame(control, sameAs?.control);
        return { control: shot, row: current === undefined ? shot : await frame(cue, sameAs?.row) };
      };
      const resting = await shoot();
      await focusByKeyboard(control);
      const focused = await shoot(resting);
      await control.blur();
      await pick(control);
      expect(await control.getAttribute("aria-current")).toBe("true");
      await control.blur();
      const currentResting = await shoot(resting);
      await focusByKeyboard(control);
      const currentFocused = await shoot(resting);

      // Focus outlines the control whole, whether its order is current or not.
      expect(strokedSides(resting.control, focused.control)).toEqual(ALL_SIDES);
      expect(strokedSides(currentResting.control, currentFocused.control)).toEqual(ALL_SIDES);
      // Forced colors drop the current row's fill, so only a cue of its own tells the two apart,
      // and the cue still shows while the row has focus.
      expect(changedPoints(resting.row.shot, currentResting.row.shot).length).toBeGreaterThan(0);
      expect(changedPoints(focused.row.shot, currentFocused.row.shot).length).toBeGreaterThan(0);
      await page.context().close();
    }
  );

  it("keeps the current Order search row's cue in view when the table scrolls sideways on a phone", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { search: DASHBOARD_FIRST });
    await openOrderSearch(page);
    await page.setViewportSize(PHONE_VIEWPORT);
    await emulateForcedColors(page, "active");
    const opener = searchOpener(page, "284133");
    await pickOrder(opener);
    expect(await opener.getAttribute("aria-current")).toBe("true");
    const currentClip = await scrollRowToEnd(tableRow(opener));
    // The opener's column scrolls out of view, and the row's last columns stay.
    expect(await opener.evaluate((element) => element.getBoundingClientRect().right)).toBeLessThan(
      currentClip.x
    );
    const current = await page.screenshot({ clip: currentClip, animations: "disabled" });

    await pickOrder(searchOpener(page, "284127"));
    expect(await opener.getAttribute("aria-current")).toBe("false");
    const clip = await scrollRowToEnd(tableRow(opener));
    expect(clip).toEqual(currentClip);
    const notCurrent = await page.screenshot({ clip, animations: "disabled" });
    expect(changedPoints(notCurrent, current).length).toBeGreaterThan(0);
    await page.context().close();
  });

  it("checks a current Order search row's checkbox from a press at the edge of its target in forced-colors mode", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { search: DASHBOARD_FIRST });
    await openOrderSearch(page);
    await emulateForcedColors(page, "active");
    const opener = searchOpener(page, "284133");
    await pickOrder(opener);
    const checkbox = tableRow(opener).getByRole("checkbox");
    const bounds = await box(checkbox);
    // A press that opens the detail Sheet hides the table from roles, so the check reads the
    // element it found before the press.
    const element = await checkbox.elementHandle();

    // The checkbox is 16px wide and its target `TARGET_FLOOR_PX`, so a press half a pixel inside
    // the target's left edge misses the checkbox and still lands on its target.
    const edge = TARGET_FLOOR_PX / 2 - 0.5;
    await page.mouse.click(bounds.x + bounds.width / 2 - edge, bounds.y + bounds.height / 2);
    expect(await element.getAttribute("aria-checked")).toBe("true");
    expect(await page.getByRole("dialog").count()).toBe(0);
    await page.context().close();
  });

  it("keeps the Dashboard's sidebar inside the window, out of the cookie and off the page's ⌘B", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { search: DASHBOARD_FIRST });
    const app = dashboard(page);
    // The rail and its state markers have no role, so they are found by their slots.
    const rail = app.locator("[data-slot='sidebar-container']");
    const state = () => app.locator("[data-slot='sidebar'][data-state]").getAttribute("data-state");
    const appBox = await app.boundingBox();
    const railBox = await rail.boundingBox();
    expect(railBox?.y).toBe(appBox?.y);
    expect(railBox?.height).toBe(appBox?.height);
    expect(await state()).toBe("expanded");

    await page.getByRole("button", { name: "Copy", exact: true }).focus();
    await page.keyboard.press("ControlOrMeta+b");
    expect(await state()).toBe("expanded");

    await row(app, "Jonas Eide").focus();
    await page.keyboard.press("ControlOrMeta+b");
    await expect.poll(state).toBe("collapsed");
    const cookies = await page.context().cookies();
    expect(cookies.map((cookie) => cookie.name)).not.toContain("sidebar:state");
    await page.context().close();
  });
});
