import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, waitForDocsShellHydration } from "./demo-page";
import { docsBaseUrl } from "./docs-server";
import { launchSuiteBrowser } from "./suite-browser";

/**
 * Oracles: literals from Fuse's token modules and the role-to-step table in CONTEXT.md ("Brand
 * palette"). The tables open on the preview theme's identity and segment, neutral and private
 * (`DEFAULT_THEME` in `src/lib/theme.ts`), and on the page's light scheme.
 */
/** `tokens/neutral-dark-palette.ts`: error is oklch(0.704 0.191 22.216), Tailwind's red-400, #FF6467. */
const NEUTRAL_DARK_ERROR = "#FF6467";
/** The brand columns in `BRAND_CODES` order. */
const BRANDS = ["fkas", "tkas", "guen", "fkab", "fkse", "elma", "ngfi"] as const;

/**
 * Opens the palettes page once its inspector is live. The inspector hydrates after the docs
 * shell, and a switch pressed before then changes nothing. The server HTML renders the active tab
 * without `aria-controls`; Base UI's Tabs set it once the panels register after hydration, in the
 * same commit that wires the switches.
 */
async function openInspector(page: Page): Promise<Locator> {
  await page.goto(`${docsBaseUrl()}/handbook/palettes`, { waitUntil: "load" });
  await waitForDocsShellHydration(page);
  const inspector = page.getByRole("region", { name: "Palettes and contrast" });
  await inspector.locator('[role="tab"][aria-selected="true"][aria-controls]').waitFor({ state: "attached" });
  return inspector;
}

/** Presses a theme switch or a collection tab by its exact name. */
async function press(inspector: Locator, role: "button" | "tab", name: string): Promise<void> {
  await inspector.getByRole(role, { name, exact: true }).click();
}

/** The cell of a row in a brand's column, in the table of that name. */
function cell(inspector: Locator, table: string, row: string, brand: (typeof BRANDS)[number]): Locator {
  return inspector
    .getByRole("table", { name: table })
    .locator(`[data-palette-row="${row}"] > td`)
    .nth(BRANDS.indexOf(brand));
}

describe("palettes page", () => {
  const browser = launchSuiteBrowser();

  it("changes every column with the identity, segment and scheme switches", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    await press(inspector, "tab", "Roles");
    const error = cell(inspector, "Color roles", "error", "fkas");
    await expect.poll(() => error.textContent()).not.toContain(NEUTRAL_DARK_ERROR);
    await press(inspector, "button", "Dark");
    await expect.poll(() => error.textContent()).toBe(NEUTRAL_DARK_ERROR);

    // The neutral identity keeps its system greys; branded light points muted at the ramp.
    await press(inspector, "button", "Light");
    const muted = cell(inspector, "Color roles", "muted", "fkas");
    await expect.poll(() => muted.textContent()).not.toContain("brand-neutral-100");
    await press(inspector, "button", "Branded");
    await expect.poll(() => muted.textContent()).toMatch(/points at\s*brand-neutral-100$/u);

    // Telinet is pinned to private and Fjordkraft Företag to company: each shows the other hatched.
    expect(await cell(inspector, "Color roles", "background", "fkab").textContent()).toBe("Company only");
    await press(inspector, "button", "Company");
    await expect
      .poll(() => cell(inspector, "Color roles", "background", "fkse").textContent())
      .toBe("Private only");
    await page.close();
  });

  it("marks each palette's seed step and a single-colour brand's palette 2 as an alias", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    // CONTEXT.md: Telinet's green seeds its palette 2 at 400; Fjordkraft has one colour.
    expect(await cell(inspector, "Brand palettes", "brand-2-400", "fkse").textContent()).toBe("#36C275seed");
    expect(await cell(inspector, "Brand palettes", "brand-2-400", "fkas").textContent()).toMatch(
      /^#[0-9A-F]{6}→points at\s*brand-1-400$/u
    );
    await page.close();
  });

  it("grades a pair below AA with its truncated ratio and counts every Below AA cell", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    await press(inspector, "tab", "Contrast");
    // `tokens/primitives.ts`: white on the fkas orange #FF5604, whose WCAG luminance is 0.279, so
    // 1.05 / 0.329 is 3.19 at 8-bit precision; the resolved OKLCH color measures 3.18.
    const brand = cell(inspector, "Contrast pairs", "brand-foreground/brand", "fkas");
    expect(await brand.textContent()).toMatch(/^Aa3\.1\d:1Below AA$/u);

    // The footer's count against the Below AA badges the table shows, counted in the DOM.
    const table = inspector.getByRole("table", { name: "Contrast pairs" });
    const footer = inspector.getByText(/^\d+ cells? below AA$/u);
    const counts = async (): Promise<{ readonly footer: number; readonly badges: number }> => ({
      footer: Number.parseInt((await footer.textContent()) ?? "", 10),
      badges: await table.getByText("Below AA", { exact: true }).count(),
    });
    const light = await counts();
    expect(light.badges).toBeGreaterThan(0);
    expect(light.footer).toBe(light.badges);

    // Another theme fails another set of pairs, and the footer follows it.
    await press(inspector, "button", "Branded");
    await expect.poll(async () => (await counts()).badges).not.toBe(light.badges);
    const branded = await counts();
    expect(branded.footer).toBe(branded.badges);
    await page.close();
  });
});
