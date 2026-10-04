/**
 * What the hero window's browser suites share: the window and its Internal/External switch, the
 * Dashboard and its rows, Order search's table, the brand sites, and the fixture facts more than
 * one suite asserts.
 */
import type { Locator, Page } from "playwright";
import { expect } from "vitest";

/** A phone's viewport, where the sidebar and the detail open as Sheets. */
export const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

/** A wide desktop viewport, where the queues show their detail beside the list. */
export const WIDE_VIEWPORT = { width: 1440, height: 900 } as const;

/**
 * Open orders per sidebar entry as the fixture states them: the signed-in seller's 12 drafts and
 * 3 orders with telemarketing, and 12 orders with telemarketing in all.
 */
export const OPEN_COUNTS = { "My orders": "26", Drafts: "12", "Establishment stopped": "12" } as const;

/**
 * The landing opens on the External side. A suite that exercises the Dashboard opens with this
 * query instead: the opening brand and segment in the internal variant, so the window shows the
 * Dashboard from the first paint.
 */
export const DASHBOARD_FIRST = "?theme=internal-elma-private";

/** The hero's live demo window: its chrome, the switch, and the side it shows. */
export function liveDemo(page: Page): Locator {
  return page.getByRole("region", { name: "Live demo", exact: true });
}

/**
 * The window's description: the chrome's caption, which names what the window shows, such as
 * the site's domain on the External side.
 */
export async function windowCaption(page: Page): Promise<string> {
  // DOM audit: Playwright exposes no accessible description, so the read follows aria-describedby.
  return liveDemo(page).evaluate(
    (element) => document.getElementById(element.getAttribute("aria-describedby") ?? "")?.textContent ?? ""
  );
}

/** The window's Dashboard, the Internal side. */
export function dashboard(page: Page): Locator {
  return page.getByRole("region", { name: "Dashboard", exact: true });
}

/** A brand's website on the External side, named after the site: "Fjordkraft website". */
export function brandSite(page: Page, site: string): Locator {
  return page.getByRole("region", { name: `${site} website`, exact: true });
}

/** The DOM audit for a side the switch hid: the side sits in an inert subtree. */
export async function isInert(side: Locator): Promise<boolean> {
  // DOM audit: an inert side has no role a query could reach, so the check reads the attribute.
  return side.evaluate((element) => element.closest("[inert]") !== null);
}

/** Presses one side of the window's Internal/External switch. */
export async function showSide(page: Page, side: "Internal" | "External"): Promise<void> {
  await liveDemo(page).scrollIntoViewIfNeeded();
  await sideSwitch(page).getByRole("button", { name: side, exact: true }).click();
}

/**
 * The window's Internal/External switch. `includeHidden` reaches it while an open modal hides
 * everything outside itself from assistive technology.
 */
export function sideSwitch(
  page: Page,
  { includeHidden = false }: { readonly includeHidden?: boolean } = {}
): Locator {
  return liveDemo(page).getByRole("group", { name: "Window content", includeHidden });
}

/**
 * The side the window shows: the switch's pressed button, checked against the side that is not
 * inert, so a switch that disagrees with its window fails here.
 */
export async function shownSide(page: Page): Promise<"Internal" | "External" | "mismatch"> {
  const pressed = (await sideSwitch(page).getByRole("button", { pressed: true }).textContent()) ?? "";
  const dashboardInert = await isInert(dashboard(page));
  if (pressed === "Internal" && !dashboardInert) {
    return "Internal";
  }
  if (pressed === "External" && dashboardInert) {
    return "External";
  }
  return "mismatch";
}

/**
 * Picks `brand` in the landing's brand picker, the same action as any other brand control, and
 * waits for the document to wear it, within `timeout` when given.
 */
export async function pickBrand(
  page: Page,
  brand: string,
  { timeout }: { readonly timeout?: number } = {}
): Promise<void> {
  await page
    .getByRole("button")
    .filter({ hasText: `data-theme-brand="${brand}"` })
    .click();
  await expect
    .poll(async () => page.locator("html").getAttribute("data-theme-brand"), { timeout })
    .toBe(brand);
}

/** The row button for `customer`; its accessible name starts with the order's customer. */
export function row(scope: Locator, customer: string): Locator {
  return scope
    .getByRole("list", { name: "Orders" })
    .getByRole("button", { name: new RegExp(`^${customer}`, "u") });
}

/** The customer of the focused row's opener, or `null` when no row has focus. */
export async function focusedCustomer(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute("data-customer") ?? null);
}

/** Ida Hagen's metering point as the fixture states it. */
export const IDA_METER_POINT = "707057500050172948";

