import type { Locator } from "playwright";
import { describe, expect, it } from "vitest";

import {
  artboard,
  inspector,
  layers,
  openStudio,
  openTokenSection,
  setTokenColor,
  tokenRow,
} from "./studio-page";
import type { StudioRoute } from "./studio-page";
import { launchSuiteBrowser } from "./suite-browser";

const browser = launchSuiteBrowser();

/** The Color page, ready once its light role pairs show. */
const COLOR_PAGE: StudioRoute = { path: "/studio/color", artboard: "Role pairs · Light" };

/** The Type page, ready once its specimen shows. */
const TYPE_PAGE: StudioRoute = { path: "/studio/type", artboard: "Specimen" };

/** The Density page, ready once its dense twin shows. */
const DENSITY: StudioRoute = { path: "/studio/density", artboard: "Twin · Dense" };

const RED = "rgb(255, 0, 0)";

async function computed(locator: Locator, property: "backgroundColor" | "fontFamily" | "fontSize") {
  return locator.evaluate((element, name) => getComputedStyle(element)[name], property);
}

/** The contrast mark under the role's own pair on `board`, not its soft form's. */
function contrastMark(board: Locator, role: string): Locator {
  return board.locator(`[data-pair="${role}"] > [data-contrast]`);
}

describe("the studio's Color page", () => {
  it("recolors the third chart series, and only it, when --chart-3 is set", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: COLOR_PAGE });
    try {
      const board = artboard(page, "Charts · Light");
      const third = board.locator('[data-series="3"]');
      const second = board.locator('[data-series="2"]');
      const before = await computed(second, "backgroundColor");
      expect(await computed(third, "backgroundColor")).not.toBe(RED);

      await openTokenSection(page, "Charts");
      await setTokenColor(page, "chart-3", "#FF0000");

      await expect.poll(() => computed(third, "backgroundColor")).toBe(RED);
      expect(await computed(second, "backgroundColor")).toBe(before);
      // The edit is the light scheme's: the dark twin's third series keeps its color.
      expect(
        await computed(artboard(page, "Charts · Dark").locator('[data-series="3"]'), "backgroundColor")
      ).not.toBe(RED);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("fails the success tile in the light artboard only when its foreground matches its fill", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: COLOR_PAGE });
    try {
      const light = artboard(page, "Status · Light");
      const dark = artboard(page, "Status · Dark");
      await expect.poll(() => contrastMark(light, "success").getAttribute("data-contrast")).toBe("pass");

      await openTokenSection(page, "Status");
      await setTokenColor(page, "success-foreground", "var(--success)");

      await expect.poll(() => contrastMark(light, "success").getAttribute("data-contrast")).toBe("fail");
      expect(await contrastMark(light, "success").textContent()).toBe("Fail 1.00:1");
      expect(await contrastMark(dark, "success").getAttribute("data-contrast")).toBe("pass");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("marks the feature pair decorative, never failing", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: COLOR_PAGE });
    try {
      const mark = contrastMark(artboard(page, "Role pairs · Light"), "feature");
      await expect.poll(() => mark.getAttribute("data-contrast")).toBe("decorative");
      expect(await mark.textContent()).toMatch(/^Decorative \d+\.\d{2}:1$/u);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("opens the primary knob when the primary tile is selected", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: COLOR_PAGE });
    try {
      // The page opens the Surfaces section only, so the Actions section starts closed.
      const knob = tokenRow(page, "primary").getByRole("button", { name: "Edit --primary", exact: true });
      expect(await knob.count()).toBe(0);

      await artboard(page, "Role pairs · Light")
        .getByRole("button", { name: "--primary", exact: true })
        .click();

      await expect.poll(() => knob.evaluate((element) => element === document.activeElement)).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("opens the phone's inspector Sheet on the primary knob when the primary tile is tapped", async () => {
    const { context, page, errors } = await openStudio(browser(), {
      route: COLOR_PAGE,
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    try {
      const sheet = page.getByRole("dialog", { name: "Inspector" });
      expect(await sheet.count()).toBe(0);

      await artboard(page, "Role pairs · Light")
        .getByRole("button", { name: "--primary", exact: true })
        .tap();

      const knob = sheet
        .getByRole("group", { name: "--primary", exact: true })
        .getByRole("button", { name: "Edit --primary", exact: true });
      await expect.poll(() => knob.evaluate((element) => element === document.activeElement)).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  // The default theme's light sidebar brand is `var(--brand)`; its dark one is a literal tone.
  it("marks the sidebar brand an alias of --brand in light, a literal in dark, and --brand reaches only the alias", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: COLOR_PAGE });
    try {
      const light = artboard(page, "Sidebar · Light");
      const dark = artboard(page, "Sidebar · Dark");
      const source = (board: Locator) => board.locator('[data-brand-source="sidebar-brand"] [data-source]');
      await expect.poll(() => source(light).textContent()).toBe("→ brand");
      expect(await source(dark).textContent()).toBe("Literal");
      const block = (board: Locator) =>
        board
          .getByRole("navigation", { name: "Sidebar sample" })
          .getByText("--sidebar-brand", { exact: true });
      const darkBefore = await computed(block(dark), "backgroundColor");

      await openTokenSection(page, "Actions");
      await setTokenColor(page, "brand", "#FF0000");

      await expect.poll(() => computed(block(light), "backgroundColor")).toBe(RED);
      expect(await computed(block(dark), "backgroundColor")).toBe(darkBefore);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("edits the dark scheme when a dark tile is selected", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: COLOR_PAGE });
    try {
      await artboard(page, "Role pairs · Dark").getByRole("button", { name: "--card", exact: true }).click();

      const dark = inspector(page)
        .getByRole("group", { name: "Edited scheme", exact: true })
        .getByRole("button", { name: "Dark", exact: true });
      await expect.poll(() => dark.getAttribute("aria-pressed")).toBe("true");
      // The card knob, focused, now shows the dark scheme's value.
      const knob = tokenRow(page, "card").getByRole("button", { name: "Edit --card", exact: true });
      await expect.poll(() => knob.evaluate((element) => element === document.activeElement)).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

describe("the studio's Type page", () => {
  it("sets the specimen H1 in a serif stack when --font-heading picks Serif", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: TYPE_PAGE });
    try {
      const h1 = artboard(page, "Specimen").locator('[data-specimen="h1"]');
      expect(await computed(h1, "fontFamily")).not.toContain("Georgia");

      await inspector(page).getByRole("combobox", { name: "--font-heading stack", exact: true }).click();
      await page.getByRole("option", { name: "Serif", exact: true }).click();

      await expect.poll(() => computed(h1, "fontFamily")).toBe("ui-serif, Georgia, serif");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  // Metric edits are B4's (the Density page): until its knobs land, the test declares the
  // comfortable label size on the comfortable artboard's scope, where a metric edit lands.
  it("resizes the comfortable twin's field labels only, and reports the new pair", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: DENSITY });
    try {
      // Metric knobs live on the Density page; the edit carries over a page link.
      await inspector(page).getByRole("button", { name: "Label text", exact: true }).click();
      const knob = inspector(page).getByRole("textbox", {
        name: "--label-text comfortable in px",
        exact: true,
      });
      await knob.fill("22");
      await knob.press("Tab");
      await layers(page).getByRole("link", { name: "Type", exact: true }).click();
      await artboard(page, TYPE_PAGE.artboard).waitFor({ state: "visible" });

      const comfortable = artboard(page, "Type pairs · Comfortable");
      const dense = artboard(page, "Type pairs · Dense");
      const label = (board: Locator) => board.locator('[data-slot="field-label"]').first();
      const reading = (board: Locator) =>
        board.getByRole("region", { name: "Label type", exact: true }).locator("[data-type-reading]").first();

      await expect.poll(() => computed(label(comfortable), "fontSize")).toBe("22px");
      expect(await computed(label(dense), "fontSize")).toBe("14px");
      // The comfortable label leading stays at its 24px metric.
      await expect.poll(() => reading(comfortable).textContent()).toBe("22 / 24 px");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("reports the selection title's new weight after a --selection-title-weight edit", async () => {
    const { context, page, errors } = await openStudio(browser(), { route: TYPE_PAGE });
    try {
      // The Specimen's last row is the selection title, the one row that reports its weight.
      const reading = artboard(page, "Specimen").locator("[data-type-reading]").last();
      // external-palettes.ts: every external theme declares selection-title-weight: 500.
      await expect.poll(() => reading.textContent()).toMatch(/ · 500$/u);

      const field = tokenRow(page, "selection-title-weight").getByRole("textbox", {
        name: "--selection-title-weight value",
        exact: true,
      });
      await field.fill("700");
      await field.press("Enter");

      await expect.poll(() => reading.textContent()).toMatch(/ · 700$/u);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
