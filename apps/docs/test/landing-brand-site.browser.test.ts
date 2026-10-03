import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import * as CssColor from "@elmeragroup/color/css-color";
import { getOrThrow } from "@elmeragroup/color/result";
import type * as Srgb from "@elmeragroup/color/srgb";
import { contrastRatio, relativeLuminance } from "@elmeragroup/color/wcag";

import { DESKTOP_VIEWPORT, readThemeAttributes } from "./demo-page";
import {
  PHONE_VIEWPORT,
  brandSite,
  dashboard,
  liveDemo,
  openNewOrder,
  pickBrand,
  row,
  showSide,
  WIDE_VIEWPORT,
  windowCaption,
} from "./landing-dashboard";
import { expectTargets, launchLandingSuite } from "./landing-page";

const { openLanding } = launchLandingSuite();

/**
 * What each site states, as its reference writes it: the test's own copy, so a config change
 * that drops a heading, the language or a menu fails here instead of passing. `sections` are
 * the visible section headings below the hero, in page order; `labelled` are the sections the
 * reference draws without a heading, which carry an accessible name instead. `utility` and
 * `search` are the header's links that fold into the menu Sheet on a phone. `photos` counts the
 * photos the reference shows.
 */
const ELMERA = {
  site: "Elmera Group",
  brand: "elma",
  domain: "elmeragroup.no",
  lang: "en",
  logo: "Elmera Group",
  heading: "Preferred by more customers. Every day.",
  sections: ["The share", "Our brands", "What we do", "Work with us"],
  labelled: [],
  nav: "Main",
  menus: ["Our group", "Investors", "Sustainability"],
  utility: [],
  search: null,
  menuButton: "Menu",
  photos: 0,
  priceArea: null,
} as const;

const FJORDKRAFT = {
  site: "Fjordkraft",
  brand: "fkas",
  domain: "fjordkraft.no",
  lang: "nb",
  logo: "Fjordkraft",
  heading: "Bytt strømleverandør raskt og enkelt",
  checklist: [
    "Få hjelp til å spare i Fjordkraft-appen",
    "Ingen skjulte gebyrer eller påslag",
    "Strøm og nettleie samlet på én regning",
  ],
  sections: [
    "Spørsmål om Norgespris?",
    "Sjekk dagens strømpris",
    "Følg strømmen med Einar",
    "Hvordan kan vi hjelpe deg?",
  ],
  labelled: [],
  nav: "Hovedmeny",
  menus: ["Strøm", "Mobil", "Nettbutikk"],
  utility: [],
  search: "Søk",
  menuButton: "Meny",
  photos: 4,
  priceArea: { label: "Velg prisområde", option: /^NO5/u, unit: /øre\/kWh/u },
} as const;

const TRONDELAGKRAFT = {
  site: "TrøndelagKraft",
  brand: "tkas",
  domain: "trondelagkraft.no",
  lang: "nb",
  logo: "TrøndelagKraft",
  heading: "Få en enkel strømavtale",
  sections: [
    "Spar penger i nettbutikken",
    "Norgespris lønner seg i Trøndelag",
    "Medlemsfordel på strøm",
    "Hos oss har du mange kundefordeler",
  ],
  labelled: ["Snarveier", "Aktuelt", "Kontakt oss"],
  nav: "Hovedmeny",
  menus: ["Strømavtaler"],
  utility: [],
  search: null,
  menuButton: "Meny",
  photos: 8,
  priceArea: null,
} as const;

const GUDBRANDSDAL_ENERGI = {
  site: "Gudbrandsdal Energi",
  brand: "guen",
  domain: "ge.no",
  lang: "nb",
  logo: "Gudbrandsdal Energi",
  heading: "Høstkampanje på strømavtale",
  sections: ["Dette sier kundene våre", "Verv en venn"],
  labelled: ["Snarveier"],
  nav: "Hovedmeny",
  menus: ["Strømavtaler"],
  utility: [],
  search: null,
  menuButton: "Meny",
  photos: 2,
  priceArea: null,
} as const;

