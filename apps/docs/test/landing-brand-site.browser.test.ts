import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import * as CssColor from "@elmeragroup/color/css-color";
import * as Hex from "@elmeragroup/color/hex";
import { getOrThrow } from "@elmeragroup/color/result";
import type * as Srgb from "@elmeragroup/color/srgb";
import { contrastRatio, relativeLuminance } from "@elmeragroup/color/wcag";

import { DESKTOP_VIEWPORT } from "./demo-page";
import {
  ALL_SITES,
  DASHBOARD_FIRST,
  ELMERA,
  FJORDKRAFT,
  PHONE_VIEWPORT,
  PHOTO_SITES,
  brandSite,
  isInert,
  pickBrand,
  showSide,
  WIDE_VIEWPORT,
  windowCaption,
} from "./landing-dashboard";
import type { SiteFacts } from "./landing-dashboard";
import { expectTargets, launchLandingSuite } from "./landing-page";
import type { LandingOptions } from "./landing-page";

const { openLanding } = launchLandingSuite({ search: DASHBOARD_FIRST });

/** Opens the landing on `facts`' brand with the External side showing, and waits for its site. */
async function openSite(
  facts: SiteFacts,
  viewport: { readonly width: number; readonly height: number },
  options?: LandingOptions
): Promise<{ page: Page; site: Locator }> {
  const page = await openLanding(viewport, options);
  if (facts.brand !== "elma") {
    await pickBrand(page, facts.brand);
  }
  await showSide(page, "External");
  const site = brandSite(page, facts.site);
  await site.getByRole("heading", { level: 1 }).waitFor();
  return { page, site };
}

/**
 * The text of every element under `scroller` matching `selector` that pokes out of the
 * scroller's sides. The scroller clips, so such an element is cut off rather than scrollable.
 */
async function outsideScroller(scroller: Locator, selector: string): Promise<string[]> {
  return scroller.evaluate((element, query) => {
    const box = element.getBoundingClientRect();
    return [...element.querySelectorAll(query)]
      .filter((candidate) => candidate.closest("[aria-hidden='true']") === null)
      .filter((candidate) => candidate.checkVisibility({ visibilityProperty: true }))
      .map((candidate) => ({ candidate, rect: candidate.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && (rect.left < box.left - 1 || rect.right > box.right + 1))
      .map(({ candidate }) => candidate.textContent.trim().slice(0, 40) || candidate.outerHTML.slice(0, 60));
  }, selector);
}

/**
 * Sets the sites' text in one wide sans before the page parses. The theme names Roboto, which the
 * docs app does not load, so each platform draws its own fallback: macOS's system UI font, or
 * DejaVu Sans on a Linux runner, which sets the same copy wider. Verdana shares DejaVu's metrics
 * (both descend from Bitstream Vera), so every platform measures the header at the widest of them.
 */
async function wideFallbackFont(page: Page): Promise<void> {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = `[data-site-scroller], [data-site-scroller] * { font-family: Verdana, "DejaVu Sans", sans-serif }`;
      document.head.append(style);
    });
  });
}

/** Below this WCAG relative luminance a surface reads as dark: mid grey sits at 0.18. */
const DARK_SURFACE_LUMINANCE = 0.18;

/** A band of the site as painted: its surface and the colour of the first text on it. */
type PaintedBand = { readonly name: string; readonly surface: Srgb.Srgb; readonly text: Srgb.Srgb };

/**
 * The hero's block, then every band below the hero that paints its own surface, then the footer,
 * each with the colour of its heading (or its first paragraph), parsed from the computed colours.
 * The hero's block is the nearest opaque surface behind its title: Chromium writes a translucent
 * colour with an alpha (`rgba()`, `/ a`), and such a fill, like the overlay hero's title pill,
 * takes its look from the photo beneath.
 */
