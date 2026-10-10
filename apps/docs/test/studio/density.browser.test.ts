import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { PART_DENSITY } from "@elmeragroup/fuse/theme-catalog";

import { auditTargets } from "../landing-page";
import { launchSuiteBrowser } from "../suite-browser";
import {
  DENSITY_PAGE,
  artboard,
  countLayoutReads,
  frames,
  inspector,
  layers,
  openStudio,
  setMetric,
} from "./page";
import type { StudioPage } from "./page";

const browser = launchSuiteBrowser();

const DENSE_TWIN = "Twin · Dense";
const GLANCE_BOARD = "Theme at a glance";
const COMFORTABLE_TWIN = "Twin · Comfortable";

async function openDensity(reducedMotion: "reduce" | "no-preference" = "reduce"): Promise<StudioPage> {
  return openStudio(browser(), { reducedMotion, route: DENSITY_PAGE });
}

function button(page: Page, board: string, name: string): Locator {
  return artboard(page, board).getByRole("button", { name, exact: true });
}

async function height(locator: Locator): Promise<number> {
  return locator.evaluate((element) => Number.parseFloat(getComputedStyle(element).height));
}

/** The overlay box the X-ray draws for the part under the pointer. */
function hoveredTint(page: Page): Locator {
  return page.locator("[data-density-overlay] [data-xray-role][data-hovered]");
}

type Rect = { x: number; y: number; width: number; height: number };

async function rectOf(locator: Locator): Promise<Rect> {
  return locator.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  });
}

/** The largest distance between two rectangles' corresponding edges. */
function edgeDistance(a: Rect, b: Rect): number {
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.x + a.width - (b.x + b.width)),
    Math.abs(a.y + a.height - (b.y + b.height))
  );
}

/** The Density section's text alternative for the inspected part: its details, in order. */
async function inspectedPart(page: Page): Promise<string[]> {
  return inspector(page)
    .getByRole("region", { name: "Density", exact: true })
    .getByRole("definition")
    .allTextContents();
}

/**
 * Opens the dense twin's language Select with the X-ray on, runs `during` while its popup scales
 * in, and expects an option's row tint where the popup landed.
 */