const TELINET = {
  site: "Telinet Energi",
  brand: "fkse",
  domain: "telinet.se",
  lang: "sv",
  logo: "Telinet",
  heading: "Det här är Telinet Energi",
  sections: [
    "Förnybar energi, idag och imorgon!",
    "Vad händer på elmarknaden?",
    "Kom igång med Telinet nu!",
    "Bra partners ger bättre energi.",
  ],
  labelled: ["Kundservice och app"],
  nav: "Huvudmeny",
  menus: ["Elavtal", "Mina sidor"],
  utility: ["Kundservice"],
  search: "Sök",
  menuButton: "Meny",
  photos: 5,
  priceArea: null,
} as const;

const FJORDKRAFT_FORETAG = {
  site: "Fjordkraft Företag",
  brand: "fkab",
  domain: "fjordkraft.se",
  lang: "sv",
  logo: "Fjordkraft Företag",
  heading: "Dags att vintersäkra elen till ditt företag",
  sections: ["Våra kunder", "Varför välja Fjordkraft?", "Se elpriset i ditt område"],
  labelled: ["Genvägar"],
  nav: "Huvudmeny",
  menus: ["Elavtal", "Energilösningar"],
  utility: [],
  search: "Sök",
  menuButton: "Meny",
  photos: 5,
  priceArea: { label: "Välj prisområde", option: /^SE3/u, unit: /öre\/kWh/u },
} as const;

type SiteFacts =
  | typeof ELMERA
  | typeof FJORDKRAFT
  | typeof TRONDELAGKRAFT
  | typeof GUDBRANDSDAL_ENERGI
  | typeof TELINET
  | typeof FJORDKRAFT_FORETAG;

const ALL_SITES: readonly SiteFacts[] = [
  ELMERA,
  FJORDKRAFT,
  TRONDELAGKRAFT,
  GUDBRANDSDAL_ENERGI,
  TELINET,
  FJORDKRAFT_FORETAG,
];

/** The sites with photos; Elmera Group's has none, its logos are inline SVG. */
const PHOTO_SITES = ALL_SITES.filter((facts) => facts.photos > 0);

/** The chrome's caption while the window shows the Dashboard. */
const INTERNAL_CAPTION = "Dashboard: an internal sales and back-office app built with Fuse";

/** Opens the landing on `facts`' brand with the External side showing, and waits for its site. */
async function openSite(
  facts: SiteFacts,
  viewport: { readonly width: number; readonly height: number },
  options?: { readonly colorScheme: "light" | "dark" }
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

/** The computed opacity of a window side, read as a number. */
async function opacity(side: Locator): Promise<number> {
  return Number(await side.evaluate((element) => getComputedStyle(element).opacity));
}

/**
 * Stops the page's animation clock: every transition holds its first frame until the test seeks
 * it, so a read never races the flip.
 */
async function freezeAnimations(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 });
}

/** The properties of the CSS transitions running on a window side, sorted. */
async function sideTransitions(side: Locator): Promise<string[]> {
  return side.evaluate((element) =>
    element
      .getAnimations()
      .flatMap((animation) => (animation instanceof CSSTransition ? [animation.transitionProperty] : []))
      .toSorted()
  );
}

/** Seeks every transition on a window side to `ms` into it, delay included. */
async function seekSide(side: Locator, ms: number): Promise<void> {
  await side.evaluate((element, time) => {
    for (const animation of element.getAnimations()) {
      animation.currentTime = time;
    }
  }, ms);
}

/** Runs every transition on a window side to its end. */
async function finishSide(side: Locator): Promise<void> {
  await side.evaluate((element) => {
    for (const animation of element.getAnimations()) {
      animation.finish();
    }
  });
}