async function paintedBands(site: Locator): Promise<PaintedBand[]> {
  // DOM audit: bands are the sections of the scroller's content between header and footer; their paint has no accessible form.
  const read = await site.locator("[data-site-scroller]").evaluate((scroller) => {
    const opaque = (color: string) => !/^rgba|\/ /u.test(color);
    const title = scroller.querySelector("h1");
    let block = title?.parentElement ?? null;
    while (block !== null && block !== scroller && !opaque(getComputedStyle(block).backgroundColor)) {
      block = block.parentElement;
    }
    const hero =
      title === null || block === null
        ? []
        : [
            {
              name: "hero",
              surface: getComputedStyle(block).backgroundColor,
              text: getComputedStyle(title).color,
            },
          ];
    const sections = [...scroller.querySelectorAll(":scope > :not(header, footer) > section")].slice(1);
    const footer = scroller.querySelector("footer");
    const bands = [...sections, ...(footer === null ? [] : [footer])].flatMap((band) => {
      const surface = getComputedStyle(band).backgroundColor;
      const text = band.querySelector("h2, h3, p");
      if (surface === "rgba(0, 0, 0, 0)" || text === null) {
        return [];
      }
      return [
        {
          name: band.getAttribute("aria-label") ?? text.textContent.trim().slice(0, 40),
          surface,
          text: getComputedStyle(text).color,
        },
      ];
    });
    return [...hero, ...bands];
  });
  return read.map((band) => ({
    name: band.name,
    surface: CssColor.toSrgb(getOrThrow(CssColor.parse(band.surface))),
    text: CssColor.toSrgb(getOrThrow(CssColor.parse(band.text))),
  }));
}

/** WCAG 1.4.11's floor for the parts of a graphic a visitor needs to recognise it. */
const GRAPHIC_CONTRAST = 3;

/** The header's logo as painted: the nearest opaque surface behind it and each ink it draws in. */
type PaintedLogo = { readonly surface: Srgb.Srgb; readonly inks: readonly Srgb.Srgb[] };

/**
 * Reads the computed paint of the header logo named `name`. An SVG logo draws in the fill of each
 * of its shapes; a masked wordmark draws in its own background colour.
 */
async function paintedLogo(site: Locator, name: string): Promise<PaintedLogo> {
  // DOM audit: the header sits inside the site's region, where it is not a banner landmark.
  const logo = site.locator("header").getByRole("img", { name, exact: true }).first();
  const read = await logo.evaluate((element) => {
    const opaque = (color: string) => color !== "rgba(0, 0, 0, 0)" && !/^rgba|\/ /u.test(color);
    let block = element.parentElement;
    while (block !== null && !opaque(getComputedStyle(block).backgroundColor)) {
      block = block.parentElement;
    }
    const drawn = [...element.querySelectorAll("path, circle, ellipse, rect, polygon, polyline")];
    const inks =
      drawn.length === 0
        ? [getComputedStyle(element).backgroundColor]
        : drawn.map((part) => getComputedStyle(part).fill).filter((fill) => fill !== "none");
    return {
      surface: block === null ? "" : getComputedStyle(block).backgroundColor,
      inks: [...new Set(inks)],
    };
  });
  return {
    surface: CssColor.toSrgb(getOrThrow(CssColor.parse(read.surface))),
    inks: read.inks.map((ink) => CssColor.toSrgb(getOrThrow(CssColor.parse(ink)))),
  };
}

