import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, waitForDocsShellHydration } from "./demo-page";
import { docsBaseUrl } from "./docs-server";

const browser = launchSuiteBrowser();

/**
 * Oracles: literals from Fuse's token modules, the Figma brand ramps and Fuse's committed contrast
 * snapshot. The table opens on the preview theme's variant and segment, internal and private
 * (`DEFAULT_THEME` in `src/lib/theme.ts`), and on the page's light scheme.
 */
const LIGHT_ERROR = "oklch(0.4526 0.17845 30.42)"; // `tokens/defaults.ts`, ERROR
const DARK_ERROR = { oklch: "oklch(0.8383036 0.089085 26.7575)", hex: "#FFB4AB" }; // `tokens/dark-defaults.ts`
const INTERNAL_FOREGROUND = "oklch(0.15 0.0041 49.31)"; // `tokens/defaults.ts`
const WHITE = { hex: "#FFFFFF", oklch: "oklch(1 0 0)" }; // `tokens/primitives.ts`, WHITE
/** Figma's Fjordkraft shade 100, which the external Fjordkraft background paints. */
const FKAS_SHADE_100 = "#FFEEE6";
/** The sidebar color roles the contract names: the sidebar and its seven companions. */
const SIDEBAR_ROLES = 8;
/** The brand columns in `BRAND_CODES` order. */
const BRANDS = ["fkas", "tkas", "guen", "fkab", "fkse", "elma", "ngfi"] as const;

async function openInspector(page: Page): Promise<Locator> {
  await page.goto(`${docsBaseUrl()}/handbook/palettes`, { waitUntil: "load" });
  await waitForDocsShellHydration(page);
  const inspector = page.locator("[data-palette-inspector]");
  await inspector.scrollIntoViewIfNeeded();
  // The table hydrates after the shell; a switch pressed before then changes nothing.
  await expect
    .poll(async () => {
      await inspector.getByRole("button", { name: "Dark", exact: true }).click();
      return inspector.getByRole("button", { name: "Dark", exact: true }).getAttribute("aria-pressed");
    })
    .toBe("true");
  await inspector.getByRole("button", { name: "Light", exact: true }).click();
  return inspector;
}

/** The table cell of a row in a brand's column. */
function cell(inspector: Locator, row: string, brand: (typeof BRANDS)[number]): Locator {
  return inspector.locator(`[data-table-row="${row}"] > td`).nth(1 + BRANDS.indexOf(brand));
}

function trigger(inspector: Locator, row: string, brand: (typeof BRANDS)[number]): Locator {
  return cell(inspector, row, brand).locator("[data-grid-cell]");
}

const openTooltip = (page: Page): Locator => page.locator('[role="tooltip"][data-open]');

/** The open tooltip's text once the pointer rests on a cell. */
async function hoverReadout(page: Page, target: Locator): Promise<string> {
  await expect
    .poll(async () => {
      await page.mouse.move(0, 0);
      await target.hover();
      return openTooltip(page).count();
    })
    .toBe(1);
  return (await openTooltip(page).textContent()) ?? "";
}

async function pick(inspector: Locator, name: string): Promise<void> {
  await inspector.getByRole("button", { name, exact: true }).click();
}

function rows(inspector: Locator): Locator {
  return inspector.locator("[data-table-row]");
}

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("expected a rendered element with a bounding box");
  return box;
}

