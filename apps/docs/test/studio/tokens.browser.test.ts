import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import * as CssColor from "@elmeragroup/color/css-color";
import * as Hex from "@elmeragroup/color/hex";

import { MAX_SHARE_LENGTH } from "../../src/studio/lib/size-policy";
import { STUDIO_TOKEN_NAMES, TOKEN_TABLE, isLightOnly } from "../../src/studio/lib/tokens";
import { auditTargets, holdChunks } from "../landing-page";
import type { HeldChunks } from "../landing-page";
import { launchSuiteBrowser } from "../suite-browser";
import {
  DENSITY_PAGE,
  artboard,
  background,
  frames,
  hashOf,
  inspector,
  layers,
  openStudioIn,
  openStudio as openStudioPage,
  openTokenSection,
  setMetric,
  setTokenColor,
  tokenRow,
} from "./page";
import type { StudioPage, StudioRoute } from "./page";

const browser = launchSuiteBrowser();

const COMPONENT_BOARDS = [
  "Components · Light · Comfortable",
  "Components · Dark · Comfortable",
  "Components · Light · Dense",
  "Components · Dark · Dense",
] as const;

const LIGHT_BOARD = COMPONENT_BOARDS[0];
const DARK_BOARD = COMPONENT_BOARDS[1];

const RED = "rgb(255, 0, 0)";
const BLUE = "rgb(0, 0, 255)";

/** Every scheme-dependent color token, the ones a long share hash can fill. */
const SCHEME_COLORS = STUDIO_TOKEN_NAMES.filter(
  (name) => TOKEN_TABLE[name].kind === "color" && !isLightOnly(name)
);

/** A generated seed module's chunk: each seed holds radius-button with its declared CSS. */
const SEED_CHUNK = /"radius-button":\{"?css"?:/u;

/** The light selector the export writes for the studio's opening theme, external elma private. */
const OPENING_SELECTOR =
  '[data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"]';

/** The Density page's light twin, which holds a primary Save button. */
const DENSITY_TWIN = "Twin · Dense";

/** Hides the Navigation API before the studio loads, as browsers without it run the studio. */
async function withoutNavigationApi(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "navigation");
    Reflect.deleteProperty(Window.prototype, "navigation");
  });
}

/** Reloads the page and waits, as `openStudioIn` does, for it to hydrate and frame the Overview. */
async function reloadStudio(page: Page): Promise<void> {
  await page.reload({ waitUntil: "load" });
  await page.locator("next-route-announcer").waitFor({ state: "attached" });
  await artboard(page, LIGHT_BOARD).waitFor({ state: "visible" });
}

/** Opens a studio page, `/studio` by default, with `hash` in a fresh desktop context the test closes. */
async function openStudio(
  hash = "",
  prepare?: (page: Page) => Promise<void>,
  route?: StudioRoute
): Promise<StudioPage> {
  return openStudioPage(browser(), { hash, prepare, route });
}

function saveButton(page: Page, board: string): Locator {
  return artboard(page, board).getByRole("button", { name: "Save", exact: true });
}

function colorTrigger(page: Page, name: string): Locator {
  return tokenRow(page, name).getByRole("button", { name: `Edit --${name}`, exact: true });
}

/** The short value a color knob's trigger shows. */
async function shownValue(page: Page, name: string): Promise<string> {
  return ((await colorTrigger(page, name).textContent()) ?? "").trim();
}

async function closeSection(page: Page, title: string): Promise<void> {
  const trigger = inspector(page).getByRole("button", { name: title, exact: false }).first();
  if ((await trigger.getAttribute("aria-expanded")) === "true") {
    await trigger.click();
  }
}

/** The element's box once it holds still across two frames, as after a section opens. */
async function settledBox(locator: Locator) {
  await locator.waitFor({ state: "visible" });
  let previous = "";
  for (;;) {
    const box = await locator.boundingBox();
    const current = JSON.stringify(box);
    if (current === previous) {
      return box;
    }
    previous = current;
    await locator.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        })
    );
  }
}

