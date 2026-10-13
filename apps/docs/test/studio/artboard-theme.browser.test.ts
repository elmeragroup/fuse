import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

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
  setTokenColor,
  tokenRow,
} from "./page";
import type { StudioRoute } from "./page";

const browser = launchSuiteBrowser();

const LIGHT_BOARD = ARTBOARDS[0];
const DARK_BOARD = ARTBOARDS[1];
const LIGHT_NEIGHBOUR = ARTBOARDS[2];
const DARK_NEIGHBOUR = ARTBOARDS[3];

/** The Shape page: its rung artboards pin a variant in their spec, its shells board does not. */
const RUNGS_PAGE: StudioRoute = { path: "/studio/shape", artboard: "Radius rungs · Internal" };
const INTERNAL_RUNGS = "Radius rungs · Internal";
const SHELLS = "Shells in Fuse";

const RED = "rgb(255, 0, 0)";

/** The floating theme toolbar over the selected artboard. */
function artboardBar(page: Page): Locator {
  return canvas(page).getByRole("toolbar", { name: "Artboard theme", exact: true });
}

/** An artboard's row in the Layers list. */
function layer(page: Page, name: string): Locator {
  return layers(page).getByRole("button", { name, exact: true });
}

/** Selects the artboard `name` from Layers and waits for its bar. */
async function selectBoard(page: Page, name: string): Promise<Locator> {
  await layer(page, name).click();
  const bar = artboardBar(page);
  await bar.waitFor({ state: "visible" });
  return bar;
}

/** Picks `brand` in the Brand Select inside `within`, the bar or the inspector. */
async function pickBrand(page: Page, within: Locator, brand: string): Promise<void> {
  await within.getByRole("combobox", { name: "Brand", exact: true }).click();
  await page.getByRole("option", { name: brand, exact: true }).click();
}

/** Presses the `option` button of the toggle group named `group` inside `within`. */
function toggle(within: Locator, group: string, option: string): Locator {
  return within
    .getByRole("group", { name: group, exact: true })
    .getByRole("button", { name: option, exact: true });
}

/** The theme an artboard's scope renders, as its theme attributes name it. */
async function themeOf(page: Page, name: string): Promise<string> {
  return artboard(page, name).evaluate((element) =>
    ["variant", "brand", "segment"].map((axis) => element.getAttribute(`data-theme-${axis}`)).join("-")
  );
}

/** A custom property as the artboard's scope element computes it. */
async function tokenOn(page: Page, name: string, property: `--${string}`): Promise<string> {
  return artboard(page, name).evaluate(
    (element, token) => getComputedStyle(element).getPropertyValue(token).trim(),
    property
  );
}

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
    const { context, page } = await openStudio(browser(), { route: RUNGS_PAGE });
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
      await context.close();
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
      await tokenRow(page, "brand").getByRole("button", { name: "Edit --brand", exact: true }).click();
      const field = page.getByRole("textbox", { name: "Color", exact: true });
      await field.fill("var(--sidebar-brand)");
      await page.keyboard.press("Escape");
      await field.waitFor({ state: "hidden" });

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
    const { context, page } = await openStudio(browser(), { route: RUNGS_PAGE });
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
});
