import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { settleFrames } from "./landing-page";
import { artboard, canvas, inspector, layers, openStudio } from "./studio-page";
import type { StudioRoute } from "./studio-page";
import { launchSuiteBrowser } from "./suite-browser";

const browser = launchSuiteBrowser();

const SHELLS = "Shells in Fuse";

/** The Shape page, framed once its first rungs board shows. */
const CORNERS_PAGE: StudioRoute = { path: "/studio/shape", artboard: "Radius rungs · Internal" };

/**
 * The inner parts the Shells board renders with the menu closed, counted from its markup: three
 * rows in the Card, three Tabs triggers, the InputGroup's addon Button, the open Accordion
 * item's panel and a row in each of the two Frame panels.
 */
const CLOSED_MENU_PARTS = 3 + 3 + 1 + 1 + 2;

/** The rows the board's DropdownMenu adds once it is open. */
const MENU_ROWS = 3;

async function px(locator: Locator, property: "borderTopLeftRadius" | "paddingLeft"): Promise<number> {
  return Number.parseFloat(
    await locator.evaluate((element, name) => getComputedStyle(element)[name], property)
  );
}

/** Types `value` px into the `--radius` knob's number field and commits it. */
async function setRadius(page: Page, value: number): Promise<void> {
  const field = inspector(page).getByRole("textbox", { name: "--radius in px", exact: true });
  await field.fill(String(value));
  await field.press("Enter");
}

function cornerValues(page: Page, board: string): Promise<Record<string, string>> {
  return artboard(page, board)
    .locator("[data-corner-value]")
    .evaluateAll((elements): Record<string, string> =>
      Object.fromEntries(
        elements.map((element) => [
          element.getAttribute("data-corner-value") ?? "",
          element.textContent.trim(),
        ])
      )
    );
}

function xrayLabels(page: Page): Locator {
  return canvas(page).locator("[data-corner-xray] [data-corner-label]");
}

/** The open DropdownMenu's popup and its rows, which the X-ray measures as a shell and its parts. */
const MENU_PARTS =
  '[data-slot="dropdown-menu-content"], [data-slot="dropdown-menu-content"] [role="menuitem"]';

/**
 * The menu parts whose top-left corner no X-ray arc draws within 1px, in the overlay's px. Each
 * part's corner is its box on screen; its radius on screen is its computed radius scaled by the
 * popup's computed transform, as its opening keyframes draw it, and by the camera's zoom.
 */
function arcMisses(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const svg = document.querySelector("[data-corner-xray] svg");
    const world = document.querySelector("[data-studio-world]");
    if (svg === null || world === null) {
      return ["no overlay"];
    }
    const zoom = Number.parseFloat(getComputedStyle(world).getPropertyValue("--studio-zoom"));
    const origin = svg.getBoundingClientRect();
    // A start-side arc's path: M x y+r A r r 0 0 1 x+r y.
    const arcs = [...svg.querySelectorAll("path")]
      .map((path) => path.getAttribute("d") ?? "")
      .filter((d) => d.includes(" A "))
      .map((d) =>
        d
          .split(" ")
          .filter((token) => /\d/u.test(token))
          .map(Number)
      );
    return [...document.querySelectorAll(selector)].flatMap((element) => {
      const popup = element.closest('[data-slot="dropdown-menu-content"]');
      const scale = popup === null ? 1 : new DOMMatrix(getComputedStyle(popup).transform).a;
      const r = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) * scale * zoom;
      const rect = element.getBoundingClientRect();
      const x = rect.left - origin.left;
      const y = rect.top - origin.top;
      const near = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) <= 1;
      const drawn = arcs.some(
        (arc) => near(arc[0], x) && near(arc[1], y + r) && near(arc[7], x + r) && near(arc[8], y)
      );
      return drawn
        ? []
        : [`${element.getAttribute("data-slot") ?? ""} at ${String(x)}, ${String(y)}, r ${String(r)}`];
    });
  }, MENU_PARTS);
}

/** Opens the Shells board's menu and waits for the X-ray to label its rows. */
async function openMenu(page: Page): Promise<void> {
  await artboard(page, SHELLS).getByRole("button", { name: "Open the menu", exact: true }).click();
  await expect.poll(() => xrayLabels(page).count()).toBe(CLOSED_MENU_PARTS + MENU_ROWS);
}

