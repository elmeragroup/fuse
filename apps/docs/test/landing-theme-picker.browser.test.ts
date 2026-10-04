import type { Locator, Page, Route } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, readThemeAttributes } from "./demo-page";
import type { ThemeAttributes } from "./demo-page";
import { brandSite, dashboard, PHONE_VIEWPORT, row, shownSide, showSide } from "./landing-dashboard";
import { expectTargets, launchLandingSuite, settleFrames } from "./landing-page";

const { openLanding } = launchLandingSuite();

/** One theme as the picker names it, and as the document must wear it. */
type Step = {
  readonly brand: string;
  readonly segment: "Private" | "Company";
  readonly variant: "Internal" | "External";
  readonly attributes: ThemeAttributes;
  /** The query the page must carry once the step is applied. */
  readonly slug: string;
};

/** What the landing opens on: Elmera, private, external, with the window on the site. */
const OPENING: Step = {
  brand: "Elmera",
  segment: "Private",
  variant: "External",
  attributes: { variant: "external", brand: "elma", segment: "private" },
  slug: "external-elma-private",
};

/** Three picks, each moving one axis: brand, then segment, then variant. */
const STEPS: readonly Step[] = [
  {
    brand: "Fjordkraft",
    segment: "Private",
    variant: "External",
    attributes: { variant: "external", brand: "fkas", segment: "private" },
    slug: "external-fkas-private",
  },
  {
    brand: "Fjordkraft",
    segment: "Company",
    variant: "External",
    attributes: { variant: "external", brand: "fkas", segment: "company" },
    slug: "external-fkas-company",
  },
  {
    brand: "Fjordkraft",
    segment: "Company",
    variant: "Internal",
    attributes: { variant: "internal", brand: "fkas", segment: "company" },
    slug: "internal-fkas-company",
  },
];

/** The sticky nav, where every picker variant lives. */
function nav(page: Page): Locator {
  return page.getByRole("banner");
}

/** The nav's theme chip. */
function trigger(page: Page): Locator {
  return nav(page).getByRole("button", { name: /^Theme/u });
}

/** The open picker: a popover or Sheet named Theme. */
function pickerDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: "Theme" });
}

/** Opens the picker, unless it is open already, and returns it. */
async function openPicker(page: Page): Promise<Locator> {
  // An open Sheet hides the rest of the page, the chip with it, so the open dialog comes first.
  const dialog = pickerDialog(page);
  if (!(await dialog.isVisible())) {
    await trigger(page).click();
    await dialog.waitFor();
  }
  return dialog;
}

/** Applies `step` through the picker: a brand tile, then the segment and variant toggles. */
async function choose(page: Page, step: Step): Promise<void> {
  const root = await openPicker(page);
  await root
    .getByRole("group", { name: "Brand" })
    .getByRole("button", { name: step.brand, exact: true })
    .click();
  for (const [axis, value] of [
    ["Segment", step.segment],
    ["Variant", step.variant],
  ] as const) {
    await root.getByRole("group", { name: axis }).getByRole("button", { name: value, exact: true }).click();
  }
}

/** True when `element` holds the page's focus. */
async function isFocused(element: Locator): Promise<boolean> {
  return element.evaluate((node) => node === document.activeElement);
}

async function documentTheme(page: Page): Promise<ThemeAttributes> {
  return readThemeAttributes(page.locator("html"));
}

/** The query value the page's URL carries for `theme`, or null without one. */
function urlTheme(page: Page): string | null {
  return new URL(page.url()).searchParams.get("theme");
}

/** The polite region that announces each theme change. */
function announcer(page: Page): Locator {
  return page.getByRole("status").filter({ hasText: /^Theme:/u });
}

async function abortNextScripts(route: Route): Promise<void> {
  if (route.request().url().includes("/_next/") && route.request().resourceType() === "script") {
    await route.abort();
    return;
  }
  await route.continue();
}