/** Drags a slider knob's thumb to `fraction` of its track, in one press. */
async function dragSlider(page: Page, name: string, fraction: number): Promise<void> {
  const row = tokenRow(page, name);
  const thumb = await settledBox(row.locator('[data-slot="slider-thumb"]'));
  const track = await settledBox(row.locator('[data-slot="slider-control"]'));
  if (thumb === null || track === null) {
    throw new Error(`the --${name} slider has no box`);
  }
  const y = thumb.y + thumb.height / 2;
  await page.mouse.move(thumb.x + thumb.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width * fraction, y, { steps: 5 });
  await page.mouse.up();
}

/**
 * Counts the token editor's color resolutions from now on: `getComputedStyle` reads of the
 * probe's spans, one per color token, which carry `data-token`.
 */
async function countColorReads(page: Page): Promise<() => Promise<number>> {
  await page.evaluate(() => {
    sessionStorage.setItem("colorReads", "0");
    const read = window.getComputedStyle.bind(window);
    window.getComputedStyle = (element, pseudo) => {
      if (element instanceof HTMLElement && element.dataset.token !== undefined) {
        sessionStorage.setItem("colorReads", String(Number(sessionStorage.getItem("colorReads")) + 1));
      }
      return read(element, pseudo);
    };
  });
  return async () => page.evaluate(() => Number(sessionStorage.getItem("colorReads")));
}

/** A computed color as `#RRGGBB`, or the text itself when it is not one the parser reads. */
function opaqueHex(computed: string): string {
  const parsed = CssColor.parse(computed);
  return parsed._tag === "ok" ? Hex.formatOpaque(CssColor.toSrgb(parsed.value)) : computed;
}

async function blurFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
}