/** A share link's hash for `json`, the studio's version-1 share text. */
function hashOf(json: string): string {
  return `#1.${Buffer.from(json, "utf8").toString("base64url")}`;
}

/** Turns the X-ray on and waits for its labels. */
async function showXray(page: Page, labels: number): Promise<void> {
  await page.getByRole("button", { name: "Corner X-ray", exact: true }).click();
  await expect.poll(() => xrayLabels(page).count()).toBe(labels);
}

/** Opens the inspector's measured-corners readout. */
async function openReadout(page: Page): Promise<Locator> {
  const trigger = inspector(page).getByRole("button", { name: /^Measured corners/u });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  return inspector(page).getByRole("list", { name: "Measured corners" });
}

/** The performance mark each `getComputedStyle` call leaves, counted by {@link styleReads}. */
const STYLE_READ = "studio-test:style-read";

/** Marks every `getComputedStyle` call the page makes, from before its scripts run. */
async function countStyleReads(page: Page): Promise<void> {
  await page.addInitScript((mark) => {
    const read = window.getComputedStyle.bind(window);
    window.getComputedStyle = (element, pseudo) => {
      performance.mark(mark);
      return read(element, pseudo);
    };
  }, STYLE_READ);
}

function styleReads(page: Page): Promise<number> {
  return page.evaluate((mark) => performance.getEntriesByName(mark).length, STYLE_READ);
}