/** Order search's table, named like the queues' list. */
export function searchTable(app: Locator): Locator {
  return app.getByRole("table", { name: "Orders" });
}

/** Opens Order search and waits for its simulated fetch to finish. */
export async function openOrderSearch(page: Page): Promise<Locator> {
  const app = dashboard(page);
  await app.scrollIntoViewIfNeeded();
  await app.getByRole("button", { name: "Order search", exact: true }).click();
  await searchTable(app).waitFor();
  await expect.poll(async () => searchTable(app).getAttribute("aria-busy")).toBeNull();
  return app;
}

/** Opens New order from the window's sidebar and waits for its Sheet. */
export async function openNewOrder(app: Locator): Promise<Locator> {
  await app.getByRole("button", { name: /^New order/u }).click();
  const sheet = app.page().getByRole("dialog", { name: "New order" });
  await sheet.waitFor();
  return sheet;
}

/** The window's theme scope: the box its Sheets fill and its popups stay in. */
export function windowScope(app: Locator): Locator {
  // DOM audit: ThemeScope's element has no role; it is the window's only themed element.
  return app.locator("[data-theme-variant]");
}

/**
 * Scrolls the page so the window's top sits above the viewport and its body part way up it, as a
 * visitor sees it after scrolling past the hero's headline.
 */
export async function scrollWindowPartWay(page: Page): Promise<void> {
  const top = await dashboard(page).evaluate(
    (element) => element.getBoundingClientRect().top + window.scrollY
  );
  await page.evaluate((y) => {
    window.scrollTo(0, y);
  }, top + 80);
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
}

/**
 * How far a popup may sit from its trigger: Base UI popups sit 4px off and the react-aria
 * popover 8px, plus slack for borders and subpixel rounding.
 */
const POPUP_GAP_PX = 12;

/**
 * Polls until `popup` opens next to `trigger`: within 8px of one of its sides, overlapping it on
 * the other axis, and inside the window's scope.
 */
export async function expectBeside(popup: Locator, trigger: Locator, scope: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const [p, t, s] = await Promise.all([popup.boundingBox(), trigger.boundingBox(), scope.boundingBox()]);
      if (p === null || t === null || s === null) {
        return "not rendered";
      }
      const near = (gap: number) => gap >= -1 && gap <= POPUP_GAP_PX;
      const crossesX = p.x < t.x + t.width && p.x + p.width > t.x;
      const crossesY = p.y < t.y + t.height && p.y + p.height > t.y;
      const beside =
        (crossesX && (near(p.y - (t.y + t.height)) || near(t.y - (p.y + p.height)))) ||
        (crossesY && (near(p.x - (t.x + t.width)) || near(t.x - (p.x + p.width))));
      const inside =
        p.x >= s.x - 1 &&
        p.y >= s.y - 1 &&
        p.x + p.width <= s.x + s.width + 1 &&
        p.y + p.height <= s.y + s.height + 1;
      return beside && inside ? "beside" : `popup ${JSON.stringify(p)}, trigger ${JSON.stringify(t)}`;
    })
    .toBe("beside");
}

/**
 * What each site states, as its reference writes it: the test's own copy, so a config change
 * that drops a heading, the language or a menu fails here instead of passing. `sections` are
 * the visible section headings below the hero, in page order; `labelled` are the sections the
 * reference draws without a heading, which carry an accessible name instead. `utility` and
 * `search` are the header's links that fold into the menu Sheet on a phone. `photos` counts the
 * photos the reference shows.
 */
export const ELMERA = {
  site: "Elmera Group",
  brand: "elma",
  domain: "elmeragroup.no",
  lang: "en-US",
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

export const FJORDKRAFT = {
  site: "Fjordkraft",
  brand: "fkas",
  domain: "fjordkraft.no",
  lang: "nb-NO",
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
  lang: "nb-NO",
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
  lang: "nb-NO",
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
  lang: "sv-SE",
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
  lang: "sv-SE",
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

export type SiteFacts =
  | typeof ELMERA
  | typeof FJORDKRAFT
  | typeof TRONDELAGKRAFT
  | typeof GUDBRANDSDAL_ENERGI
  | typeof TELINET
  | typeof FJORDKRAFT_FORETAG;

export const ALL_SITES: readonly SiteFacts[] = [
  ELMERA,
  FJORDKRAFT,
  TRONDELAGKRAFT,
  GUDBRANDSDAL_ENERGI,
  TELINET,
  FJORDKRAFT_FORETAG,
];

/** The sites with photos; Elmera Group's has none, its logos are inline SVG. */
export const PHOTO_SITES = ALL_SITES.filter((facts) => facts.photos > 0);
