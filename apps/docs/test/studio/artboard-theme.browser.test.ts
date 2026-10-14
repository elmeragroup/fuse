import type { Locator } from "playwright";
import { describe, expect, it } from "vitest";

import { closeContext, launchSuiteBrowser } from "../suite-browser";
import {
  ARTBOARDS,
  COLOR_PAGE,
  CORNERS_PAGE,
  artboard,
  background,
  canvas,
  inspector,
  openStudio,
  openTokenSection,
  pickBrand,
  selectBoard,
  setTokenColor,
  sidebarBrandSource,
  themeOf,
  toggle,
  tokenOn,
} from "./page";

const browser = launchSuiteBrowser();

const LIGHT_BOARD = ARTBOARDS[0];
const DARK_BOARD = ARTBOARDS[1];
const LIGHT_NEIGHBOUR = ARTBOARDS[2];
const DARK_NEIGHBOUR = ARTBOARDS[3];
const GLANCE_BOARD = ARTBOARDS[4];

const INTERNAL_RUNGS = CORNERS_PAGE.artboard;
const SHELLS = "Shells in Fuse";

const LIGHT_SIDEBAR = "Sidebar · Light";

const RED = "rgb(255, 0, 0)";

describe("an artboard's own brand, variant and segment", () => {
  it("re-themes one artboard to another brand while its neighbour keeps the base theme", async () => {
    const { context, page, errors } = await openStudio(browser());
    try {
      const save = (name: string) => artboard(page, name).getByRole("button", { name: "Save", exact: true });
      // Both light boards render the base theme, external Elmera private, alike.
      expect(await themeOf(page, LIGHT_BOARD)).toBe("external-elma-private");
      expect(await background(save(LIGHT_BOARD))).toBe(await background(save(LIGHT_NEIGHBOUR)));

      await pickBrand(page, await selectBoard(page, LIGHT_BOARD), "Fjordkraft");
      await expect.poll(() => themeOf(page, LIGHT_BOARD)).toBe("external-fkas-private");
      expect(await themeOf(page, LIGHT_NEIGHBOUR)).toBe("external-elma-private");
      // Fjordkraft's primary action color is not Elmera's.
      await expect
        .poll(async () => (await background(save(LIGHT_BOARD))) !== (await background(save(LIGHT_NEIGHBOUR))))
        .toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("disables a segment the brand does not serve, and drags the segment to the one it does", async () => {
    const { context, page } = await openStudio(browser());
    try {
      const bar = await selectBoard(page, LIGHT_BOARD);
      await toggle(bar, "Segment", "Company").click();
      await expect.poll(() => themeOf(page, LIGHT_BOARD)).toBe("external-elma-company");

      // Telinet serves private customers only.
      await pickBrand(page, bar, "Telinet");
      await expect.poll(() => themeOf(page, LIGHT_BOARD)).toBe("external-fkse-private");
      expect(await toggle(bar, "Segment", "Private").getAttribute("aria-pressed")).toBe("true");
      expect(await toggle(bar, "Segment", "Company").isDisabled()).toBe(true);

      // Fjordkraft Företag serves companies only.
      await pickBrand(page, bar, "Fjordkraft Företag");
      await expect.poll(() => themeOf(page, LIGHT_BOARD)).toBe("external-fkab-company");
      expect(await toggle(bar, "Segment", "Private").isDisabled()).toBe(true);
    } finally {
      await context.close();
    }
  });

  it("changes the variant of an artboard that follows the base theme and of one its spec pins", async () => {
    const { context, page } = await openStudio(browser(), { route: CORNERS_PAGE });
    try {
      let bar = await selectBoard(page, SHELLS);
      expect(await toggle(bar, "Variant", "External").getAttribute("aria-pressed")).toBe("true");
      await toggle(bar, "Variant", "Internal").click();
      await expect.poll(() => themeOf(page, SHELLS)).toBe("internal-elma-private");

      bar = await selectBoard(page, INTERNAL_RUNGS);
      expect(await toggle(bar, "Variant", "Internal").getAttribute("aria-pressed")).toBe("true");
      await toggle(bar, "Variant", "External").click();
      await expect.poll(() => themeOf(page, INTERNAL_RUNGS)).toBe("external-elma-private");
    } finally {
      await context.close();
    }
  });

  it("applies a token edit to a re-branded artboard", async () => {
    const { context, page } = await openStudio(browser());
    try {
      await pickBrand(page, await selectBoard(page, LIGHT_BOARD), "Fjordkraft");
      await expect.poll(() => themeOf(page, LIGHT_BOARD)).toBe("external-fkas-private");
      await openTokenSection(page, "Actions");
      await setTokenColor(page, "primary", "#ff0000");
      const save = artboard(page, LIGHT_BOARD).getByRole("button", { name: "Save", exact: true });
      await expect.poll(() => background(save)).toBe(RED);
    } finally {
      await context.close();
    }
  });

  it("toasts a failed load of an artboard's own theme only while an artboard renders that theme", async () => {
    const { context, page } = await openStudio(browser(), {
      prepare: async (opening) => {
        // Fjordkraft's seed never loads.
        await opening.route("**/_next/static/chunks/**", async (route) => {
          const response = await route.fetch();
          const body = await response.text();
          if (/slug"?:"external-fkas-private"/u.test(body)) {
            await route.abort();
            return;
          }
          await route.fulfill({ response, body });
        });
      },
    });
    try {
      // The toast's title, and the live region's copy of it.
      const toast = page.getByText("The theme's values could not load", { exact: true });
      const bar = await selectBoard(page, LIGHT_BOARD);
      await pickBrand(page, bar, "Fjordkraft");
      await toast.first().waitFor();

      // Back on the base theme, no artboard renders Fjordkraft, so the toast closes.
      await pickBrand(page, bar, "Elmera");
      await expect.poll(async () => toast.count()).toBe(0);

      // The load stays failed until a retry: Fjordkraft back on screen brings the toast back.
      await pickBrand(page, bar, "Fjordkraft");
      await toast.first().waitFor();
    } finally {
      await closeContext(context);
    }
  });

  it("skips on a re-branded artboard an edit that loops only in its brand, and names it in the inspector", async () => {
    // External Elmera declares a literal --sidebar-brand in dark themes and Fjordkraft
    // sidebar-brand: var(--brand) (the theming handbook's sidebar brand section). So on the dark
    // boards --brand: var(--sidebar-brand) is admitted over the Elmera base, and loops on a dark
    // Fjordkraft board.
    const { context, page } = await openStudio(browser());
    try {
      await pickBrand(page, await selectBoard(page, DARK_BOARD), "Fjordkraft");
      await expect.poll(() => themeOf(page, DARK_BOARD)).toBe("external-fkas-private");
      await openTokenSection(page, "Actions");
      await setTokenColor(page, "brand", "var(--sidebar-brand)");

      // The Elmera neighbour wears the edit: its brand is its sidebar brand.
      await expect
        .poll(async () => tokenOn(page, DARK_NEIGHBOUR, "--brand"))
        .toBe(await tokenOn(page, DARK_NEIGHBOUR, "--sidebar-brand"));
      // The Fjordkraft board skips it, so its brand still resolves rather than looping.
      expect(await tokenOn(page, DARK_BOARD, "--brand")).not.toBe("");
      const note = inspector(page).getByText(/^Skips --brand,/u);
      await note.waitFor();
      expect(await note.textContent()).toBe(
        "Skips --brand, which would loop through the aliases of Fjordkraft · External · Private."
      );
    } finally {
      await context.close();
    }
  });

  it("resets every artboard's brand, variant and segment with the base theme, keeping scheme and density", async () => {
    const { context, page } = await openStudio(browser(), { route: CORNERS_PAGE });
    try {
      let bar = await selectBoard(page, INTERNAL_RUNGS);
      await pickBrand(page, bar, "Fjordkraft");
      await toggle(bar, "Variant", "External").click();
      await toggle(bar, "Scheme", "Dark").click();
      bar = await selectBoard(page, SHELLS);
      await pickBrand(page, bar, "TrøndelagKraft");
      await toggle(bar, "Segment", "Company").click();
      await toggle(bar, "Density", "Comfortable").click();
      await expect.poll(() => themeOf(page, INTERNAL_RUNGS)).toBe("external-fkas-private");
      await expect.poll(() => themeOf(page, SHELLS)).toBe("external-tkas-company");

      await page.getByRole("button", { name: /^Base theme/u }).click();
      await page.getByRole("menuitemradio", { name: "Nordic Green Energy", exact: true }).click();
      await page.keyboard.press("Escape");

      // Each follows the new base theme, and the rungs board returns to the variant its spec pins.
      await expect.poll(() => themeOf(page, INTERNAL_RUNGS)).toBe("internal-ngfi-private");
      await expect.poll(() => themeOf(page, SHELLS)).toBe("external-ngfi-private");
      expect(await artboard(page, INTERNAL_RUNGS).getAttribute("data-theme")).toBe("dark");
      expect(await artboard(page, SHELLS).getAttribute("data-density")).toBe("comfortable");
    } finally {
      await context.close();
    }
  });

  it("resets the artboards' own themes when an undo changes the base theme", async () => {
    const { context, page } = await openStudio(browser());
    try {
      await page.getByRole("button", { name: /^Base theme/u }).click();
      await page.getByRole("menuitemradio", { name: "Nordic Green Energy", exact: true }).click();
      await page.keyboard.press("Escape");
      await pickBrand(page, await selectBoard(page, LIGHT_BOARD), "Fjordkraft");
      await expect.poll(() => themeOf(page, LIGHT_BOARD)).toBe("external-fkas-private");

      // The undo returns the base to the studio's opening theme, and the board with it.
      await canvas(page).getByRole("button", { name: "Undo", exact: true }).click();
      await expect.poll(() => themeOf(page, LIGHT_BOARD)).toBe("external-elma-private");
    } finally {
      await context.close();
    }
  });

  it("shows the same theme in the bar and the inspector, a change in either showing in both", async () => {
    const { context, page } = await openStudio(browser());
    try {
      const bar = await selectBoard(page, LIGHT_BOARD);
      const section = inspector(page).getByRole("region", { name: "Artboard", exact: true });
      /** The brand a Brand Select's trigger shows. */
      const brandIn = (within: Locator, name: string) =>
        within.getByRole("combobox", { name: "Brand", exact: true }).getByText(name, { exact: true });

      await pickBrand(page, section, "TrøndelagKraft");
      await brandIn(bar, "TrøndelagKraft").waitFor({ state: "visible" });
      await toggle(bar, "Segment", "Company").click();
      await expect
        .poll(async () => toggle(section, "Segment", "Company").getAttribute("aria-pressed"))
        .toBe("true");
      await toggle(section, "Variant", "Internal").click();
      await expect
        .poll(async () => toggle(bar, "Variant", "Internal").getAttribute("aria-pressed"))
        .toBe("true");
      expect(await brandIn(section, "TrøndelagKraft").isVisible()).toBe(true);
      await expect.poll(() => themeOf(page, LIGHT_BOARD)).toBe("internal-tkas-company");
    } finally {
      await context.close();
    }
  });

  it("labels the glance board's radius ladder with the re-branded artboard's radius", async () => {
    // The lg rung is --radius (fuse.css: --radius-lg: var(--radius)). The composed themes declare
    // --radius 0.375rem for external Elmera and 0.75rem for external Fjordkraft
    // (packages/fuse/src/theme/__snapshots__/themes.css).
    const { context, page } = await openStudio(browser());
    try {
      const lg = artboard(page, GLANCE_BOARD)
        .getByRole("region", { name: "Radius", exact: true })
        .getByText(/^lg /u);
      await expect.poll(async () => lg.textContent()).toBe("lg 6px");

      await pickBrand(page, await selectBoard(page, GLANCE_BOARD), "Fjordkraft");
      await expect.poll(() => themeOf(page, GLANCE_BOARD)).toBe("external-fkas-private");
      await expect.poll(async () => lg.textContent()).toBe("lg 12px");
    } finally {
      await context.close();
    }
  });

  it("marks the sidebar brand by the re-branded artboard's own declaration", async () => {
    // The theming handbook's sidebar brand section: Fjordkraft declares its light sidebar brand
    // as a literal tone, while Elmera's light one is var(--brand).
    const { context, page } = await openStudio(browser(), { route: COLOR_PAGE });
    try {
      const source = sidebarBrandSource(artboard(page, LIGHT_SIDEBAR));
      await expect.poll(async () => source.textContent()).toBe("→ brand");

      await pickBrand(page, await selectBoard(page, LIGHT_SIDEBAR), "Fjordkraft");
      await expect.poll(() => themeOf(page, LIGHT_SIDEBAR)).toBe("external-fkas-private");
      await expect.poll(async () => source.textContent()).toBe("Literal");
    } finally {
      await context.close();
    }
  });
});