async function expectTintLandsWithPopup(during: (page: Page) => Promise<void>): Promise<void> {
  const { context, page, errors } = await openDensity("no-preference");
  try {
    // Close enough that the popup's 95% starting scale moves its items by whole pixels.
    const canvas = page.getByRole("region", { name: "Canvas", exact: true });
    const fitted = (await rectOf(artboard(page, DENSE_TWIN))).width;
    await canvas.getByRole("button", { name: DENSE_TWIN, exact: true }).click();
    await page.keyboard.press("Shift+Digit2");
    await expect
      .poll(async () => (await rectOf(artboard(page, DENSE_TWIN))).width)
      .toBeGreaterThan(fitted * 2);
    await expect.poll(() => canvas.getAttribute("data-gliding")).toBe("false");
    await page.keyboard.press("r");
    // The trigger's caret and focus ring transition, which the overlays would follow anyway;
    // without them, only the popup's keyframe animation moves the items.
    await page.addStyleTag({
      content:
        '[data-slot="select-trigger"], [data-slot="select-trigger"] * { transition: none !important; }',
    });
    const trigger = artboard(page, DENSE_TWIN).getByRole("combobox").first();
    await trigger.focus();
    await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
    await trigger.press("Enter");
    await during(page);
    const item = artboard(page, DENSE_TWIN).getByRole("option", { name: "Svenska", exact: true });
    await item.waitFor();
    await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
    await frames(page, 2);
    // The item's own row tint, drawn where the popup landed rather than mid-scale.
    const target = await rectOf(item);
    const tints = await page.locator('[data-density-overlay] [data-xray-role="row"]').all();
    const distances = await Promise.all(tints.map(async (tint) => edgeDistance(await rectOf(tint), target)));
    expect(Math.min(...distances)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
}

describe("studio density page", () => {
  it("applies a comfortable control-h-md edit to comfortable artboards only, and undo restores it", async () => {
    const { context, page, errors } = await openDensity();
    try {
      const comfortable = button(page, COMFORTABLE_TWIN, "Medium");
      const dense = button(page, DENSE_TWIN, "Medium");
      const before = await height(comfortable);

      await setMetric(page, "control-h-md", "comfortable", 56);
      await expect.poll(() => height(comfortable)).toBe(56);
      expect(await height(dense)).toBe(36);

      // Tab committed the field and left focus on the Slider, where the shortcut still undoes.
      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(() => height(comfortable)).toBe(before);
      expect(before).toBe(44);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("keeps an xs Button at the 24px floor when dense control-h-xs drops to 16px", async () => {
    const { context, page, errors } = await openDensity();
    try {
      await setMetric(page, "control-h-xs", "dense", 16);
      const scope = artboard(page, DENSE_TWIN);
      await expect
        .poll(() => scope.evaluate((element) => getComputedStyle(element).getPropertyValue("--control-h-xs")))
        .toBe("16px");
      expect(await height(button(page, DENSE_TWIN, "Extra small"))).toBeGreaterThanOrEqual(24);
      await expect
        .poll(() => inspector(page).getByRole("note").first().textContent())
        .toContain("24px target floor");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("tints parts by the density role PART_DENSITY declares, with layout and fixed hidden at first", async () => {
    const { context, page, errors } = await openDensity();
    try {
      await page.keyboard.press("r");
      const legend = page.getByRole("group", { name: "Roles shown", exact: true });
      for (const [chip, pressed] of [
        ["Control", "true"],
        ["Layout", "false"],
        ["Fixed", "false"],
      ] as const) {
        expect(
          await legend.getByRole("button", { name: chip, exact: true }).getAttribute("aria-pressed")
        ).toBe(pressed);
      }
      await expect
        .poll(() => page.locator("[data-density-overlay] [data-xray-role]").count())
        .toBeGreaterThan(0);
      expect(
        await page
          .locator('[data-density-overlay] :is([data-xray-role="layout"], [data-xray-role="fixed"])')
          .count()
      ).toBe(0);
      const board = artboard(page, DENSE_TWIN);
      const cases = [
        { slot: "button", part: button(page, DENSE_TWIN, "Medium"), position: undefined },
        {
          slot: "grid-list-item",
          part: board.locator('[data-slot="grid-list-item"]').first(),
          position: undefined,
        },
        // The section's own padding, clear of the fields inside it.
        { slot: "card-content", part: board.locator('[data-slot="card-content"]'), position: { x: 2, y: 2 } },
      ] as const;
      for (const { slot, part, position } of cases) {
        await part.hover(position === undefined ? {} : { position });
        await expect
          .poll(() => hoveredTint(page).getAttribute("data-xray-role"), { message: slot })
          .toBe(PART_DENSITY[slot]);
        await expect.poll(() => inspectedPart(page), { message: slot }).toContain(slot);
        expect(await inspectedPart(page)).toContain(PART_DENSITY[slot]);
        // The tint is painted: a fill that is not transparent, over the part's own box.
        const fill = await hoveredTint(page).evaluate((element) => getComputedStyle(element).backgroundColor);
        expect(fill, slot).not.toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/u);
        expect(fill, slot).not.toMatch(/\/ 0\)$/u);
        await expect
          .poll(async () => edgeDistance(await rectOf(hoveredTint(page)), await rectOf(part)), {
            message: slot,
          })
          .toBeLessThanOrEqual(1);
      }
      // The legend still shows the hidden roles, and a chip brings them back.
      await legend.getByRole("button", { name: "Layout", exact: true }).click();
      await expect
        .poll(() => page.locator('[data-density-overlay] [data-xray-role="layout"]').count())
        .toBeGreaterThan(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("reads no layout while idle with the X-ray on", async () => {
    const { context, page, errors } = await openDensity();
    try {
      await page.keyboard.press("r");
      await button(page, DENSE_TWIN, "Medium").hover();
      await expect.poll(() => hoveredTint(page).getAttribute("data-xray-role")).toBe(PART_DENSITY.button);
      // Idle: the hover's colour transition, which the overlays follow, has finished.
      await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
      await frames(page, 2);
      const reads = await countLayoutReads(page);
      await frames(page, 30);
      expect(await reads()).toBe(0);
      // The count sees the overlay's reads: pointing at another part measures again.
      await button(page, DENSE_TWIN, "Small").hover();
      await expect.poll(reads).toBeGreaterThan(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("follows the Select popup's opening animation with the X-ray on", async () => {
    await expectTintLandsWithPopup(() => Promise.resolve());
  });

  it("keeps following the Select popup's opening animation when Measure turns on mid-motion", async () => {
    await expectTintLandsWithPopup(async (page) => {
      // The overlays have seen the animation start. Holding it halfway through makes sure the
      // option changes mid-motion, however fast the animation would otherwise finish.
      await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = Number(animation.effect?.getComputedTiming().duration ?? 0) / 2;
        }
      });
      await frames(page, 2);
      await page.keyboard.down("Alt");
      await frames(page, 2);
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          animation.play();
        }
      });
    });
  });

  it("realigns the hovered part's tint when a Dialog body scrolls under a still pointer", async () => {
    const { context, page, errors } = await openDensity();
    try {
      await page.keyboard.press("r");
      await button(page, DENSE_TWIN, "Advanced settings").click();
      const dialog = artboard(page, DENSE_TWIN).getByRole("dialog", { name: "Advanced settings" });
      // A short popup overflows, so its body scrolls.
      await dialog.evaluate((element) => {
        element.style.maxHeight = "140px";
      });
      const field = dialog.getByRole("textbox", { name: "Reference", exact: true });
      await field.hover();
      await expect
        .poll(async () => edgeDistance(await rectOf(hoveredTint(page)), await rectOf(field)))
        .toBeLessThanOrEqual(1);
      // Idle first: the hover's colour transition would keep the overlays sampling.
      await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
      await frames(page, 2);
      const before = await rectOf(field);
      // Less than half the field's height, so the pointer stays on it.
      await dialog.evaluate((element) => {
        const input = element.querySelector("input");
        element.scrollTop += (input?.offsetHeight ?? 0) * 0.4;
      });
      expect((await rectOf(field)).y).toBeLessThan(before.y - 1);
      await expect
        .poll(async () => edgeDistance(await rectOf(hoveredTint(page)), await rectOf(field)))
        .toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("links a part to its twin when the twins' Accordions differ", async () => {
    const { context, page, errors } = await openDensity();
    try {
      // Closing Delivery in the dense twin only unmounts its content there.
      await artboard(page, DENSE_TWIN).getByRole("button", { name: "Delivery", exact: true }).click();
      await expect
        .poll(() => artboard(page, DENSE_TWIN).locator('[data-slot="accordion-content"]').count())
        .toBeLessThan(
          await artboard(page, COMFORTABLE_TWIN).locator('[data-slot="accordion-content"]').count()
        );
      const twinLink = page.locator('[data-density-overlay] [data-twin-link="twin"]');
      for (const name of ["Privacy", "Advanced settings"]) {
        await button(page, DENSE_TWIN, name).hover();
        const twin = button(page, COMFORTABLE_TWIN, name);
        await expect
          .poll(
            async () =>
              (await twinLink.count()) === 0
                ? Number.POSITIVE_INFINITY
                : edgeDistance(await rectOf(twinLink), await rectOf(twin)),
            { message: name }
          )
          .toBeLessThanOrEqual(1);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("describes the inspected part at its artboard's current density", async () => {
    const { context, page, errors } = await openDensity();
    try {
      await button(page, DENSE_TWIN, "Medium").hover();
      await expect.poll(() => inspectedPart(page)).toContain("Dense");
      expect((await inspectedPart(page)).join("|")).toContain("--control-h-md36px");

      await page
        .getByRole("region", { name: "Canvas", exact: true })
        .getByRole("button", { name: DENSE_TWIN, exact: true })
        .click();
      await inspector(page)
        .getByRole("group", { name: "Density", exact: true })
        .getByRole("button", { name: "Comfortable", exact: true })
        .click();
      await expect.poll(() => inspectedPart(page)).toContain("Comfortable");
      expect((await inspectedPart(page)).join("|")).toContain("--control-h-md44px");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("labels the hovered Button's height with the measure overlay", async () => {
    const { context, page, errors } = await openDensity();
    try {
      await page.keyboard.press("m");
      await button(page, COMFORTABLE_TWIN, "Medium").hover();
      const label = page.locator('[data-density-overlay] [data-measure="height"]');
      await expect.poll(() => label.textContent()).toBe("44");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("keeps the Density section and the overlay bar at the 24px target floor", async () => {
    const { context, page, errors } = await openDensity();
    try {
      // An edit enables its reset; every role's table is open; the X-ray shows its legend.
      await setMetric(page, "control-h-xs", "dense", 16);
      for (const title of ["Row metrics", "Label text", "Surface metrics"]) {
        await inspector(page).getByRole("button", { name: title, exact: true }).click();
      }
      await page.keyboard.press("r");
      const bar = page.getByRole("group", { name: "Roles shown", exact: true });
      await bar.waitFor();
      const section = inspector(page).getByRole("region", { name: "Density", exact: true });
      const audit = await auditTargets(section);
      expect(audit.targets).toBeGreaterThan(0);
      // The audit probes the range input Base UI nests in each slider thumb, so its presses land
      // on the thumb around it; Fuse's Slider browser test owns the thumb's 24px target.
      const sliders = await section
        .getByRole("slider")
        .evaluateAll((inputs) => inputs.map((input) => input.getAttribute("aria-label") ?? ""));
      expect(audit.misses.filter((miss) => !sliders.some((name) => miss.startsWith(`${name} at `)))).toEqual(
        []
      );
      const barAudit = await auditTargets(bar.locator(".."));
      expect(barAudit.targets).toBeGreaterThan(0);
      expect(barAudit.misses).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("exports metric edits as a document-root rule for their density", async () => {
    const { context, page, errors } = await openDensity();
    try {
      await setMetric(page, "control-h-md", "comfortable", 56);
      await expect.poll(() => height(button(page, COMFORTABLE_TWIN, "Medium"))).toBe(56);
      await page.getByRole("banner").getByRole("button", { name: "Export", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Export CSS" });
      const css = (await dialog.getByRole("region", { name: "Exported CSS" }).textContent()) ?? "";
      expect(css).toContain(':root[data-density="comfortable"] {\n  --control-h-md: 56px;\n}');
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("draws the Overview's control heights with the metric edits, labelled with their rendered px", async () => {
    const { context, page, errors } = await openDensity();
    try {
      await setMetric(page, "control-h-md", "comfortable", 56);
      await expect.poll(() => height(button(page, COMFORTABLE_TWIN, "Medium"))).toBe(56);
      await layers(page).getByRole("link", { name: "Overview", exact: true }).click();
      const heights = artboard(page, GLANCE_BOARD).getByRole("region", {
        name: "Control heights",
        exact: true,
      });
      await heights.waitFor({ state: "visible" });
      for (const [density, px] of [
        ["Comfortable", 56],
        ["Dense", 36],
      ] as const) {
        const row = heights
          .locator("[data-demo-stage]")
          .filter({ hasText: density })
          .locator("div")
          .filter({ has: page.getByRole("button", { name: "md", exact: true }) });
        await expect.poll(() => height(row.getByRole("button")), { message: density }).toBe(px);
        await expect.poll(() => row.textContent(), { message: density }).toBe(`${String(px)} pxmd`);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("toggles Measure once while M is held", async () => {
    const { context, page, errors } = await openDensity();
    try {
      const measure = page.getByRole("button", { name: "Measure (M)", exact: true });
      // Playwright repeats a key it already holds down, as auto-repeat does.
      for (let press = 0; press < 5; press++) {
        await page.keyboard.down("m");
      }
      await page.keyboard.up("m");
      await frames(page, 2);
      expect(await measure.getAttribute("aria-pressed")).toBe("true");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("follows motion that started before the X-ray turned on until it lands", async () => {
    const { context, page, errors } = await openDensity("no-preference");
    try {
      const part = button(page, DENSE_TWIN, "Medium");
      // A script animation sends no start event, so only the live animation list shows it moving.
      const finished = part.evaluate(async (element) => {
        await element.animate([{ translate: "0 0" }, { translate: "0 37px" }], {
          duration: 900,
          fill: "forwards",
        }).finished;
      });
      await page.waitForTimeout(300);
      await page.keyboard.press("r");
      await finished;
      await frames(page, 2);
      const target = await rectOf(part);
      const tints = await page.locator('[data-density-overlay] [data-xray-role="control"]').all();
      const distances = await Promise.all(
        tints.map(async (tint) => edgeDistance(await rectOf(tint), target))
      );
      expect(Math.min(...distances)).toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