describe("the studio's Shape page", () => {
  it("rounds Fuse's Card with an edited --radius, and its rows concentrically inside it", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: CORNERS_PAGE });
    try {
      await setRadius(page, 20);
      const card = artboard(page, SHELLS).locator('[data-slot="card"]').first();
      await expect.poll(() => px(card, "borderTopLeftRadius")).toBe(20);

      // The concentric rule (CONTEXT.md, "Inner corner"): the card's 20px corner less its 1px
      // border and the content section's padding, clamped at 0.
      const section = card.locator('[data-slot="card-content"]');
      const pad = await px(section, "paddingLeft");
      const row = section.locator('[data-slot="shape-row"]').first();
      expect(await px(row, "borderTopLeftRadius")).toBeCloseTo(Math.max(0, 20 - 1 - pad), 1);

      // A corner deeper than the inset leaves the clamp.
      await setRadius(page, 40);
      await expect.poll(() => px(card, "borderTopLeftRadius")).toBe(40);
      expect(40 - 1 - pad).toBeGreaterThan(0);
      expect(await px(row, "borderTopLeftRadius")).toBeCloseTo(40 - 1 - pad, 1);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("relabels every rung with the radius the browser computes after the edit", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: CORNERS_PAGE });
    try {
      await setRadius(page, 20);
      // fuse.css's rungs at a 20px radius: every one 20px at the internal 0px step, and whole
      // 2px steps from 20px at the external step (CONTEXT.md, "Radius rung").
      await expect
        .poll(() => cornerValues(page, "Radius rungs · Internal"))
        .toMatchObject({ xs: "20px", sm: "20px", md: "20px", lg: "20px", xl: "20px", popover: "20px" });
      await expect
        .poll(() => cornerValues(page, "Radius rungs · External"))
        .toMatchObject({ xs: "14px", sm: "16px", md: "18px", lg: "20px", xl: "24px", popover: "12px" });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("toggles the corner X-ray once while X is held", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: CORNERS_PAGE });
    try {
      const toggle = page.getByRole("button", { name: "Corner X-ray", exact: true });
      // Playwright repeats a key it already holds down, as auto-repeat does. An even count of
      // presses leaves a handler that toggles on every repeat off.
      for (let press = 0; press < 4; press++) {
        await page.keyboard.down("x");
      }
      await page.keyboard.up("x");
      await settleFrames(page);
      expect(await toggle.getAttribute("aria-pressed")).toBe("true");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("draws one X-ray label per inner part, none mismatched on the stock theme", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: CORNERS_PAGE });
    try {
      const toggle = page.getByRole("button", { name: "Corner X-ray", exact: true });
      await showXray(page, CLOSED_MENU_PARTS);
      expect(await xrayLabels(page).and(page.locator('[data-mismatch="true"]')).count()).toBe(0);
      // The text alternative lists the same corners.
      const readout = await openReadout(page);
      await expect.poll(() => readout.getByRole("listitem").count()).toBe(CLOSED_MENU_PARTS);

      // Every part still follows the formula once the corners leave the clamp: the three Card
      // rows and the two Frame rows sit 1px of border and 24px of padding inside a 40px corner.
      await setRadius(page, 40);
      await expect.poll(() => xrayLabels(page).filter({ hasText: "= 15px" }).count()).toBe(5);
      expect(await xrayLabels(page).and(page.locator('[data-mismatch="true"]')).count()).toBe(0);

      // An opened menu's rows are inner parts of its popup.
      await artboard(page, SHELLS).getByRole("button", { name: "Open the menu", exact: true }).click();
      await expect.poll(() => xrayLabels(page).count()).toBe(CLOSED_MENU_PARTS + MENU_ROWS);
      expect(await xrayLabels(page).and(page.locator('[data-mismatch="true"]')).count()).toBe(0);
      await page.keyboard.press("Escape");
      // A key typed in an open menu is its own, so the shortcut waits for the menu to close.
      await page.getByRole("menu").waitFor({ state: "detached" });

      // X toggles the overlay off again.
      await page.locator("body").press("x");
      await expect.poll(() => xrayLabels(page).count()).toBe(0);
      expect(await toggle.getAttribute("aria-pressed")).toBe("false");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("leads the inspector's token sections with Shape, open, where the Overview leads with Surfaces", async () => {
    const first = (page: Page) => inspector(page).locator('[data-slot="accordion-trigger"]').first();
    const corners = await openStudio(browser(), { route: CORNERS_PAGE });
    try {
      expect((await first(corners.page).textContent())?.trim()).toBe("Shape");
      expect(await first(corners.page).getAttribute("aria-expanded")).toBe("true");
      expect(corners.errors).toEqual([]);
    } finally {
      await corners.context.close();
    }
    const overview = await openStudio(browser());
    try {
      expect((await first(overview.page).textContent())?.trim()).toBe("Surfaces");
      expect(await first(overview.page).getAttribute("aria-expanded")).toBe("false");
    } finally {
      await overview.context.close();
    }
  });

  it.each([
    ["internal", hashOf('{"t":"internal-elma-private"}')],
    ["external", ""],
  ])("rounds each pinned variant with its own role corners over a %s base theme", async (_base, hash) => {
    const { context, page, errors } = await openStudio(browser(), { route: CORNERS_PAGE, hash });
    try {
      await setRadius(page, 20);
      // The internal variant aliases both role corners to --radius (fuse's tokens/defaults.ts).
      await expect
        .poll(() => cornerValues(page, "Radius rungs · Internal"))
        .toMatchObject({ lg: "20px", button: "20px", field: "20px" });
      // External elma keeps its own 0.375rem button and 0.25rem field (tokens/external-palettes.ts
      // and the external variant layer), whatever the radius.
      await expect
        .poll(() => cornerValues(page, "Radius rungs · External"))
        .toMatchObject({ lg: "20px", button: "6px", field: "4px" });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("relabels the X-ray with the inner corners a denser artboard computes", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: CORNERS_PAGE });
    try {
      await setRadius(page, 40);
      await showXray(page, CLOSED_MENU_PARTS);
      // Comfortable, the Card rows and the Frame rows sit 1px of border and 24px of padding
      // inside the 40px corner.
      await expect.poll(() => xrayLabels(page).filter({ hasText: "= 15px" }).count()).toBe(5);

      await canvas(page).getByRole("button", { name: SHELLS, exact: true }).click();
      await inspector(page)
        .getByRole("group", { name: "Density", exact: true })
        .getByRole("button", { name: "Dense", exact: true })
        .click();
      // Dense, the lg surface tier pads 16px (fuse's tokens/density-metrics.ts), so the rows
      // round at 40 − 1 − 16 = 23px, and the labels follow without a stale 15px left.
      await expect.poll(() => xrayLabels(page).filter({ hasText: "= 23px" }).count()).toBe(5);
      expect(await xrayLabels(page).filter({ hasText: "= 15px" }).count()).toBe(0);
      expect(await xrayLabels(page).and(page.locator('[data-mismatch="true"]')).count()).toBe(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("reads no styles while idle or panning, and follows a pan with the measured corners", async () => {
    const { context, page, errors } = await openStudio(browser(), {
      route: CORNERS_PAGE,
      prepare: countStyleReads,
    });
    try {
      const frame = await canvas(page).boundingBox();
      if (frame === null) {
        throw new Error("the canvas has no box");
      }
      // Off every artboard, so the pointer hovers nothing.
      await page.mouse.move(frame.x + 8, frame.y + frame.height - 8);
      await showXray(page, CLOSED_MENU_PARTS);
      const first = xrayLabels(page).first();
      const before = await first.boundingBox();
      await page.waitForTimeout(300);

      const idle = await styleReads(page);
      await page.waitForTimeout(1000);
      expect(await styleReads(page)).toBe(idle);

      await page.mouse.wheel(0, 120);
      await expect.poll(async () => (await first.boundingBox())?.y).toBeCloseTo((before?.y ?? 0) - 120, 0);
      await page.waitForTimeout(300);
      expect(await styleReads(page)).toBe(idle);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("packs the X-ray labels apart, inside the canvas, at the fit zoom", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: CORNERS_PAGE });
    try {
      // The page opens fitted to every artboard, where the labels crowd most.
      await showXray(page, CLOSED_MENU_PARTS);
      await page.waitForTimeout(300);
      const frame = await canvas(page).boundingBox();
      const rects = await xrayLabels(page).evaluateAll((elements) =>
        elements.map((element) => {
          const { left, right, top, bottom } = element.getBoundingClientRect();
          return { left, right, top, bottom };
        })
      );
      expect(frame).not.toBeNull();
      for (const rect of rects) {
        expect(rect.left).toBeGreaterThanOrEqual(frame?.x ?? 0);
        expect(rect.right).toBeLessThanOrEqual((frame?.x ?? 0) + (frame?.width ?? 0));
        expect(rect.top).toBeGreaterThanOrEqual(frame?.y ?? 0);
        expect(rect.bottom).toBeLessThanOrEqual((frame?.y ?? 0) + (frame?.height ?? 0));
      }
      const overlapping = rects.flatMap((a, i) =>
        rects
          .slice(i + 1)
          .filter((b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
          .map((b) => [a, b])
      );
      expect(overlapping).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("shows the --radius knob above the fold, before a collapsed readout of the measured corners", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: CORNERS_PAGE });
    try {
      await showXray(page, CLOSED_MENU_PARTS);
      const knob = inspector(page).getByRole("slider", { name: "--radius", exact: true });
      const trigger = inspector(page).getByRole("button", { name: /^Measured corners/u });
      const knobBox = await knob.boundingBox();
      const triggerBox = await trigger.boundingBox();
      // The studio's desktop viewport is 1440 × 900.
      expect((knobBox?.y ?? Infinity) + (knobBox?.height ?? 0)).toBeLessThanOrEqual(900);
      expect(knobBox?.y ?? Infinity).toBeLessThan(triggerBox?.y ?? -Infinity);
      // Ten corners are more than the readout lists open.
      expect(await trigger.getAttribute("aria-expanded")).toBe("false");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("follows the rows of an overflowing popup as it scrolls under a still pointer", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: CORNERS_PAGE });
    try {
      // Three rows in a 64px popup overflow it.
      await page.addStyleTag({
        content:
          '[data-slot="dropdown-menu-content"] { max-height: 64px !important; overflow-y: auto !important; }',
      });
      // An 18px popup corner on the md rung, and 14px rows inside its 4px padding.
      await setRadius(page, 20);
      await showXray(page, CLOSED_MENU_PARTS);
      await openMenu(page);
      await expect.poll(() => arcMisses(page)).toEqual([]);

      // The opening animation has ended, so the X-ray measures again only when invalidated.
      await expect
        .poll(() =>
          page.evaluate(
            () => document.getAnimations().filter(({ playState }) => playState === "running").length
          )
        )
        .toBe(0);
      await page.waitForTimeout(300);
      const menu = page.getByRole("menu");
      await menu.evaluate((element) => {
        element.scrollTop = 24;
      });
      expect(await menu.evaluate((element) => element.scrollTop)).toBe(24);
      await expect.poll(() => arcMisses(page)).toEqual([]);
      expect(await xrayLabels(page).count()).toBe(CLOSED_MENU_PARTS + MENU_ROWS);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("draws an opening popup's corners at the scale its keyframes draw it", async () => {
    const { context, page, errors } = await openStudio(browser(), {
      route: CORNERS_PAGE,
      reducedMotion: "no-preference",
    });
    try {
      // The popup's zoom-in keyframes, from half size and slowed, so a sample lands mid-animation.
      await page.addStyleTag({
        content:
          '[data-slot="dropdown-menu-content"][data-open] { --tw-enter-scale: 0.5 !important; animation-duration: 60s !important; }',
      });
      await setRadius(page, 20);
      await canvas(page).getByRole("button", { name: SHELLS, exact: true }).click();
      await page.keyboard.press("Shift+Digit2");
      await showXray(page, CLOSED_MENU_PARTS);
      await openMenu(page);
      const scale = () =>
        page.getByRole("menu").evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a);
      expect(await scale()).toBeLessThan(0.9);
      await expect.poll(() => arcMisses(page)).toEqual([]);
      expect(await scale()).toBeLessThan(0.9);
      // The formula is checked against the resolved lengths, which no transform scales.
      expect(await xrayLabels(page).and(page.locator('[data-mismatch="true"]')).count()).toBe(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("offers a retry when a pinned variant's values fail to load, and restores its alias closure", async () => {
    let failing = true;
    const { context, page, errors } = await openStudio(browser(), {
      route: CORNERS_PAGE,
      // An internal base theme, so the External board pins the one other seed, and an --error
      // edit, which external elma's `--destructive: var(--error)` reads.
      hash: hashOf('{"t":"internal-elma-private","l":{"error":"#ff0000"}}'),
      prepare: async (opening) => {
        await opening.route("**/_next/static/chunks/**", async (route) => {
          const response = await route.fetch();
          const body = await response.text();
          if (failing && /slug"?:"external-elma-private"/u.test(body)) {
            await route.abort();
            return;
          }
          await route.fulfill({ response, body });
        });
      },
    });
    try {
      const board = artboard(page, "Radius rungs · External");
      const destructive = () =>
        board.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            destructive: style.getPropertyValue("--destructive"),
            error: style.getPropertyValue("--error"),
          };
        });
      // The toast's title, and the live region's copy of it.
      await page.getByText("The theme's values could not load", { exact: true }).first().waitFor();
      // Without the pinned seed, --destructive keeps the value it resolved on :root.
      const before = await destructive();
      expect(before.error).toBe("#ff0000");
      expect(before.destructive).not.toBe("#ff0000");

      failing = false;
      // With nothing focused, Shift+F6 starts at the cycle's last stop, the notifications, which
      // expands them for assistive technology too.
      await page.keyboard.press("Shift+F6");
      await page
        .getByRole("region", { name: "Notifications", exact: true })
        .getByRole("button", { name: "Retry", exact: true })
        .click();
      await expect.poll(destructive).toEqual({ destructive: "#ff0000", error: "#ff0000" });
      // The aborted chunk request logs a console error; nothing else may.
      expect(errors.filter((error) => !error.includes("Failed to load resource"))).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("skips on a pinned board an edit that loops only in its variant, and names it in the inspector", async () => {
    // On the Overview's external base, --radius: var(--radius-button) is admitted: external elma
    // declares a literal button corner. Internal themes declare radius-button: var(--radius)
    // (fuse's tokens/defaults.ts), so on the Internal board the two would loop.
    const { context, page, errors } = await openStudio(browser(), {
      hash: hashOf('{"t":"external-elma-private","s":{"radius":"var(--radius-button)"}}'),
    });
    try {
      await layers(page).getByRole("link", { name: "Shape", exact: true }).click();
      const internal = "Radius rungs · Internal";
      await artboard(page, internal).waitFor({ state: "visible" });
      // With the loop, --radius and --radius-button would be invalid and every rung 0px. Skipped,
      // the board keeps internal elma's own radius, which both role corners alias.
      await expect
        .poll(async () => Number.parseFloat((await cornerValues(page, internal)).lg ?? "0"))
        .toBeGreaterThan(0);
      const values = await cornerValues(page, internal);
      expect(values.button).toBe(values.lg);
      expect(values.field).toBe(values.lg);
      await layers(page).getByRole("button", { name: internal, exact: true }).click();
      const note = inspector(page).getByText(/^Skips --radius,/u);
      await note.waitFor();
      expect(await note.textContent()).toBe(
        "Skips --radius, which would loop through the Internal variant's own aliases."
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