/** The DOM audit for a side the switch hid: the side sits in an inert subtree. */
async function isInert(side: Locator): Promise<boolean> {
  // DOM audit: an inert side has no role a query could reach, so the check reads the attribute.
  return side.evaluate((element) => element.closest("[inert]") !== null);
}

/** The inline styles of `<html>` and `<body>`, where a modal's scroll lock writes. */
async function documentStyles(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      `${document.documentElement.getAttribute("style") ?? ""}|${document.body.getAttribute("style") ?? ""}`
  );
}

/** Both modal roles in the window: a dialog or Sheet, and an alert dialog's confirmation. */
const MODAL = "[role='dialog'], [role='alertdialog']";

/**
 * Waits until no dialog is open and `side` is in the accessibility tree: no ancestor hides it
 * from assistive technology or makes it inert, and the document has lost any scroll lock, so
 * its styles match `unlocked`, read before anything opened.
 */
async function expectReachable(page: Page, side: Locator, unlocked: string): Promise<void> {
  // DOM audit: an inert or aria-hidden dialog has no role a query could reach.
  await expect.poll(async () => page.locator(MODAL).count()).toBe(0);
  await expect
    .poll(async () =>
      side.evaluate((element) => {
        const hider = element.closest("[aria-hidden='true'], [inert]");
        return hider === null ? null : hider.outerHTML.slice(0, 80);
      })
    )
    .toBeNull();
  expect(await documentStyles(page)).toBe(unlocked);
  // And a query by role reaches into the side.
  expect(await side.getByRole("button").count()).toBeGreaterThan(0);
}

/**
 * Presses one side of the window's switch while a modal is open. The modal hides everything
 * outside it from assistive technology, but its backdrop stops at the window's edge, so a
 * pointer still reaches the switch in the window's chrome. The press leaves focus in the
 * modal, as Safari's does: WebKit focuses no button on a click, while Chromium's mousedown
 * would move focus to the switch before the modal closes and hide where the close sends it.
 */
async function pressSwitchPastModal(page: Page, side: "Internal" | "External"): Promise<void> {
  const button = liveDemo(page)
    .getByRole("group", { name: "Window content", includeHidden: true })
    .getByRole("button", { name: side, exact: true, includeHidden: true });
  await button.evaluate((element) => {
    element.addEventListener("mousedown", (event) => event.preventDefault(), { once: true });
  });
  // A modal moves focus in a frame after it opens.
  await expect
    .poll(async () => page.evaluate((modal) => document.activeElement?.closest(modal) !== null, MODAL))
    .toBe(true);
  await button.click();
}

/**
 * Waits for the close a flip started to settle, then expects focus on the switch's `side`
 * button outside any inert subtree, rather than on a trigger on the side that went inert.
 */
async function expectFocusOnSwitch(page: Page, side: "Internal" | "External"): Promise<void> {
  const button = liveDemo(page)
    .getByRole("group", { name: "Window content" })
    .getByRole("button", { name: side, exact: true });
  // Base UI returns focus after the dialog unmounts; two frames let a late return land first.
  await page.evaluate(
    async () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })
  );
  expect(
    await button.evaluate((element) => ({
      focused: element === document.activeElement,
      inert: document.activeElement?.closest("[inert]") !== null,
    }))
  ).toEqual({ focused: true, inert: false });
}