describe("landing theme picker", () => {
  it("moves the document's theme and the window's side with each axis", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    expect(await documentTheme(page)).toEqual(OPENING.attributes);
    expect(await shownSide(page)).toBe(OPENING.variant);

    for (const step of STEPS) {
      await choose(page, step);
      await expect.poll(async () => documentTheme(page)).toEqual(step.attributes);
      await expect.poll(async () => shownSide(page)).toBe(step.variant);
    }

    // The context prefers light, so Dark comes first: a pick that moves nothing would prove nothing.
    const scheme = (await openPicker(page)).getByRole("group", { name: "Colour scheme" });
    const schemeAttribute = async () => page.locator("html").getAttribute("data-theme");
    for (const [label, attribute, spoken] of [
      ["Dark", "dark", "dark"],
      ["Light", "light", "light"],
      ["System", "light", "system"],
    ] as const) {
      await scheme.getByRole("button", { name: label, exact: true }).click();
      await expect.poll(schemeAttribute).toBe(attribute);
      expect(await scheme.getByRole("button", { pressed: true }).textContent()).toBe(label);
      await expect
        .poll(async () => announcer(page).textContent())
        .toBe(`Theme: Fjordkraft, company, internal, ${spoken}`);
    }
    // System follows the preference both ways.
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(schemeAttribute).toBe("dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(schemeAttribute).toBe("light");
    await page.context().close();
  });

  it("keeps the picker and the window's switch in step both ways", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);

    await showSide(page, "Internal");
    await expect
      .poll(async () => documentTheme(page))
      .toEqual({ ...OPENING.attributes, variant: "internal" });
    const root = await openPicker(page);
    await expect
      .poll(async () =>
        root.getByRole("group", { name: "Variant" }).getByRole("button", { pressed: true }).textContent()
      )
      .toBe("Internal");
    await page.keyboard.press("Escape");
    await expect.poll(async () => pickerDialog(page).count()).toBe(0);

    await choose(page, { ...OPENING, variant: "External" });
    await expect.poll(async () => shownSide(page)).toBe("External");
    await page.context().close();
  });

  it("mirrors the theme in the URL and paints a fresh load of that URL in it", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    expect(urlTheme(page)).toBeNull();
    for (const step of STEPS) {
      await choose(page, step);
      await expect.poll(() => urlTheme(page)).toBe(step.slug);
    }
    const shared = new URL(page.url()).search;
    const last = STEPS.at(-1);
    await page.context().close();

    // Without the app's scripts the page shows only what the server sent and the inline script set.
    const painted = await openLanding(DESKTOP_VIEWPORT, {
      search: shared,
      hydrated: false,
      prepare: async (opening) => {
        await opening.route("**/*", abortNextScripts);
      },
    });
    expect(await documentTheme(painted)).toEqual(last?.attributes);
    expect(await shownSide(painted)).toBe(last?.variant);
    await painted.context().close();

    const hydrated = await openLanding(DESKTOP_VIEWPORT, { search: shared });
    await expect.poll(async () => documentTheme(hydrated)).toEqual(last?.attributes);
    expect(await shownSide(hydrated)).toBe(last?.variant);
    await hydrated.context().close();
  });

  it("follows the URL's theme through client navigation and Back, without a reload", async () => {
    const shared = STEPS.at(-1) ?? OPENING;
    const page = await openLanding(DESKTOP_VIEWPORT, { search: `?theme=${shared.slug}` });
    // A full load would start a fresh window object and drop the mark.
    await page.evaluate(() => {
      Object.assign(window, { sameDocument: true });
    });
    const sameDocument = async () => page.evaluate(() => "sameDocument" in window);
    const home = nav(page).getByRole("link", { name: "Fuse" });

    await home.click();
    await expect.poll(() => urlTheme(page)).toBeNull();
    await expect.poll(async () => documentTheme(page)).toEqual(OPENING.attributes);
    expect(await trigger(page).getAttribute("aria-label")).toBe("Theme: Elmera · Private · External");

    await page.goBack();
    await expect.poll(() => urlTheme(page)).toBe(shared.slug);
    await expect.poll(async () => documentTheme(page)).toEqual(shared.attributes);
    expect(await trigger(page).getAttribute("aria-label")).toBe("Theme: Fjordkraft · Company · Internal");

    expect(await sameDocument()).toBe(true);
    await page.context().close();
  });

  it("treats a repeated theme in client navigation as a fresh load of that address does", async () => {
    const shared = STEPS.at(-1) ?? OPENING;
    const repeated = `?theme=${shared.slug}&theme=${(STEPS[0] ?? OPENING).slug}`;
    // The oracle: the server's reading of the address on a fresh load.
    const fresh = await openLanding(DESKTOP_VIEWPORT, { search: repeated });
    const served = await documentTheme(fresh);
    expect(served).toEqual(OPENING.attributes);
    await fresh.context().close();

    const page = await openLanding(DESKTOP_VIEWPORT, { search: `?theme=${shared.slug}` });
    await expect.poll(async () => documentTheme(page)).toEqual(shared.attributes);
    // A second value that leaves the first unchanged, written through Next's patched history.
    await page.evaluate((search) => {
      window.history.pushState(null, "", `/${search}`);
    }, repeated);
    await expect.poll(async () => documentTheme(page)).toEqual(served);
    await expect
      .poll(async () => trigger(page).getAttribute("aria-label"))
      .toBe("Theme: Elmera · Private · External");
    // The opening theme needs no parameter, so the address drops both values.
    await expect.poll(() => new URL(page.url()).search).toBe("");
    await page.context().close();
  });

  it("lands the home link on the opening theme after a pick on the plain address, and Back and Forward on each", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    // The route names the opening theme both before and after the pick; only the address changed.
    const step = STEPS[0] ?? OPENING;
    await choose(page, step);
    await expect.poll(() => urlTheme(page)).toBe(step.slug);
    await nav(page).getByRole("link", { name: "Fuse" }).click();
    await expect.poll(() => urlTheme(page)).toBeNull();
    await expect.poll(async () => documentTheme(page)).toEqual(OPENING.attributes);

    // Back returns to the entry the pick rewrote, so it wears the picked theme again.
    await page.goBack();
    await expect.poll(() => urlTheme(page)).toBe(step.slug);
    await expect.poll(async () => documentTheme(page)).toEqual(step.attributes);
    expect(await trigger(page).getAttribute("aria-label")).toBe("Theme: Fjordkraft · Private · External");

    await page.goForward();
    await expect.poll(() => urlTheme(page)).toBeNull();
    await expect.poll(async () => documentTheme(page)).toEqual(OPENING.attributes);
    expect(await trigger(page).getAttribute("aria-label")).toBe("Theme: Elmera · Private · External");
    await page.context().close();
  });

  it("announces each change politely", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    expect(await announcer(page).count()).toBe(0);
    const step = STEPS[0];
    if (step !== undefined) {
      await choose(page, step);
    }
    await expect
      .poll(async () => announcer(page).textContent())
      .toBe("Theme: Fjordkraft, private, external, system");
    await page.context().close();
  });

  it("keeps announcing while the phone's Sheet hides the rest of the page", async () => {
    const page = await openLanding(PHONE_VIEWPORT);
    const step = STEPS[0] ?? OPENING;
    await choose(page, step);
    // The Sheet stays open: the region must stay out of its modal hiding.
    expect(await pickerDialog(page).isVisible()).toBe(true);
    // DOM audit: a region under `aria-hidden` has no role a query could reach, so the check reads the attribute.
    const region = page.locator("[role='status']").filter({ hasText: /^Theme:/u });
    await expect.poll(async () => region.textContent()).toBe("Theme: Fjordkraft, private, external, system");
    expect(
      await region.evaluate((element) => element.closest("[aria-hidden='true'], [inert]") === null)
    ).toBe(true);
    await page.context().close();
  });

  it("opens on a phone with every axis in reach", async () => {
    const page = await openLanding(PHONE_VIEWPORT);
    expect(await trigger(page).isVisible()).toBe(true);
    const root = await openPicker(page);
    for (const axis of ["Brand", "Segment", "Variant", "Colour scheme"]) {
      await root.getByRole("group", { name: axis }).waitFor();
    }

    await choose(page, STEPS.at(-1) ?? OPENING);
    await expect.poll(async () => documentTheme(page)).toEqual(STEPS.at(-1)?.attributes);
    await page.context().close();
  });

  it("gives every picker control a target at least 24px in both directions", async () => {
    for (const viewport of [DESKTOP_VIEWPORT, PHONE_VIEWPORT]) {
      const page = await openLanding(viewport);
      await expectTargets(nav(page), `nav at ${String(viewport.width)}px`);
      const root = await openPicker(page);
      await expectTargets(root, `picker open at ${String(viewport.width)}px`);
      await page.context().close();
    }
  });

  it("disables the segment a pinned brand does not serve and names the reason", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    await choose(page, {
      brand: "Fjordkraft Företag",
      segment: "Company",
      variant: "External",
      attributes: { variant: "external", brand: "fkab", segment: "company" },
      slug: "external-fkab-company",
    });
    await expect
      .poll(async () => documentTheme(page))
      .toEqual({ variant: "external", brand: "fkab", segment: "company" });

    const root = await openPicker(page);
    const blocked = root.getByRole("group", { name: "Segment" }).getByRole("button", { name: "Private" });
    expect(await blocked.isDisabled()).toBe(true);
    // DOM audit: Playwright exposes no accessible description, so the read follows aria-describedby.
    const description = await blocked.evaluate((element) =>
      (element.getAttribute("aria-describedby") ?? "")
        .split(/\s+/u)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ")
        .trim()
    );
    expect(description).toContain("Fjordkraft Företag serves businesses only");
    await blocked.hover();
    await expect
      .poll(async () => page.getByRole("tooltip").textContent())
      .toBe("Fjordkraft Företag serves businesses only");
    await page.context().close();
  });
});