describe("landing hero window, External side", () => {
  it.each(ALL_SITES)("states $site's language, logo, hero and section headings", async (facts) => {
    const { page, site } = await openSite(facts, DESKTOP_VIEWPORT);
    expect(await site.getAttribute("lang")).toBe(facts.lang);
    expect(await windowCaption(page)).toContain(facts.domain);
    await site.getByRole("img", { name: facts.logo, exact: true }).first().waitFor();
    expect(await site.getByRole("heading", { level: 1 }).textContent()).toBe(facts.heading);
    // The site sits inside the landing's main, so it draws no main of its own.
    expect(await page.getByRole("main").count()).toBe(1);
    expect(await site.getByRole("heading", { level: 2 }).allTextContents()).toEqual(facts.sections);
    for (const name of facts.labelled) {
      expect(await site.getByRole("region", { name, exact: true }).count(), name).toBe(1);
    }
    await page.context().close();
  });

  it("re-themes the landing from a brand card on Elmera Group's site and moves focus into the new site", async () => {
    const { page, site } = await openSite(ELMERA, DESKTOP_VIEWPORT);
    const brands = site.getByRole("list", { name: "Our brands" });
    await brands.scrollIntoViewIfNeeded();
    // By keyboard: the card unmounts with Elmera Group's site, so focus must move on with it.
    await brands.getByRole("button", { name: /^Fjordkraft Electricity/u }).focus();
    await page.keyboard.press("Enter");
    await expect.poll(async () => page.locator("html").getAttribute("data-theme-brand")).toBe("fkas");
    const fjordkraft = brandSite(page, FJORDKRAFT.site);
    const heading = fjordkraft.getByRole("heading", { level: 1, name: FJORDKRAFT.heading });
    await heading.waitFor();
    expect(await isInert(fjordkraft)).toBe(false);
    await expect
      .poll(async () => heading.evaluate((element) => element === document.activeElement))
      .toBe(true);
    await page.context().close();
  });

  it("lists Fjordkraft's hero checklist", async () => {
    const { page, site } = await openSite(FJORDKRAFT, DESKTOP_VIEWPORT);
    const checklist = site.getByRole("list", { name: "Fordeler" });
    expect(await checklist.getByRole("listitem").allTextContents()).toEqual(FJORDKRAFT.checklist);
    await page.context().close();
  });

  it.each(ALL_SITES)(
    "opens every nav menu, any price select and the phone menu Sheet of $site without a page error",
    async (facts) => {
      const { page, site } = await openSite(facts, WIDE_VIEWPORT);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const nav = site.getByRole("navigation", { name: facts.nav });
      for (const menu of facts.menus) {
        await nav.getByRole("button", { name: menu, exact: true }).click();
        // The panel portals into the side's scope, outside the nav landmark.
        const panel = site.locator("[data-slot='navigation-menu-content']");
        await expect
          .poll(async () => errors.length > 0 || (await panel.getByRole("link").count()) > 0)
          .toBe(true);
        expect(errors, menu).toEqual([]);
        await expectTargets(panel, `${facts.site} ${menu} panel`);
        await page.keyboard.press("Escape");
        await expect.poll(async () => panel.count()).toBe(0);
      }

      const priceArea = site.getByRole("combobox", { name: /prisområde|Price area/u });
      if (facts.priceArea === null) {
        expect(await priceArea.count()).toBe(0);
      } else {
        expect(await priceArea.getAttribute("aria-labelledby")).not.toBeNull();
        await priceArea.scrollIntoViewIfNeeded();
        await priceArea.click();
        await page.getByRole("option", { name: facts.priceArea.option }).click();
        await site.getByText(facts.priceArea.unit).first().waitFor();
        expect(errors, "price area").toEqual([]);
      }
      await page.context().close();

      const phone = await openSite(facts, PHONE_VIEWPORT);
      const phoneErrors: string[] = [];
      phone.page.on("pageerror", (error) => phoneErrors.push(error.message));
      await phone.site.getByRole("button", { name: facts.menuButton, exact: true }).click();
      const sheet = phone.page.getByRole("dialog", { name: facts.menuButton });
      await sheet.waitFor();
      expect(phoneErrors).toEqual([]);
      for (const menu of facts.menus) {
        expect(await sheet.getByText(menu, { exact: true }).count(), menu).toBeGreaterThan(0);
      }
      for (const link of [...facts.utility, ...(facts.search === null ? [] : [facts.search])]) {
        expect(await sheet.getByRole("link", { name: link, exact: true }).count(), link).toBe(1);
      }
      await expectTargets(sheet, `${facts.site} menu Sheet`);
      await phone.page.context().close();
    }
  );

  it.each(ALL_SITES)(
    "keeps the phone page from scrolling sideways or clipping copy on $site",
    async (facts) => {
      const { page, site } = await openSite(facts, PHONE_VIEWPORT);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBe(0);
      // DOM audit: the site's scroller is the only element under the side that scrolls; it has no role.
      const scroller = site.locator("[data-site-scroller]");
      expect(await scroller.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0);
      // The scroller clips sideways overflow, so also check that every piece of copy and every
      // control sits inside its width: clipped text is as lost as text scrolled out of view.
      expect(await outsideScroller(scroller, "h1, h2, h3, p, li, a, button, blockquote, figcaption")).toEqual(
        []
      );
      await page.context().close();
    }
  );

  it.each(
    ALL_SITES.flatMap((facts) =>
      [1024, 1280, 1440].map((width) => ({ facts, viewport: { width, height: 900 } }))
    )
  )(
    "fits every header control of $facts.site inside the window at $viewport.width px in a wide fallback font",
    async ({ facts, viewport }) => {
      const { page, site } = await openSite(facts, viewport, { prepare: wideFallbackFont });
      // DOM audit: the header sits inside the site's region, where it is not a banner landmark.
      const header = site.locator("header");
      const scroller = site.locator("[data-site-scroller]");
      expect(await header.locator(":is(a, button)").count()).toBeGreaterThan(0);
      expect(await outsideScroller(scroller, "header :is(a, button)")).toEqual([]);
      await page.context().close();
    }
  );

  it.each(
    ALL_SITES.flatMap((facts) => [
      { facts, viewport: WIDE_VIEWPORT, at: "desktop" },
      { facts, viewport: PHONE_VIEWPORT, at: "phone" },
    ])
  )("gives every control on $facts.site at $at a target of at least 24px", async ({ facts, viewport }) => {
    const { page, site } = await openSite(facts, viewport);
    await expectTargets(site, `${facts.site} at ${String(viewport.width)}px`);
    await page.context().close();
  });

  it.each(PHOTO_SITES)("gives every image on $site an alt text and its intrinsic size", async (facts) => {
    const { page, site } = await openSite(facts, DESKTOP_VIEWPORT);
    const images = await site.locator("img").evaluateAll(async (elements) =>
      Promise.all(
        elements.map(async (element) => {
          if (!(element instanceof HTMLImageElement)) {
            return { src: "not an img" };
          }
          element.loading = "eager";
          await element.decode().catch(() => undefined);
          return {
            src: element.getAttribute("src"),
            alt: element.alt,
            width: Number(element.getAttribute("width")),
            height: Number(element.getAttribute("height")),
            naturalWidth: element.naturalWidth,
            naturalHeight: element.naturalHeight,
          };
        })
      )
    );
    expect(images).toHaveLength(facts.photos);
    for (const image of images) {
      expect(image.alt, String(image.src)).not.toBe("");
      expect([image.width, image.height], String(image.src)).toEqual([
        image.naturalWidth,
        image.naturalHeight,
      ]);
    }
    await page.context().close();
  });

  it.each(ALL_SITES)(
    "keeps $site's hero and bands on dark surfaces with readable text in dark mode",
    async (facts) => {
      const { page, site } = await openSite(facts, WIDE_VIEWPORT, { colorScheme: "dark" });
      expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
      // The hero's block, every band below it and the footer, each with the text a visitor reads first on it.
      const bands = await paintedBands(site);
      expect(bands.length).toBeGreaterThan(1);
      for (const band of bands) {
        // Unit under test: the band's computed paint. Oracle: WCAG relative luminance and
        // contrast from @elmeragroup/color, with a dark surface as one darker than mid grey.
        expect(relativeLuminance(band.surface), `${band.name} surface`).toBeLessThan(DARK_SURFACE_LUMINANCE);
        const ratio = contrastRatio(band.text, band.surface);
        expect(ratio._tag === "ok" ? ratio.value : 0, `${band.name} text`).toBeGreaterThanOrEqual(4.5);
      }
      await page.context().close();
    }
  );

  it.each(ALL_SITES)(
    "draws $site's header logo in an ink that reads on the header in dark mode",
    async (facts) => {
      const { page, site } = await openSite(facts, WIDE_VIEWPORT, { colorScheme: "dark" });
      const logo = await paintedLogo(site, facts.logo);
      expect(logo.inks.length).toBeGreaterThan(0);
      for (const ink of logo.inks) {
        // Unit under test: the logo's computed paint. Oracle: WCAG contrast from @elmeragroup/color
        // against the 3:1 floor WCAG 1.4.11 sets for graphics.
        const ratio = contrastRatio(ink, logo.surface);
        expect(ratio._tag === "ok" ? ratio.value : 0, Hex.formatOpaque(ink)).toBeGreaterThanOrEqual(
          GRAPHIC_CONTRAST
        );
      }
      await page.context().close();
    }
  );
});