describe("palettes variables table", () => {
  it("changes its cells with the variant, segment and scheme switches", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    expect(await hoverReadout(page, trigger(inspector, "error", "fkas"))).toContain(LIGHT_ERROR);

    await pick(inspector, "Dark");
    await pick(inspector, "External");
    const dark = await hoverReadout(page, trigger(inspector, "error", "fkas"));
    expect(dark).toContain(DARK_ERROR.oklch);
    expect(dark).toContain(DARK_ERROR.hex);

    // Telinet is pinned to private and Fjordkraft Företag to company: each shows the other hatched.
    expect(await cell(inspector, "background", "fkab").textContent()).toBe("Company only");
    await pick(inspector, "Company");
    expect(await cell(inspector, "background", "fkse").textContent()).toBe("Private only");
    expect(await cell(inspector, "background", "fkab").locator("[data-pinned-cell]").count()).toBe(0);
    await page.close();
  });

  it("writes values in hex or OKLCH and pills a role on a ramp step or an alias", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    expect(await trigger(inspector, "card", "fkas").textContent()).toBe(WHITE.hex);
    await pick(inspector, "OKLCH");
    expect(await trigger(inspector, "card", "fkas").textContent()).toBe(WHITE.oklch);
    // `tokens/defaults.ts`: dialog is var(--popover).
    expect(await trigger(inspector, "dialog", "fkas").locator("[data-palette-pill]").textContent()).toBe(
      "popover"
    );

    await pick(inspector, "External");
    const background = trigger(inspector, "background", "fkas");
    expect(await background.locator("[data-palette-pill]").textContent()).toBe("shade-100");
    const readout = await hoverReadout(page, background);
    expect(readout).toContain(FKAS_SHADE_100);
    expect(readout).toContain("brand-shade-100");
    await page.close();
  });

  it("narrows its rows by search and by the section and contrast filters", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    // Every color role in the contract: 115, `packages/fuse/src/theme/tokens/contract.ts`.
    await expect.poll(() => rows(inspector).count()).toBe(115);
    const search = inspector.getByRole("searchbox", { name: "Search tokens" });
    await search.fill("sidebar");
    await expect.poll(() => rows(inspector).count()).toBe(SIDEBAR_ROLES);
    await search.fill(FKAS_SHADE_100.toLowerCase());
    await expect.poll(() => rows(inspector).count()).toBe(0);
    await search.fill("");

    // A rail section sets the section filter, which the filter bar shows as a chip.
    await inspector
      .getByRole("navigation", { name: "Collections" })
      .getByRole("button", { name: /^Sidebar/u })
      .click();
    await expect.poll(() => rows(inspector).count()).toBe(SIDEBAR_ROLES);
    expect(await inspector.getByRole("group", { name: "Section filter" }).count()).toBe(1);

    await inspector
      .getByRole("navigation", { name: "Collections" })
      .getByRole("button", { name: /^Contrast/u })
      .click();
    await inspector.getByRole("button", { name: "Filter", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("searchbox", { name: "Search fields", exact: true }).fill("Contrast");
    const field = page.getByRole("menuitem", { name: "Contrast", exact: true });
    await expect.poll(() => field.getAttribute("data-highlighted")).not.toBeNull();
    await page.keyboard.press("ArrowRight");
    await page.getByRole("menuitemcheckbox", { name: /^Below AA/u }).click();
    await page.keyboard.press("Escape");
    const ids = await rows(inspector).evaluateAll((elements) =>
      elements.map((row) => row.getAttribute("data-table-row"))
    );
    // The fkas orange under white sits below AA in the internal theme, 3.18:1.
    expect(ids).toContain("brand-foreground/brand");
    expect(ids.length).toBeLessThan(40);
    await page.close();
  });

  it("tints a contrast cell below AA and counts it in the footer", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    await inspector
      .getByRole("navigation", { name: "Collections" })
      .getByRole("button", { name: /^Contrast/u })
      .click();
    const brand = trigger(inspector, "brand-foreground/brand", "fkas");
    expect(await brand.getAttribute("data-contrast-cell")).toBe("below-aa");
    // WCAG luminance of #FF5604 is 0.279, so white on it is 1.05 / 0.329, 3.19 at 8-bit precision.
    expect(await brand.textContent()).toMatch(/^Aa3\.1\d:1Below AA$/u);
    expect(await brand.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
      "rgba(0, 0, 0, 0)"
    );
    const sample = brand.locator("[data-pair-sample]");
    expect(
      await sample.evaluate((element) => ({
        text: getComputedStyle(element).color,
        fill: getComputedStyle(element).backgroundColor,
      }))
    ).toEqual({ text: WHITE.oklch, fill: "oklch(0.68 0.21747 38.8)" });
    expect(await inspector.locator("[data-failing-count]").textContent()).toMatch(/^\d+ cells? below AA$/u);
    expect(await inspector.locator("[data-failing-count]").textContent()).not.toBe("0 cells below AA");
    await page.close();
  });

  it("opens a cell's readout from the keyboard and moves between cells with the arrow keys", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    await inspector.getByRole("button", { name: "Filter", exact: true }).focus();
    await page.keyboard.press("Tab");
    const focused = () =>
      page.evaluate(() => {
        const element = document.activeElement;
        return {
          row: element?.closest("tr")?.getAttribute("data-table-row") ?? null,
          column: element?.getAttribute("data-column") ?? null,
        };
      });
    // One tab stop into the table lands on its first cell, and focus opens the readout.
    await expect.poll(focused).toEqual({ row: "background", column: "0" });
    await expect.poll(() => openTooltip(page).textContent()).toContain(WHITE.oklch);
    await page.keyboard.press("ArrowRight");
    await expect.poll(focused).toEqual({ row: "background", column: "1" });
    await page.keyboard.press("ArrowDown");
    await expect.poll(focused).toEqual({ row: "foreground", column: "1" });
    await expect.poll(() => openTooltip(page).textContent()).toContain(INTERNAL_FOREGROUND);
    // In the private segment Fjordkraft Företag is pinned to company: the arrow keys stop on its
    // hatched cell and go on past it.
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect.poll(focused).toEqual({ row: "foreground", column: "3" });
    expect(await page.evaluate(() => document.activeElement?.hasAttribute("data-pinned-cell") ?? false)).toBe(
      true
    );
    await page.keyboard.press("ArrowRight");
    await expect.poll(focused).toEqual({ row: "foreground", column: "4" });
    await page.keyboard.press("End");
    await expect.poll(focused).toEqual({ row: "foreground", column: "6" });
    // The next Tab leaves the table rather than walking its cells, and Shift+Tab comes back to the
    // cell focus left: the grid keeps one tab stop, and it moves with focus.
    await page.keyboard.press("Tab");
    await expect.poll(async () => (await focused()).row).toBeNull();
    await page.keyboard.press("Shift+Tab");
    await expect.poll(focused).toEqual({ row: "foreground", column: "6" });
    expect(await inspector.locator('[data-grid-cell][tabindex="0"]').count()).toBe(1);
    await page.close();
  });

  it("is an ARIA grid whose rows are headed by their names", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    const grid = inspector.getByRole("grid", { name: "Palette tokens" });
    expect(await grid.count()).toBe(1);
    const row = grid
      .getByRole("row")
      .filter({ has: page.getByRole("rowheader", { name: "background", exact: true }) });
    expect(await row.count()).toBe(1);
    // The row header and one cell per brand, each cell holding its copy button.
    expect(await row.getByRole("rowheader").allTextContents()).toEqual(["background"]);
    expect(await row.getByRole("gridcell").count()).toBe(BRANDS.length);
    expect(await row.getByRole("gridcell").first().getByRole("button").textContent()).toBe(WHITE.hex);
    // The header row names the brands as column headers.
    expect(await grid.getByRole("columnheader").count()).toBe(1 + BRANDS.length);
    // One cell in the whole grid is the tab stop before any focus has landed in it.
    expect(await grid.locator('[data-grid-cell][tabindex="0"]').count()).toBe(1);
    await page.close();
  });

  it("keeps the focus ring on a focused cell that shares its color with others", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    await inspector.getByRole("button", { name: "Filter", exact: true }).focus();
    await page.keyboard.press("Tab");
    const background = trigger(inspector, "background", "fkas");
    await expect.poll(() => background.evaluate((element) => element === document.activeElement)).toBe(true);
    // `tokens/defaults.ts`: card is WHITE too, so focus outlines both.
    const card = trigger(inspector, "card", "fkas");
    await expect.poll(() => card.getAttribute("data-same-tone")).toBe("");
    expect(await background.getAttribute("data-same-tone")).toBe("");
    const ring = (target: Locator) => target.evaluate((element) => getComputedStyle(element).boxShadow);
    // The tooltip trigger's focus ring is Fuse's 2px ring, inset in a cell; the same-color mark is
    // a 1px inset ring. The focused cell keeps its focus ring and its neighbour shows the mark.
    const focusedRing = await ring(background);
    expect(focusedRing).toContain("0px 0px 0px 2px inset");
    expect(focusedRing).not.toContain("0px 0px 0px 1px");
    expect(await ring(card)).toContain("0px 0px 0px 1px inset");
    await page.close();
  });

  it("keeps the tooltip open across the line between two cells and outlines equal colors", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    const background = trigger(inspector, "background", "fkas");
    await hoverReadout(page, background);
    // `tokens/defaults.ts`: card and popover are WHITE too, so the column outlines them together.
    await expect.poll(() => trigger(inspector, "card", "fkas").getAttribute("data-same-tone")).toBe("");
    expect(await trigger(inspector, "foreground", "fkas").getAttribute("data-same-tone")).toBeNull();

    const above = await boxOf(cell(inspector, "background", "fkas"));
    // The row line's upper half belongs to this cell in a collapsed table, outside its button's box.
    await page.mouse.move(above.x + above.width / 2, above.y + above.height - 0.5, { steps: 4 });
    // Longer than the tooltip's exit animation, so a tooltip that closed has left the page.
    await page.waitForTimeout(500);
    expect(await openTooltip(page).count()).toBe(1);
    await page.close();
  });

  it("describes each cell by its own readout only", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    await hoverReadout(page, trigger(inspector, "foreground", "fkas"));
    const described = (target: Locator) =>
      target.evaluate((element) =>
        (element.getAttribute("aria-describedby") ?? "")
          .split(/\s+/u)
          .filter(Boolean)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
      );
    expect(await described(trigger(inspector, "foreground", "fkas"))).toContain(INTERNAL_FOREGROUND);
    expect(await described(trigger(inspector, "background", "fkas"))).not.toContain(INTERNAL_FOREGROUND);
    await page.close();
  });

  it("copies a cell's value on press and says so", async () => {
    const context = await browser().newContext({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const page = await context.newPage();
    const inspector = await openInspector(page);
    await hoverReadout(page, trigger(inspector, "foreground", "fkas"));
    await trigger(inspector, "foreground", "fkas").click();
    const status = inspector.getByRole("status").filter({ hasText: "Copied" });
    await expect.poll(() => status.textContent()).toBe("Copied #0D0B0A");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("#0D0B0A");
    await context.close();
  });

  it("copies a translucent value as a color CSS parses, in hex and in OKLCH", async () => {
    const context = await browser().newContext({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const page = await context.newPage();
    const inspector = await openInspector(page);
    const shadow = trigger(inspector, "card-shadow", "fkas");
    const copied = async (): Promise<{ text: string; parses: boolean }> => {
      await hoverReadout(page, shadow);
      await page.evaluate(() => navigator.clipboard.writeText(""));
      await shadow.click();
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).not.toBe("");
      return page.evaluate(async () => {
        const text = await navigator.clipboard.readText();
        return { text, parses: CSS.supports("color", text) };
      });
    };
    // `tokens/defaults.ts`: card-shadow is oklch(0 0 0 / 0.05), black at 5%, 0x0D of 0xFF.
    expect(await copied()).toEqual({ text: "#0000000D", parses: true });
    await pick(inspector, "OKLCH");
    expect(await copied()).toEqual({ text: "oklch(0 0 0 / 0.05)", parses: true });
    await context.close();
  });

  it("scrolls the brands sideways on a phone and keeps the name column in place", async () => {
    const page = await browser().newPage({ viewport: { width: 390, height: 844 }, colorScheme: "light" });
    const inspector = await openInspector(page);
    const scroller = inspector.locator('[data-slot="table-container"]');
    const name = inspector.locator('[data-table-row="background"] > td').first();
    const value = cell(inspector, "background", "tkas");
    const [nameBefore, valueBefore] = [await boxOf(name), await boxOf(value)];
    await scroller.evaluate((element) => element.scrollBy({ left: 200 }));
    await expect.poll(async () => (await boxOf(value)).x).toBeLessThan(valueBefore.x - 100);
    expect((await boxOf(name)).x).toBeCloseTo(nameBefore.x, 0);
    // The rail is a Select on a phone.
    expect(await inspector.getByRole("combobox", { name: "Collection" }).isVisible()).toBe(true);
    await page.close();
  });

  it("keeps a focused cell clear of the sticky header, however tall the header grows", async () => {
    const page = await browser().newPage({ viewport: { width: 1280, height: 720 }, colorScheme: "light" });
    const inspector = await openInspector(page);
    // In Brand ramps the generated badge stacks under Elmera's name, so the header is taller.
    await inspector
      .getByRole("navigation", { name: "Collections" })
      .getByRole("button", { name: /^Brand ramps/u })
      .click();
    await inspector.getByRole("button", { name: "Filter", exact: true }).focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Control+End");
    for (let press = 0; press < 11; press += 1) {
      await page.keyboard.press("ArrowUp");
    }
    const clearance = () =>
      page.evaluate(() => {
        const cell = document.activeElement;
        // The header cells are sticky; the thead itself scrolls away with the table.
        const head = cell?.closest("table")?.querySelector("thead th") ?? null;
        if (cell === null || head === null) return null;
        return cell.getBoundingClientRect().top - head.getBoundingClientRect().bottom;
      });
    await expect.poll(clearance).not.toBeNull();
    expect(await clearance()).toBeGreaterThanOrEqual(-0.5);
    await page.close();
  });

  it("keeps the page still when an arrow key meets the grid's edge", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    await inspector.getByRole("button", { name: "Filter", exact: true }).focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Control+End");
    const focusedRow = () =>
      page.evaluate(() => document.activeElement?.closest("tr")?.getAttribute("data-table-row") ?? null);
    // The last role in the contract, `packages/fuse/src/theme/tokens/contract.ts`.
    await expect.poll(focusedRow).toBe("sh-comment");
    const scrollBefore = await page.evaluate(() => window.scrollY);
    for (let press = 0; press < 5; press += 1) {
      await page.keyboard.press("ArrowDown");
    }
    await page.keyboard.press("ArrowRight");
    // A key the grid lets through scrolls the page smoothly, so wait out that animation first.
    await page.waitForTimeout(500);
    expect(await focusedRow()).toBe("sh-comment");
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    await page.close();
  });

  it("keeps each brand header, a generated ramp's badge too, within its column", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, colorScheme: "light" });
    const inspector = await openInspector(page);
    await inspector
      .getByRole("navigation", { name: "Collections" })
      .getByRole("button", { name: /^Brand ramps/u })
      .click();
    const headers = inspector.locator("thead th:has([data-brand-header])");
    await expect.poll(() => headers.count()).toBe(BRANDS.length);
    const overflow = await headers.evaluateAll((cells) =>
      cells.map((cell) => {
        const box = cell.getBoundingClientRect();
        const parts = [...cell.querySelectorAll("[data-brand-header], [data-brand-header] *")];
        const right = Math.max(...parts.map((part) => part.getBoundingClientRect().right));
        return { text: cell.textContent, over: Math.max(0, right - box.right) };
      })
    );
    // `GENERATED_BRAND_RAMPS`: Elmera and Nordic Green Energy carry the badge.
    expect(overflow.filter((entry) => entry.text.includes("generated")).length).toBe(2);
    expect(overflow.filter((entry) => entry.over > 0.5)).toEqual([]);
    await page.close();
  });
});

