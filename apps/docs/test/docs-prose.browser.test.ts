import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

import { launchSuiteBrowser } from "./demo-page";
import { docsBaseUrl } from "./docs-server";

const browser = launchSuiteBrowser();

function quoteContent(value: string): boolean {
  return value.includes("`");
}

describe("docs prose (Typography)", () => {
  it("applies prose-sm to authored handbook copy", async () => {
    const page = await browser().newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${docsBaseUrl()}/handbook/tokens`, { waitUntil: "load" });

    const fontSize = await page
      .getByText("A token is a CSS custom property with a semantic name.")
      .evaluate((el) => getComputedStyle(el).fontSize);

    expect(fontSize).toBe("14px");

    await page.close();
  });

  it("lets Typography style authored inline code while isolating generated widgets", async () => {
    const page = await browser().newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${docsBaseUrl()}/handbook/tokens`, { waitUntil: "load" });

    const quotes = await page.evaluate(() => {
      const authored = [...document.querySelectorAll("main p code")].find(
        (el) => el.textContent === "@theme"
      );
      const swatchCode = document.querySelector("[data-token-swatch]")?.parentElement?.querySelector("code");
      if (!(authored instanceof HTMLElement) || !(swatchCode instanceof HTMLElement)) {
        throw new Error("expected authored inline code and a token swatch code");
      }
      return {
        authored: getComputedStyle(authored, "::before").content,
        swatch: getComputedStyle(swatchCode, "::before").content,
      };
    });

    expect(quoteContent(quotes.authored)).toBe(true);
    expect(quoteContent(quotes.swatch)).toBe(false);

    await page.close();
  });

  it("paints token swatch borders and empty-token hatches", async () => {
    const tokensPage = await browser().newPage();
    await tokensPage.setViewportSize({ width: 1280, height: 720 });
    await tokensPage.goto(`${docsBaseUrl()}/handbook/tokens`, { waitUntil: "load" });

    const colorBorder = await tokensPage.evaluate(() => {
      const swatch = document.querySelector("[data-token-swatch]");
      if (!(swatch instanceof HTMLElement)) {
        throw new Error("expected a colour token swatch");
      }
      const style = getComputedStyle(swatch);
      return { width: style.borderTopWidth, color: style.borderTopColor };
    });
    expect(Number.parseFloat(colorBorder.width)).toBeGreaterThan(0);
    expect(colorBorder.color).not.toBe("rgba(0, 0, 0, 0)");
    expect(colorBorder.color).not.toBe("transparent");
    await tokensPage.close();

    const buttonPage = await browser().newPage();
    await buttonPage.setViewportSize({ width: 1280, height: 720 });
    await buttonPage.goto(`${docsBaseUrl()}/components/button`, { waitUntil: "load" });

    const hatch = await buttonPage.evaluate(() => {
      const swatches = [...document.querySelectorAll("[data-token-swatch]")];
      const empty = swatches.find((el) =>
        getComputedStyle(el).backgroundImage.includes("repeating-linear-gradient")
      );
      if (!(empty instanceof HTMLElement)) {
        throw new Error("expected a hatched non-colour token swatch");
      }
      const style = getComputedStyle(empty);
      return { image: style.backgroundImage, border: style.borderTopColor };
    });
    expect(hatch.image).toContain("repeating-linear-gradient");
    expect(hatch.border).not.toBe("rgba(0, 0, 0, 0)");
    expect(hatch.border).not.toBe("transparent");
    await buttonPage.close();
  });

  it("isolates docs tables and the theme matrix from prose element styles", async () => {
    const page: Page = await browser().newPage();
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.goto(`${docsBaseUrl()}/handbook/tokens`, { waitUntil: "load" });
    const tableQuotes = await page.evaluate(() => {
      const table = [...document.querySelectorAll("table")].find((el) =>
        (el.querySelector("caption")?.textContent ?? "").includes("min+gzip")
      );
      const entryCode = table?.querySelector("tbody code");
      if (!(entryCode instanceof HTMLElement)) {
        throw new Error("expected a bundle-size table entry code cell");
      }
      return getComputedStyle(entryCode, "::before").content;
    });
    expect(quoteContent(tableQuotes)).toBe(false);

    await page.goto(`${docsBaseUrl()}/handbook/theme-matrix`, { waitUntil: "load" });
    const matrix = await page.evaluate(() => {
      const grid = document.querySelector("[data-theme-matrix]");
      const overlay = [...(grid?.querySelectorAll("button") ?? [])].find(
        (el) => el.textContent === "Overlay"
      );
      if (!(grid instanceof HTMLElement) || !(overlay instanceof HTMLElement)) {
        throw new Error("expected the theme matrix and an Overlay trigger");
      }
      return getComputedStyle(overlay).textDecorationLine;
    });
    expect(matrix).not.toContain("underline");

    await page.close();
  });
});
