import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, waitForDocsShellHydration } from "./demo-page";
import { docsBaseUrl } from "./docs-server";

const browser = launchSuiteBrowser();

/**
 * Oracles: literals from Fuse's token modules and its committed contrast snapshot. The page opens
 * on the preview theme's default, `internal-fkas-private` (`DEFAULT_THEME` in `src/lib/theme.ts`).
 */
const LIGHT_ERROR = "oklch(0.4526 0.17845 30.42)"; // `tokens/defaults.ts`, ERROR
const DARK_ERROR = { oklch: "oklch(0.8383036 0.089085 26.7575)", hex: "#FFB4AB" }; // `tokens/dark-defaults.ts`
const INTERNAL_FOREGROUND = "oklch(0.15 0.0041 49.31)"; // `tokens/defaults.ts`
const BRAND_FKAS = "oklch(0.68 0.21747 38.8)"; // `tokens/primitives.ts`, `brand-fkas`
const WHITE = "oklch(1 0 0)"; // `tokens/primitives.ts`, `brand-fkas-foreground`
/**
 * `contrast-matrix.json` gives internal-fkas-private's foreground/background as 19.68, rounded to
 * two decimals. The page cuts its ratios to two decimals instead, so it shows 19.67 or 19.68.
 */
const FKAS_TEXT_RATIO = /^AAA 19\.6[78]:1$/u;
/** The sidebar color roles the contract names: the sidebar and its seven companions. */
const SIDEBAR_ROLES = 8;

async function openInspector(page: Page): Promise<Locator> {
  await page.goto(`${docsBaseUrl()}/handbook/palettes`, { waitUntil: "load" });
  await waitForDocsShellHydration(page);
  const inspector = page.locator("[data-palette-inspector]");
  await inspector.scrollIntoViewIfNeeded();
  return inspector;
}

/** The text of the tooltip a role's swatch opens once the pointer rests on it. */
async function hoverReadout(page: Page, inspector: Locator, role: string): Promise<string> {
  const trigger = inspector.locator(`[data-palette-role="${role}"]`);
  const tooltip = page.getByRole("tooltip").filter({ hasText: `--${role}` });
  // The inspector hydrates after the shell; a hover before then opens nothing, so retry it.
  await expect
    .poll(async () => {
      await page.mouse.move(0, 0);
      await trigger.hover();
      return tooltip.isVisible();
    })
    .toBe(true);
  return (await tooltip.textContent()) ?? "";
}

function bodyRows(inspector: Locator): Locator {
  return inspector.getByRole("table").getByRole("rowgroup").nth(1).getByRole("row");
}