describe("studio token editing", () => {
  it("edits --primary on light artboards only, and undo restores it", async () => {
    const { context, page, errors } = await openStudio();
    try {
      const lightBefore = await background(saveButton(page, LIGHT_BOARD));
      const darkBefore = await background(saveButton(page, DARK_BOARD));
      expect(lightBefore).not.toBe(RED);

      await openTokenSection(page, "Actions");
      await setTokenColor(page, "primary", "#ff0000");

      await expect.poll(() => background(saveButton(page, LIGHT_BOARD))).toBe(RED);
      expect(await background(saveButton(page, "Components · Light · Dense"))).toBe(RED);
      expect(await background(saveButton(page, DARK_BOARD))).toBe(darkBefore);

      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(() => background(saveButton(page, LIGHT_BOARD))).toBe(lightBefore);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("rounds the Card in every artboard, light and dark, from the radius slider", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Shape");
      await tokenRow(page, "radius").getByRole("slider", { name: "--radius", exact: true }).focus();
      // The radius slider ends at 40px, and a Card rounds with `rounded-lg`, the radius itself.
      await page.keyboard.press("End");
      for (const board of COMPONENT_BOARDS) {
        const card = artboard(page, board).locator('[data-slot="card"]').first();
        await expect
          .poll(() => card.evaluate((element) => getComputedStyle(element).borderTopLeftRadius), {
            message: board,
          })
          .toBe("40px");
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("moves the --destructive alias with an --error edit on the artboard scope", async () => {
    const { context, page, errors } = await openStudio();
    try {
      const board = artboard(page, LIGHT_BOARD);
      const deleteButton = board.getByRole("button", { name: "Delete", exact: true });
      const before = await deleteButton.evaluate((element) => getComputedStyle(element).color);

      await openTokenSection(page, "Status");
      await setTokenColor(page, "error", "#ff0000");

      // `--destructive: var(--error)` is declared on `:root` in light, so the studio restates it
      // on the scope, where it resolves against the edit.
      await expect
        .poll(() =>
          board.evaluate((element) => getComputedStyle(element).getPropertyValue("--destructive").trim())
        )
        .toBe("#ff0000");
      // The destructive Button's text is `text-error`.
      await expect.poll(() => deleteButton.evaluate((element) => getComputedStyle(element).color)).toBe(RED);
      expect(before).not.toBe(RED);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("marks a foreground that matches its surface as failing contrast", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Actions");
      const mark = tokenRow(page, "primary-foreground").locator("[data-contrast]");
      await expect.poll(() => mark.getAttribute("data-contrast")).toBe("pass");

      await setTokenColor(page, "primary", "#ff0000");
      await setTokenColor(page, "primary-foreground", "#ff0000");

      await expect.poll(() => mark.getAttribute("data-contrast")).toBe("fail");
      expect(await mark.textContent()).toBe("Fail 1.00:1");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("exports the edited declarations as CSS", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Actions");
      await setTokenColor(page, "primary", "#ff0000");
      await page.getByRole("banner").getByRole("button", { name: "Export", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Export CSS" });
      const css = (await dialog.getByRole("region", { name: "Exported CSS" }).textContent()) ?? "";
      expect(css).toContain(`${OPENING_SELECTOR} {\n  --primary: #ff0000;\n}`);
      expect(css).toContain(
        `[data-theme="dark"] ${OPENING_SELECTOR},\n${OPENING_SELECTOR}[data-theme="dark"] {`
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("restores the edits from the share hash, and from the autosave without it", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Actions");
      await setTokenColor(page, "primary", "#ff0000");
      await page.waitForFunction(() => window.location.hash.length > 1);
      const hash = await page.evaluate(() => window.location.hash);

      // A fresh context has no autosave, so only the hash can restore the edit.
      const shared = await openStudio(hash);
      try {
        await expect.poll(() => background(saveButton(shared.page, LIGHT_BOARD))).toBe(RED);
        expect(shared.errors).toEqual([]);
      } finally {
        await shared.context.close();
      }

      // The same context, without the hash: the autosave restores it.
      const reloaded = await openStudioIn(context);
      await expect.poll(() => background(saveButton(reloaded.page, LIGHT_BOARD))).toBe(RED);
      expect([...errors, ...reloaded.errors]).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("keeps the share hash on the address after a page link, so it restores the edits", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Actions");
      await setTokenColor(page, "primary", "#ff0000");
      await page.waitForFunction(() => window.location.hash.length > 1);
      await layers(page).getByRole("link", { name: "Density", exact: true }).click();
      await artboard(page, DENSITY_TWIN).waitFor({ state: "visible" });
      await expect.poll(() => new URL(page.url()).pathname).toBe("/studio/density");
      await expect.poll(() => new URL(page.url()).hash).not.toBe("");

      // A fresh context has no autosave, so only the copied address can restore the edit.
      const url = new URL(page.url());
      const shared = await openStudio(url.hash, undefined, { path: url.pathname, artboard: DENSITY_TWIN });
      try {
        await expect.poll(() => background(saveButton(shared.page, DENSITY_TWIN))).toBe(RED);
        expect(shared.errors).toEqual([]);
      } finally {
        await shared.context.close();
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("keeps the share hash on the address after a click on the current page's row", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Actions");
      await setTokenColor(page, "primary", "#ff0000");
      await page.waitForFunction(() => window.location.hash.length > 1);
      const shared = new URL(page.url()).hash;
      // The same pathname, so only the navigation itself shows the click went through.
      await page.evaluate(() => {
        window.navigation.addEventListener(
          "navigatesuccess",
          () => {
            document.documentElement.dataset.navigated = "";
          },
          { once: true }
        );
      });
      await layers(page).getByRole("link", { name: "Overview", exact: true }).click();
      await page.locator("html[data-navigated]").waitFor({ state: "attached" });
      await page.waitForTimeout(600);
      expect(new URL(page.url()).pathname).toBe("/studio");
      expect(new URL(page.url()).hash).toBe(shared);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("keeps the share hash on a same-page click without the Navigation API", async () => {
    const { context, page, errors } = await openStudio("", withoutNavigationApi);
    try {
      expect(await page.evaluate(() => "navigation" in window)).toBe(false);
      await openTokenSection(page, "Actions");
      await setTokenColor(page, "primary", "#ff0000");
      await page.waitForFunction(() => window.location.hash.length > 1);
      const shared = new URL(page.url()).hash;
      const entries = await page.evaluate(() => window.history.length);
      await layers(page).getByRole("link", { name: "Overview", exact: true }).click();
      // The router pushes an entry for the address without the hash, so the click went through.
      await page.waitForFunction((before) => window.history.length > before, entries);
      await page.waitForTimeout(600);
      expect(new URL(page.url()).pathname).toBe("/studio");
      expect(new URL(page.url()).hash).toBe(shared);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("puts the newest share text on the address after Back, so a reload keeps the newest edits", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Actions");
      await setTokenColor(page, "primary", "#ff0000");
      await page.waitForFunction(() => window.location.hash.length > 1);
      const older = new URL(page.url()).hash;
      await layers(page).getByRole("link", { name: "Density", exact: true }).click();
      await artboard(page, DENSITY_TWIN).waitFor({ state: "visible" });
      await openTokenSection(page, "Actions");
      await setTokenColor(page, "primary", "#0000ff");
      await expect.poll(() => new URL(page.url()).hash).not.toBe(older);
      const newest = new URL(page.url()).hash;

      await page.goBack();
      await expect.poll(() => new URL(page.url()).pathname).toBe("/studio");
      await expect.poll(() => new URL(page.url()).hash).toBe(newest);
      await page.waitForTimeout(600);
      expect(new URL(page.url()).hash).toBe(newest);

      await reloadStudio(page);
      await expect.poll(() => background(saveButton(page, LIGHT_BOARD))).toBe(BLUE);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("leaves no stale share hash on the address after Reset all and Back", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Actions");
      await setTokenColor(page, "primary", "#ff0000");
      await page.waitForFunction(() => window.location.hash.length > 1);
      await layers(page).getByRole("link", { name: "Density", exact: true }).click();
      await artboard(page, DENSITY_TWIN).waitFor({ state: "visible" });
      await page.getByRole("banner").getByRole("button", { name: "Reset all", exact: true }).click();
      await page
        .getByRole("alertdialog", { name: "Reset every edit?" })
        .getByRole("button", { name: "Reset all", exact: true })
        .click();
      await expect.poll(() => new URL(page.url()).hash).toBe("");

      await page.goBack();
      await expect.poll(() => new URL(page.url()).pathname).toBe("/studio");
      await expect.poll(() => new URL(page.url()).hash).toBe("");
      await page.waitForTimeout(600);
      expect(new URL(page.url()).hash).toBe("");

      await reloadStudio(page);
      await expect.poll(() => background(saveButton(page, LIGHT_BOARD))).not.toBe(RED);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("keeps the token editor's controls at the 24px target floor", async () => {
    const { context, page, errors } = await openStudio();
    try {
      // Edits show each row's reset; the sections hold every kind of knob, an alias chip and a
      // contrast mark.
      await openTokenSection(page, "Actions");
      await setTokenColor(page, "primary", "#ff0000");
      await openTokenSection(page, "Shape");
      await openTokenSection(page, "Typography");
      await tokenRow(page, "radius").getByRole("slider", { name: "--radius", exact: true }).focus();
      await page.keyboard.press("End");
      const audit = await auditTargets(inspector(page));
      expect(audit.targets).toBeGreaterThan(0);
      // The audit probes the range input Base UI nests in each slider thumb, so its presses land
      // on the thumb around it. The thumb is the target, checked below as Fuse's Slider test does.
      const sliders = await inspector(page)
        .getByRole("slider")
        .evaluateAll((inputs) => inputs.map((input) => input.getAttribute("aria-label") ?? ""));
      expect(sliders.length).toBeGreaterThan(0);
      expect(audit.misses.filter((miss) => !sliders.some((name) => miss.startsWith(`${name} at `)))).toEqual(
        []
      );
      const thumbMisses = await inspector(page)
        .locator('[data-slot="slider-thumb"]')
        .evaluateAll((thumbs) =>
          thumbs.flatMap((thumb) => {
            thumb.scrollIntoView({ block: "center" });
            const box = thumb.getBoundingClientRect();
            const x = box.left + box.width / 2;
            const y = box.top + box.height / 2;
            // The sampled corners sit half a pixel inside the 24px square.
            const reach = 24 / 2 - 0.5;
            return [
              [-reach, -reach],
              [reach, -reach],
              [-reach, reach],
              [reach, reach],
            ].flatMap(([dx = 0, dy = 0]) => {
              const hit = document.elementFromPoint(x + dx, y + dy);
              return hit !== null && thumb.contains(hit)
                ? []
                : [`${thumb.textContent} ${String(dx)},${String(dy)}`];
            });
          })
        );
      expect(thumbMisses).toEqual([]);

      await tokenRow(page, "primary").getByRole("button", { name: "Edit --primary", exact: true }).click();
      const popover = page.getByRole("dialog", { name: "--primary" });
      await popover.waitFor({ state: "visible" });
      expect((await auditTargets(popover)).misses).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("ignores a corrupt hash with a toast and stays usable", async () => {
    const { context, page, errors } = await openStudio("#1.not-a-studio-link");
    try {
      await expect
        .poll(() => page.getByText("The link's edits could not be read", { exact: true }).isVisible())
        .toBe(true);
      await openTokenSection(page, "Actions");
      await setTokenColor(page, "primary", "#ff0000");
      await expect.poll(() => background(saveButton(page, LIGHT_BOARD))).toBe(RED);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("makes one undo step per slider drag, also across a collapsed and reopened section", async () => {
    const { context, page, errors } = await openStudio();
    try {
      const card = artboard(page, LIGHT_BOARD).locator('[data-slot="card"]').first();
      const radius = () => card.evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
      const before = await radius();

      await openTokenSection(page, "Shape");
      await dragSlider(page, "radius", 0.25);
      await expect.poll(radius).not.toBe(before);
      const first = await radius();
      // The closed panel unmounts the knob once its exit ends; reopening mounts a new one.
      await closeSection(page, "Shape");
      await tokenRow(page, "radius").waitFor({ state: "detached" });
      await openTokenSection(page, "Shape");
      await dragSlider(page, "radius", 0.75);
      await expect.poll(radius).not.toBe(first);

      await blurFocus(page);
      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(radius).toBe(first);
      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(radius).toBe(before);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("makes one undo step per typing burst on the same field", async () => {
    const { context, page, errors } = await openStudio();
    try {
      const before = await background(saveButton(page, LIGHT_BOARD));
      await openTokenSection(page, "Actions");
      await setTokenColor(page, "primary", "#ff0000");
      await setTokenColor(page, "primary", "#00ff00");
      await expect.poll(() => background(saveButton(page, LIGHT_BOARD))).toBe("rgb(0, 255, 0)");

      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(() => background(saveButton(page, LIGHT_BOARD))).toBe(RED);
      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(() => background(saveButton(page, LIGHT_BOARD))).toBe(before);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("makes one undo step per stepper press on a number field", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Shape");
      const row = tokenRow(page, "radius");
      const field = row.getByRole("textbox", { name: "--radius in px", exact: true });
      const increase = row.getByRole("button", { name: "Increase", exact: true });
      const before = await field.inputValue();
      await increase.click();
      await expect.poll(() => field.inputValue()).not.toBe(before);
      const first = await field.inputValue();
      await increase.click();
      await expect.poll(() => field.inputValue()).not.toBe(first);

      await blurFocus(page);
      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(() => field.inputValue()).toBe(first);
      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(() => field.inputValue()).toBe(before);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("makes one undo step per arrow key press on a number field, and one for a held key", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Shape");
      const field = tokenRow(page, "radius").getByRole("textbox", { name: "--radius in px", exact: true });
      const before = await field.inputValue();
      await field.focus();
      await page.keyboard.press("ArrowUp");
      await expect.poll(() => field.inputValue()).not.toBe(before);
      const first = await field.inputValue();
      // A held key: repeated keydowns, then one keyup.
      await page.keyboard.down("ArrowUp");
      await page.keyboard.down("ArrowUp");
      await page.keyboard.down("ArrowUp");
      await page.keyboard.up("ArrowUp");
      await expect.poll(() => field.inputValue()).not.toBe(first);

      await blurFocus(page);
      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(() => field.inputValue()).toBe(first);
      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(() => field.inputValue()).toBe(before);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("shows the seeded font weight in the weight knob's field when the seed loads late", async () => {
    const held = Promise.withResolvers<HeldChunks>();
    const { context, page, errors } = await openStudio("", async (opening) => {
      // Holds the seed chunk until the test releases it, so the knob first renders with no value.
      held.resolve(await holdChunks(opening, SEED_CHUNK));
    });
    const { caught, release } = await held.promise;
    try {
      await expect.poll(() => caught().length).toBeGreaterThan(0);
      await openTokenSection(page, "Typography");
      const row = tokenRow(page, "selection-title-weight");
      const slider = row.getByRole("slider", { name: "--selection-title-weight", exact: true });
      const field = row.getByRole("textbox", { name: "--selection-title-weight value", exact: true });
      await field.waitFor();
      expect(await field.isDisabled()).toBe(true);
      expect(await field.inputValue()).toBe("");

      release();
      await expect.poll(() => field.isDisabled()).toBe(false);
      // external-palettes.ts: every external theme declares selection-title-weight: 500.
      expect(await field.inputValue()).toBe("500");
      expect(await slider.inputValue()).toBe("500");
      expect(errors).toEqual([]);
    } finally {
      release();
      await context.close();
    }
  });

  it("makes one undo step per Home or End press on a number field", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Shape");
      const field = tokenRow(page, "radius").getByRole("textbox", { name: "--radius in px", exact: true });
      const before = await field.inputValue();
      await field.focus();
      await page.keyboard.press("End");
      await expect.poll(() => field.inputValue()).not.toBe(before);
      const end = await field.inputValue();
      await page.keyboard.press("Home");
      await expect.poll(() => field.inputValue()).not.toBe(end);

      await blurFocus(page);
      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(() => field.inputValue()).toBe(end);
      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(() => field.inputValue()).toBe(before);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("refuses a reset that would loop two tokens, with a toast, and keeps the edits", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Actions");
      await openTokenSection(page, "Status");
      // The base theme declares destructive: var(--error).
      await setTokenColor(page, "destructive", "#ff0000");
      await setTokenColor(page, "error", "var(--destructive)");
      await tokenRow(page, "destructive")
        .getByRole("button", { name: "Reset --destructive", exact: true })
        .click();

      await page
        .getByText("That change would loop tokens through each other", { exact: true })
        .first()
        .waitFor();
      expect(await shownValue(page, "destructive")).toBe("#FF0000");
      expect(await shownValue(page, "error")).toBe("→ destructive");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("undoes with the keyboard while the slider keeps focus", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Shape");
      const slider = tokenRow(page, "radius").getByRole("slider", { name: "--radius", exact: true });
      await slider.focus();
      const before = await slider.getAttribute("aria-valuenow");
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => slider.getAttribute("aria-valuenow")).not.toBe(before);

      expect(await slider.evaluate((element) => element === document.activeElement)).toBe(true);
      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(() => slider.getAttribute("aria-valuenow")).toBe(before);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("refuses an alias that would close a cycle, typed or linked", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Status");
      await colorTrigger(page, "error").click();
      const field = page.getByRole("textbox", { name: "Color", exact: true });
      // The base theme declares destructive: var(--error).
      await field.fill("var(--destructive)");
      await expect.poll(() => field.getAttribute("aria-invalid")).toBe("true");
      await page.getByText("Links --error back to itself", { exact: true }).waitFor();
      await field.fill("var(--error)");
      await page.getByText("A token cannot alias itself", { exact: true }).waitFor();

      await page.getByRole("combobox", { name: "Link to token", exact: true }).click();
      const option = (name: string) => page.getByRole("option", { name, exact: true });
      await expect.poll(() => option("--destructive").getAttribute("aria-disabled")).toBe("true");
      expect(await option("--border").getAttribute("aria-disabled")).not.toBe("true");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("detaches a translucent alias to a literal that keeps its alpha", async () => {
    // Internal elma, whose dark border is oklch(1 0 0 / 10%) and button-outline var(--border).
    const { context, page, errors } = await openStudio(hashOf('{"t":"internal-elma-private"}'));
    try {
      await inspector(page)
        .getByRole("group", { name: "Edited scheme", exact: true })
        .getByRole("button", { name: "Dark", exact: true })
        .click();
      await openTokenSection(page, "Variant layer");
      await tokenRow(page, "button-outline")
        .getByRole("button", {
          name: "Detach --button-outline from --border to a literal value",
          exact: true,
        })
        .click();

      await expect.poll(() => shownValue(page, "button-outline")).toBe("#FFFFFF1A");
      const declared = await artboard(page, DARK_BOARD).evaluate((element) =>
        element.style.getPropertyValue("--button-outline")
      );
      expect(declared).toMatch(/^lab\(.* \/ 0\.1\)$/u);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("reads a color notation @elmeragroup/color does not, through the browser", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Actions");
      await setTokenColor(page, "primary", "color(srgb 1 0 0)");
      // The artboard paints pure red, read back through @elmeragroup/color.
      await expect
        .poll(async () => opaqueHex(await background(saveButton(page, LIGHT_BOARD))))
        .toBe("#FF0000");
      await expect.poll(() => shownValue(page, "primary")).toBe("#FF0000");
      const mark = tokenRow(page, "primary-foreground").locator("[data-contrast]");
      await expect.poll(() => mark.getAttribute("data-contrast")).not.toBeNull();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("edits a live color formula and recolors the hover tone it measures", async () => {
    // Internal elma, whose light secondary is a light grey and foreground near black, so the mix
    // weight moves the tone. External elma's light secondary is its foreground.
    const { context, page, errors } = await openStudio(hashOf('{"t":"internal-elma-private"}'));
    try {
      await openTokenSection(page, "Actions");
      const swatch = colorTrigger(page, "secondary-hover").locator(".bg-\\(--swatch\\)");
      const before = await background(swatch);
      // The theme's own formula, at 10% instead of 5%.
      const formula = "color-mix(in oklch, var(--secondary), var(--foreground) 10%)";
      await setTokenColor(page, "secondary-hover", formula);

      const declared = () =>
        artboard(page, LIGHT_BOARD).evaluate((element) =>
          element.style.getPropertyValue("--secondary-hover")
        );
      await expect.poll(declared).toBe(formula);
      await expect.poll(() => background(swatch)).not.toBe(before);
      expect(await shownValue(page, "secondary-hover")).toBe("mix");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("refuses a formula that reads currentcolor, and keeps the declared value", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Actions");
      const declared = () =>
        artboard(page, LIGHT_BOARD).evaluate((element) => element.style.getPropertyValue("--primary"));
      const before = await declared();
      await colorTrigger(page, "primary").click();
      const field = page.getByRole("textbox", { name: "Color", exact: true });
      // The probe and the rendered button would each resolve currentcolor against their own text.
      await field.fill("color-mix(in srgb, var(--secondary), currentcolor)");
      await expect.poll(() => field.getAttribute("aria-invalid")).toBe("true");
      await page
        .getByText("Each color in a mix is a var() without fallback or a color the studio reads", {
          exact: true,
        })
        .waitFor();
      expect(await declared()).toBe(before);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("leaves the editor's colors unread on a metric edit, and reads them again on a color edit", async () => {
    const { context, page, errors } = await openStudio("", undefined, DENSITY_PAGE);
    try {
      const medium = artboard(page, DENSITY_TWIN).getByRole("button", { name: "Medium", exact: true });
      const height = () => medium.evaluate((element) => getComputedStyle(element).height);
      const colorReads = await countColorReads(page);

      await setMetric(page, "control-h-md", "dense", 40);
      await expect.poll(height).toBe("40px");
      await frames(page, 2);
      expect(await colorReads()).toBe(0);

      // The counter sees a resolution: a color edit sends the probe back to the browser.
      await openTokenSection(page, "Actions");
      await setTokenColor(page, "primary", "#ff0000");
      await expect.poll(colorReads).toBeGreaterThan(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("marks a pair on a translucent surface as needing an opaque backdrop", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Actions");
      const mark = tokenRow(page, "primary-foreground").locator("[data-contrast]");
      await expect.poll(() => mark.getAttribute("data-contrast")).toBe("pass");
      await setTokenColor(page, "primary", "rgba(255, 0, 0, 0.5)");
      await expect.poll(() => mark.getAttribute("data-contrast")).toBe("translucent");
      expect(await mark.textContent()).toBe("Needs an opaque backdrop");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("shows short color values, with the declared CSS as the trigger's tooltip", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await openTokenSection(page, "Actions");
      // external-palettes.ts, elma: primary oklch(0.47851 0.048934 219), #3C6470.
      expect(await shownValue(page, "primary")).toBe("#3C6470");
      expect(await shownValue(page, "destructive")).toBe("→ error");
      expect(await shownValue(page, "secondary-hover")).toBe("mix");

      await setTokenColor(page, "primary", "#ff000080");
      await expect.poll(() => shownValue(page, "primary")).toBe("#FF000080");
      await colorTrigger(page, "secondary-hover").hover();
      await page
        .getByText("color-mix(in oklch, var(--secondary), var(--foreground) 5%)", { exact: true })
        .waitFor({ state: "visible" });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("keeps the last good autosave and says so when the session grows too large to share", async () => {
    // Long literals over every scheme color token but primary, until the share text is just
    // under the limit; one more long edit then pushes it over.
    const long = "oklch(0.1234567 0.1234567 123.4567891)";
    const light: Record<string, string> = {};
    const dark: Record<string, string> = {};
    const names = SCHEME_COLORS.filter((name) => name !== "primary");
    let hash = hashOf('{"t":"external-elma-private"}');
    for (const name of [
      ...names.map((each) => ["d", each] as const),
      ...names.map((each) => ["l", each] as const),
    ]) {
      const [group, token] = name;
      (group === "l" ? light : dark)[token] = long;
      const next = hashOf(JSON.stringify({ t: "external-elma-private", l: light, d: dark }));
      if (next.length - 1 > MAX_SHARE_LENGTH - 40) {
        delete (group === "l" ? light : dark)[token];
        break;
      }
      hash = next;
    }
    const { context, page, errors } = await openStudio(hash);
    try {
      const saved = () => page.evaluate(() => window.localStorage.getItem("fuse-studio-v1"));
      await expect.poll(saved).toBe(hash.slice(1));

      await openTokenSection(page, "Actions");
      await setTokenColor(page, "primary", long);
      // The toast's title, and the live region's copy of it.
      await page.getByText("Too many edits to share", { exact: true }).first().waitFor();
      await page.waitForTimeout(600);
      expect(await saved()).toBe(hash.slice(1));

      // A page link drops the hash; the address gets the last good text back, not nothing.
      await layers(page).getByRole("link", { name: "Density", exact: true }).click();
      await expect.poll(() => new URL(page.url()).pathname).toBe("/studio/density");
      await page.waitForTimeout(600);
      expect(new URL(page.url()).hash).toBe(hash);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("offers a retry when the base theme's values fail to load, and keeps the edits", async () => {
    let failing = true;
    const { context, page, errors } = await openStudio(
      hashOf('{"t":"external-elma-private","l":{"primary":"#ff0000"}}'),
      async (opening) => {
        await opening.route("**/_next/static/chunks/**", async (route) => {
          const response = await route.fetch();
          const body = await response.text();
          if (failing && SEED_CHUNK.test(body)) {
            await route.abort();
            return;
          }
          await route.fulfill({ response, body });
        });
      }
    );
    try {
      // The toast's title, and the live region's copy of it.
      await page.getByText("The theme's values could not load", { exact: true }).first().waitFor();
      // With nothing focused, Shift+F6 starts at the cycle's last stop, the notifications, which
      // expands them for assistive technology too.
      await page.keyboard.press("Shift+F6");
      const retry = page
        .getByRole("region", { name: "Notifications", exact: true })
        .getByRole("button", { name: "Retry", exact: true });
      expect(await background(saveButton(page, LIGHT_BOARD))).toBe(RED);
      const exportButton = page.getByRole("banner").getByRole("button", { name: "Export", exact: true });
      expect(await exportButton.isDisabled()).toBe(true);

      failing = false;
      await retry.click();
      await expect.poll(() => exportButton.isDisabled()).toBe(false);
      expect(await background(saveButton(page, LIGHT_BOARD))).toBe(RED);
      // The aborted chunk request logs a console error; nothing else may.
      expect(errors.filter((error) => !error.includes("Failed to load resource"))).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