describe("landing hero window, External side", () => {
  it("flips the content, the variant and the caption with the switch, and loads no site image before", async () => {
    const siteImages: string[] = [];
    const page = await openLanding(DESKTOP_VIEWPORT, {
      prepare: (opening) => {
        opening.on("request", (request) => {
          if (request.url().includes("/landing/sites/")) {
            siteImages.push(request.url());
          }
        });
        return Promise.resolve();
      },
    });
    const documentTheme = await readThemeAttributes(page.locator("html"));
    expect(documentTheme.variant).toBe("external");

    // DOM audit: ThemeScope's element has no role; each side's scope is its only themed element.
    const internalScope = dashboard(page).locator("[data-theme-variant]");
    expect(await readThemeAttributes(internalScope)).toEqual({
      variant: "internal",
      brand: "elma",
      segment: "private",
    });
    expect(await windowCaption(page)).toBe(`Live demo${INTERNAL_CAPTION}`);
    expect(await brandSite(page, ELMERA.site).count()).toBe(0);
    expect(siteImages).toEqual([]);

    // Fjordkraft's site has photos; picking it while Internal shows must not fetch them.
    await pickBrand(page, FJORDKRAFT.brand);
    expect(await brandSite(page, FJORDKRAFT.site).count()).toBe(0);
    expect(siteImages).toEqual([]);

    await showSide(page, "External");
    const site = brandSite(page, FJORDKRAFT.site);
    await site.getByRole("heading", { level: 1, name: FJORDKRAFT.heading }).waitFor();
    // DOM audit: the hero's photo is the site's first `img`; the logo before it is an inline SVG.
    const heroPhoto = site.locator("img").first();
    await expect
      .poll(async () =>
        heroPhoto.evaluate(
          (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
        )
      )
      .toBe(true);
    const heroSrc = await heroPhoto.evaluate((image) =>
      image instanceof HTMLImageElement ? image.currentSrc : ""
    );
    expect(siteImages).toContain(heroSrc);
    expect(await readThemeAttributes(site.locator("[data-theme-variant]"))).toEqual({
      variant: "external",
      brand: "fkas",
      segment: "private",
    });
    expect(await windowCaption(page)).toBe(
      `${FJORDKRAFT.domain}Fjordkraft's public website, built with Fuse`
    );
    expect(await isInert(dashboard(page))).toBe(true);

    await showSide(page, "Internal");
    await expect.poll(async () => isInert(site)).toBe(true);
    expect(await windowCaption(page)).toBe(`Live demo${INTERNAL_CAPTION}`);
    expect((await readThemeAttributes(internalScope)).variant).toBe("internal");
    // The document's own axes follow only the brand pick.
    expect(await readThemeAttributes(page.locator("html"))).toEqual({ ...documentTheme, brand: "fkas" });
    await page.context().close();
  });

  it("keeps the Dashboard's selected order through a round trip to External", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    await row(app, "Jonas Eide").click();
    expect(await row(app, "Jonas Eide").getAttribute("aria-current")).toBe("true");

    await showSide(page, "External");
    await brandSite(page, ELMERA.site).getByRole("heading", { level: 1 }).waitFor();
    await showSide(page, "Internal");
    await expect.poll(async () => isInert(app)).toBe(false);

    expect(await row(app, "Jonas Eide").getAttribute("aria-current")).toBe("true");
    expect(
      await app.getByRole("complementary", { name: "Order details" }).getByText("Jonas Eide").count()
    ).toBeGreaterThan(0);
    await page.context().close();
  });

  it("closes the Dashboard's New order Sheet on a flip, so the site stays reachable", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const unlocked = await documentStyles(page);
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    await row(app, "Jonas Eide").click();
    await openNewOrder(app);

    await pressSwitchPastModal(page, "External");
    const site = brandSite(page, ELMERA.site);
    await expectReachable(page, site, unlocked);
    await site.getByRole("heading", { level: 1, name: ELMERA.heading }).waitFor();
    await expectFocusOnSwitch(page, "External");

    await showSide(page, "Internal");
    await expect.poll(async () => isInert(app)).toBe(false);
    expect(await row(app, "Jonas Eide").getAttribute("aria-current")).toBe("true");
    await page.context().close();
  });

  it("dismisses the Dashboard's Cancel order confirmation on a flip and keeps the order", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const unlocked = await documentStyles(page);
    const app = dashboard(page);
    const detail = app.getByRole("complementary", { name: "Order details" });
    const status = detail.getByRole("button", { name: /^Status/u });
    await app.scrollIntoViewIfNeeded();
    await row(app, "Jonas Eide").click();
    await detail.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Cancel order…" }).click();
    await page.getByRole("alertdialog", { name: /^Cancel order/u }).waitFor();

    await pressSwitchPastModal(page, "External");
    const site = brandSite(page, ELMERA.site);
    await expectReachable(page, site, unlocked);
    await expectFocusOnSwitch(page, "External");

    await showSide(page, "Internal");
    await expect.poll(async () => isInert(app)).toBe(false);
    // The seeds put Jonas Eide's order in Awaiting customer approval; a dismissal leaves it there.
    expect(await status.getAttribute("aria-label")).toBe("Status: Awaiting customer approval");
    await page.context().close();
  });

  it("closes the site's phone menu Sheet on a flip, so the Dashboard stays reachable", async () => {
    const page = await openLanding(PHONE_VIEWPORT);
    const unlocked = await documentStyles(page);
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    await row(app, "Jonas Eide").click();
    // On a phone the order opens as a Sheet: the first flip closes it.
    await page.getByRole("dialog").waitFor();

    await pressSwitchPastModal(page, "External");
    const site = brandSite(page, ELMERA.site);
    await expectReachable(page, site, unlocked);
    await expectFocusOnSwitch(page, "External");
    await site.getByRole("button", { name: ELMERA.menuButton, exact: true }).click();
    await page.getByRole("dialog", { name: ELMERA.menuButton }).waitFor();

    await pressSwitchPastModal(page, "Internal");
    await expectReachable(page, app, unlocked);
    await expectFocusOnSwitch(page, "Internal");
    expect(await row(app, "Jonas Eide").getAttribute("aria-current")).toBe("true");
    await page.context().close();
  });

  it("swaps the sides at once under reduced motion", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { reducedMotion: "reduce" });
    // A frozen clock holds any transition the flip starts, however late the reads below run.
    await freezeAnimations(page);
    await showSide(page, "External");
    const site = brandSite(page, ELMERA.site);
    await site.getByRole("heading", { level: 1 }).waitFor();
    expect(await sideTransitions(dashboard(page))).toEqual([]);
    expect(await sideTransitions(site)).toEqual([]);
    expect(await opacity(site)).toBe(1);
    expect(await opacity(dashboard(page))).toBe(0);
    await page.context().close();
  });

  it("animates the flip without reduced motion and reverses a flip from where it is", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { reducedMotion: "no-preference" });
    const app = dashboard(page);
    await freezeAnimations(page);
    await showSide(page, "External");
    const site = brandSite(page, ELMERA.site);
    // The negative control for the reduced-motion case: the flip runs its transitions.
    expect(await sideTransitions(app)).toContain("opacity");

    // A quarter of the way through the Dashboard's 120ms exit, it is part way gone.
    await seekSide(app, 30);
    const leaving = await opacity(app);
    expect(leaving).toBeGreaterThan(0);
    expect(leaving).toBeLessThan(1);

    // The reversal starts from the opacity the exit reached: no jump in either direction.
    await showSide(page, "Internal");
    expect(await opacity(app)).toBeCloseTo(leaving, 5);

    await finishSide(app);
    await finishSide(site);
    expect(await opacity(app)).toBe(1);
    expect(await opacity(site)).toBe(0);
    await page.context().close();
  });

  it("keeps the window's height through a flip", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const demo = liveDemo(page);
    const before = await demo.boundingBox();
    await showSide(page, "External");
    await brandSite(page, ELMERA.site).getByRole("heading", { level: 1 }).waitFor();
    const after = await demo.boundingBox();
    expect(after?.height).toBe(before?.height);
    await page.context().close();
  });

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
    "fits every header control of $facts.site inside the window at $viewport.width px",
    async ({ facts, viewport }) => {
      const { page, site } = await openSite(facts, viewport);
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
});