describe("palettes handbook page", () => {
  it("shows a role's OKLCH and hex in a tooltip on hover, and its new value after a theme switch", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    expect(await hoverReadout(page, inspector, "error")).toContain(LIGHT_ERROR);

    await inspector.getByRole("button", { name: "Dark", exact: true }).click();
    await inspector.getByRole("combobox", { name: "Variant" }).click();
    await page.getByRole("option", { name: "External", exact: true }).click();
    await expect
      .poll(() => inspector.locator("[data-palette-slug]").textContent())
      .toBe("external-fkas-private · dark");

    const dark = await hoverReadout(page, inspector, "error");
    expect(dark).toContain(DARK_ERROR.oklch);
    expect(dark).toContain(DARK_ERROR.hex);
    expect(dark).not.toContain(LIGHT_ERROR);
    await page.close();
  });

  it("opens the same readout for a swatch reached from the keyboard", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    await hoverReadout(page, inspector, "background");
    await page.mouse.move(0, 0);
    await inspector.locator('[data-palette-role="background"]').focus();
    await page.keyboard.press("Tab");
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-palette-role")))
      .toBe("foreground");
    const tooltip = page.getByRole("tooltip").filter({ hasText: "--foreground" });
    await expect.poll(() => tooltip.isVisible()).toBe(true);
    expect(await tooltip.textContent()).toContain(INTERNAL_FOREGROUND);
    expect(await tooltip.textContent()).toMatch(/#[0-9A-F]{6}/u);
    await page.close();
  });

  it("copies a role's OKLCH value on press and says so", async () => {
    const context = await browser().newContext({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const page = await context.newPage();
    const inspector = await openInspector(page);
    await hoverReadout(page, inspector, "foreground");
    await inspector.locator('[data-palette-role="foreground"]').click();
    const status = inspector.getByRole("status").filter({ hasText: "Copied" });
    await expect.poll(() => status.textContent()).toBe(`Copied ${INTERNAL_FOREGROUND}`);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(INTERNAL_FOREGROUND);
    await context.close();
  });

  it("marks a pair below AA and grades a passing pair with its ratio", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    // The fkas orange behind white: #FF5604 has WCAG luminance 0.279, so 1.05 / 0.329 is 3.19.
    // The sample paints the pair itself: the fkas orange fill lettered in white, not the page's
    // own colors, so a pair below AA looks as hard to read as it is.
    const sample = inspector.locator('[data-palette-pair="brand-foreground/brand"] [data-pair-sample]');
    expect(
      await sample.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, text: style.color };
      })
    ).toEqual({ background: BRAND_FKAS, text: WHITE });
    const brand = inspector.locator('[data-palette-pair="brand-foreground/brand"] [data-contrast-grade]');
    expect(await brand.getAttribute("data-contrast-grade")).toBe("below-aa");
    expect(await brand.textContent()).toMatch(/^Below AA 3\.1\d:1$/u);
    const text = inspector.locator('[data-palette-pair="foreground/background"] [data-contrast-grade]');
    expect(await text.textContent()).toMatch(FKAS_TEXT_RATIO);
    await page.close();
  });

  it("switches to the Detailed table, which the search and the filter narrow", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    await expect.poll(() => inspector.getByRole("heading", { name: /^Tones/u }).isVisible()).toBe(true);
    await expect
      .poll(async () => {
        await inspector.getByRole("tab", { name: "Detailed" }).click();
        return inspector.getByRole("table").count();
      })
      .toBe(1);
    expect(await inspector.getByRole("heading", { name: /^Tones/u }).count()).toBe(0);
    const rows = bodyRows(inspector);
    // Every color role in the contract, 89 of them, `packages/fuse/src/theme/tokens/contract.ts`.
    await expect.poll(() => rows.count()).toBe(89);

    const search = inspector.getByRole("searchbox", { name: "Search roles" });
    await search.fill("sidebar");
    await expect.poll(() => rows.count()).toBe(SIDEBAR_ROLES);
    await search.fill("");
    await expect.poll(() => rows.count()).toBe(89);

    await inspector.getByRole("button", { name: "Filter", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("searchbox", { name: "Search fields", exact: true }).fill("Contrast");
    const contrast = page.getByRole("menuitem", { name: "Contrast", exact: true });
    await expect.poll(() => contrast.getAttribute("data-highlighted")).not.toBeNull();
    await page.keyboard.press("ArrowRight");
    await page.getByRole("menuitemcheckbox", { name: /^Below AA/u }).click();
    await page.keyboard.press("Escape");
    // Every text-grade pair holds 4.5:1 by Fuse's gate. Two role pairs fall below AA here: the
    // brand pair (#FF5604 under white, 3.19:1) and muted copy, `oklch(0.544 0 0)`, on accent and
    // primary-soft, both `oklch(0.96 0 0)` in `tokens/defaults.ts`, which Fuse's contrast test
    // records at 4.43:1 in light as an accepted deviation. Rows keep the contract's order.
    await expect
      .poll(() =>
        rows.evaluateAll((elements) =>
          elements.map((row) => row.querySelector("[data-palette-row-role]")?.textContent ?? "")
        )
      )
      .toEqual(["--muted-foreground", "--accent", "--primary-soft", "--brand", "--brand-foreground"]);

    await inspector.getByRole("tab", { name: "Default" }).click();
    await expect.poll(() => inspector.getByRole("heading", { name: /^Tones/u }).isVisible()).toBe(true);
    await page.close();
  });
});