describe("landing theme picker shortcut", () => {
  /** Opens on Fjordkraft, so the focused tile is the current brand's, not the grid's first. */
  const search = "?theme=external-fkas-private";

  it("names ⌘J or Ctrl+J on the chip and in its tooltip", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { search });
    expect(await trigger(page).getAttribute("aria-keyshortcuts")).toBe("Meta+J Control+J");
    await trigger(page).hover();
    await expect.poll(async () => page.getByRole("tooltip").textContent()).toMatch(/^Theme(?:⌘J|CtrlJ)$/u);
    await page.context().close();
  });

  it("opens on the current brand, closes on a second press and gives focus back", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { search });
    const before = nav(page).getByRole("link", { name: "Fuse" });
    await before.focus();

    await page.keyboard.press("ControlOrMeta+j");
    const brand = pickerDialog(page).getByRole("group", { name: "Brand" });
    await expect
      .poll(async () => isFocused(brand.getByRole("button", { name: "Fjordkraft", exact: true })))
      .toBe(true);

    await page.keyboard.press("ControlOrMeta+j");
    await expect.poll(async () => pickerDialog(page).count()).toBe(0);
    await expect.poll(async () => isFocused(before)).toBe(true);

    await page.keyboard.press("ControlOrMeta+j");
    await pickerDialog(page).waitFor();
    await page.keyboard.press("Escape");
    await expect.poll(async () => pickerDialog(page).count()).toBe(0);
    await expect.poll(async () => isFocused(before)).toBe(true);
    await page.context().close();
  });

  it("gives focus to the chip when the side it came from went inert", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { search: "?theme=internal-fkas-private" });
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    await row(app, "Jonas Eide").focus();

    await page.keyboard.press("ControlOrMeta+j");
    await pickerDialog(page)
      .getByRole("group", { name: "Variant" })
      .getByRole("button", { name: "External", exact: true })
      .click();
    await expect.poll(async () => shownSide(page)).toBe("External");
    await page.keyboard.press("Escape");
    await expect.poll(async () => pickerDialog(page).count()).toBe(0);
    await expect.poll(async () => isFocused(trigger(page))).toBe(true);
    await page.context().close();
  });

  it("gives focus to the chip when the site it came from was replaced", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { search });
    const site = brandSite(page, "Fjordkraft");
    await site.scrollIntoViewIfNeeded();
    await site.getByRole("link").first().focus();

    await page.keyboard.press("ControlOrMeta+j");
    await pickerDialog(page)
      .getByRole("group", { name: "Brand" })
      .getByRole("button", { name: "Elmera", exact: true })
      .click();
    await brandSite(page, "Elmera Group").waitFor();
    await page.keyboard.press("Escape");
    await expect.poll(async () => pickerDialog(page).count()).toBe(0);
    await expect.poll(async () => isFocused(trigger(page))).toBe(true);
    await page.context().close();
  });

  it("opens the Sheet on a phone", async () => {
    const page = await openLanding(PHONE_VIEWPORT, { search });
    await page.keyboard.press("ControlOrMeta+j");
    await pickerDialog(page).getByRole("group", { name: "Colour scheme" }).waitFor();
    await page.context().close();
  });

  it("leaves the shortcut to a field being typed in", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { search });
    const field = page.getByRole("textbox", { name: "Meter number" });
    await field.focus();
    await page.keyboard.press("ControlOrMeta+j");
    // Wait past a render, so a popover the shortcut opened would be in the tree.
    await settleFrames(page);
    expect(await pickerDialog(page).count()).toBe(0);
    expect(await isFocused(field)).toBe(true);
    await page.context().close();
  });
});