describe("palettes page layout", () => {
  it("gives the table the full width and hands the prose layout back on the next page", async () => {
    const page = await browser().newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
    await page.goto(`${docsBaseUrl()}/components/button`, { waitUntil: "load" });
    await waitForDocsShellHydration(page);
    const main = page.locator("main");
    const quickNav = page.getByRole("navigation", { name: "On this page" });
    const sideNav = page.getByRole("navigation", { name: "Main navigation" });
    // `docs-shell.tsx`: the prose column's measure.
    const PROSE_WIDTH = 720;
    expect((await boxOf(main)).width).toBeLessThanOrEqual(PROSE_WIDTH);
    expect(await quickNav.isVisible()).toBe(true);

    await sideNav.getByRole("link", { name: "Palettes & contrast", exact: true }).click();
    await page.waitForURL(/\/handbook\/palettes$/u);
    await expect.poll(async () => (await boxOf(page.locator("main"))).width).toBeGreaterThan(PROSE_WIDTH);
    expect(await page.getByRole("navigation", { name: "On this page" }).isVisible()).toBe(false);
    // Five or more brand columns fit beside the side navigation and the rail.
    const scroller = page.locator('[data-palette-inspector] [data-slot="table-container"]');
    const visibleBrands = await scroller.evaluate((element) => {
      const right = element.getBoundingClientRect().right;
      return (
        [...element.querySelectorAll("thead th")].filter(
          (th) => th.getBoundingClientRect().right <= right + 0.5
        ).length - 1
      );
    });
    expect(visibleBrands).toBeGreaterThanOrEqual(5);

    // A client navigation keeps the palettes page mounted but hidden; the layout must not follow it.
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Button", exact: true })
      .click();
    await page.waitForURL(/\/components\/button$/u);
    await expect.poll(async () => (await boxOf(page.locator("main"))).width).toBeLessThanOrEqual(PROSE_WIDTH);
    await expect.poll(() => page.getByRole("navigation", { name: "On this page" }).isVisible()).toBe(true);
    await page.close();
  });
});
