import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, readThemeAttributes } from "./demo-page";
import {
  DASHBOARD_FIRST,
  ELMERA,
  FJORDKRAFT,
  PHONE_VIEWPORT,
  brandSite,
  dashboard,
  isInert,
  liveDemo,
  openNewOrder,
  openOrderSearch,
  pickBrand,
  row,
  searchTable,
  showSide,
  shownSide,
  sideSwitch,
  WIDE_VIEWPORT,
  windowCaption,
} from "./landing-dashboard";
import { holdChunks, launchLandingSuite, settleFrames } from "./landing-page";
import type { HeldChunks } from "./landing-page";

const { openLanding } = launchLandingSuite({ search: DASHBOARD_FIRST });

/** The chrome's caption while the window shows the Dashboard. */
const INTERNAL_CAPTION = "Dashboard: an internal sales and back-office app built with Fuse";

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
  // Base UI drops the lock a task after the last modal unmounts, so a slow runner reads it held.
  await expect.poll(async () => documentStyles(page)).toBe(unlocked);
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
  const button = sideSwitch(page, { includeHidden: true }).getByRole("button", {
    name: side,
    exact: true,
    includeHidden: true,
  });
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
  const button = sideSwitch(page).getByRole("button", { name: side, exact: true });
  // Base UI returns focus after the dialog unmounts; two frames let a late return land first.
  await settleFrames(page);
  expect(
    await button.evaluate((element) => ({
      focused: element === document.activeElement,
      inert: document.activeElement?.closest("[inert]") !== null,
    }))
  ).toEqual({ focused: true, inert: false });
}

describe("landing hero window, External side", () => {
  it("flips the content, the variant and the caption with the switch, keeps the window's height, and loads no site image before", async () => {
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
    expect(await readThemeAttributes(page.locator("html"))).toEqual({
      variant: "internal",
      brand: "elma",
      segment: "private",
    });

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

    const before = await liveDemo(page).boundingBox();
    await showSide(page, "External");
    const site = brandSite(page, FJORDKRAFT.site);
    await site.getByRole("heading", { level: 1, name: FJORDKRAFT.heading }).waitFor();
    expect((await liveDemo(page).boundingBox())?.height).toBe(before?.height);
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
    // The switch moves the landing's own variant: the document wears the side the window shows.
    expect(await readThemeAttributes(page.locator("html"))).toEqual({
      variant: "external",
      brand: "fkas",
      segment: "private",
    });

    await showSide(page, "Internal");
    await expect.poll(async () => isInert(site)).toBe(true);
    expect(await windowCaption(page)).toBe(`Live demo${INTERNAL_CAPTION}`);
    expect((await readThemeAttributes(internalScope)).variant).toBe("internal");
    expect(await readThemeAttributes(page.locator("html"))).toEqual({
      variant: "internal",
      brand: "fkas",
      segment: "private",
    });
    await page.context().close();
  });

  it("closes the Dashboard's New order Sheet on a flip, so the site stays reachable, and keeps the selected order through the round trip", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const unlocked = await documentStyles(page);
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    await row(app, "Jonas Eide").click();
    expect(await row(app, "Jonas Eide").getAttribute("aria-current")).toBe("true");
    await openNewOrder(app);

    await pressSwitchPastModal(page, "External");
    const site = brandSite(page, ELMERA.site);
    await expectReachable(page, site, unlocked);
    await site.getByRole("heading", { level: 1, name: ELMERA.heading }).waitFor();
    await expectFocusOnSwitch(page, "External");

    await showSide(page, "Internal");
    await expect.poll(async () => isInert(app)).toBe(false);
    expect(await row(app, "Jonas Eide").getAttribute("aria-current")).toBe("true");
    expect(
      await app.getByRole("complementary", { name: "Order details" }).getByText("Jonas Eide").count()
    ).toBeGreaterThan(0);
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

  it("closes the phone's Order details Sheet and its Cancel order confirmation when the nav's picker flips the window", async () => {
    const page = await openLanding(PHONE_VIEWPORT);
    const unlocked = await documentStyles(page);
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    await row(app, "Jonas Eide").click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Cancel order…" }).click();
    await page.getByRole("alertdialog", { name: /^Cancel order/u }).waitFor();

    // The confirmation hides the nav from assistive technology, so the shortcut opens the picker.
    await page.keyboard.press("ControlOrMeta+j");
    const picker = page.getByRole("dialog", { name: "Theme" });
    await picker
      .getByRole("group", { name: "Variant" })
      .getByRole("button", { name: "External", exact: true })
      .click();
    // DOM audit: the window's modals sit on the inert side once the flip lands, past any role query.
    await expect.poll(async () => liveDemo(page).locator(MODAL).count()).toBe(0);
    if ((await picker.count()) > 0) {
      await page.keyboard.press("ControlOrMeta+j");
    }
    const site = brandSite(page, ELMERA.site);
    await expectReachable(page, site, unlocked);

    await showSide(page, "Internal");
    await expect.poll(async () => isInert(app)).toBe(false);
    await row(app, "Jonas Eide").click();
    // The seeds put Jonas Eide's order in Awaiting customer approval; a dismissal leaves it there.
    expect(
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /^Status/u })
        .getAttribute("aria-label")
    ).toBe("Status: Awaiting customer approval");
    await page.context().close();
  });

  it("closes the phone's Order details Sheet and its Cancel order confirmation when Forward flips the window", async () => {
    const page = await openLanding(PHONE_VIEWPORT, { search: "?theme=internal-fkas-company" });
    const unlocked = await documentStyles(page);
    await page.getByRole("banner").getByRole("link", { name: "Fuse" }).click();
    await expect.poll(() => new URL(page.url()).search).toBe("");
    await page.goBack();
    const app = dashboard(page);
    await expect.poll(async () => isInert(app)).toBe(false);
    await app.scrollIntoViewIfNeeded();
    await row(app, "Jonas Eide").click();
    await page.getByRole("dialog").getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Cancel order…" }).click();
    await page.getByRole("alertdialog", { name: /^Cancel order/u }).waitFor();

    // The route, not a control, moves the variant: `/` opens on External.
    await page.goForward();
    await expect.poll(() => new URL(page.url()).search).toBe("");
    await expectReachable(page, brandSite(page, ELMERA.site), unlocked);

    await showSide(page, "Internal");
    await expect.poll(async () => isInert(app)).toBe(false);
    await expectReachable(page, app, unlocked);
    await row(app, "Jonas Eide").click();
    // The seeds put Jonas Eide's order in Awaiting customer approval; a dismissal leaves it there.
    expect(
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /^Status/u })
        .getAttribute("aria-label")
    ).toBe("Status: Awaiting customer approval");
    await page.context().close();
  });

  it("closes Order search's Columns menu and Rows per page Select when Forward flips the window, and keeps the table's state and layout", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, {
      search: "?theme=internal-fkas-company",
      reducedMotion: "no-preference",
    });
    const unlocked = await documentStyles(page);
    await page.getByRole("banner").getByRole("link", { name: "Fuse" }).click();
    await expect.poll(() => new URL(page.url()).search).toBe("");
    await page.goBack();
    await expect.poll(async () => isInert(dashboard(page))).toBe(false);
    const app = await openOrderSearch(page);
    const site = brandSite(page, ELMERA.site);
    const rowsPerPage = app.getByRole("combobox", { name: "Rows per page" });
    // DOM audit: a popup left behind on the inert side has no role a query could reach.
    const popups = page.locator("[role='menu'], [role='listbox']");

    // Each control holds its own open state; the route flips the window.
    const openers = [
      async () => {
        await app.getByRole("button", { name: "Columns" }).click();
        await page.getByRole("menuitemcheckbox", { name: "Customer" }).click();
        await page.getByRole("menu").waitFor();
      },
      async () => {
        await rowsPerPage.click();
        await page.getByRole("option", { name: "25", exact: true }).click();
        await app.getByRole("button", { name: "Go to next page" }).click();
        await app.getByText("Page 2 of 3").waitFor();
        await rowsPerPage.click();
        await page.getByRole("listbox").waitFor();
      },
    ];
    for (const open of openers) {
      await open();
      await page.goForward();
      await expect.poll(() => new URL(page.url()).search).toBe("");
      await expect.poll(async () => popups.count()).toBe(0);
      await expectReachable(page, site, unlocked);
      await page.goBack();
      await expect.poll(async () => isInert(app)).toBe(false);
      await expectReachable(page, app, unlocked);
    }

    // The table kept what each control set: the hidden column, the page size and the page.
    expect(await searchTable(app).getByRole("columnheader", { name: "Customer" }).count()).toBe(0);
    // The fixture's 51 orders make three pages only at 25 a page.
    await app.getByText("Page 2 of 3").waitFor();

    // Mid-flip, the fading Dashboard keeps both controls in its layout, so its table body holds
    // its height instead of growing into the space they would free. The exit scales the side, so
    // the read takes the layout height, which no transform changes.
    const bodyHeight = async () =>
      searchTable(app).evaluate((table) => {
        // DOM audit: the scroll area has no role; locate it by the mandated data-slot.
        const body = table.closest("[data-slot=scroll-area]");
        return body instanceof HTMLElement ? body.offsetHeight : 0;
      });
    const before = await bodyHeight();
    await freezeAnimations(page);
    await page.goForward();
    await expect.poll(async () => isInert(app)).toBe(true);
    await seekSide(app, 30);
    // DOM audit: the hidden side is inert, past any role query; locate the controls by attribute.
    for (const selector of ["[data-slot=data-table-column-toggle]", "[data-order-pagination]"]) {
      const control = app.locator(selector);
      expect(await control.count(), selector).toBe(1);
      expect((await control.boundingBox())?.height ?? 0, selector).toBeGreaterThan(0);
    }
    expect(await bodyHeight()).toBe(before);
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
    // The flip re-themes the page under the circle reveal, which commits the new side once the
    // view transition has captured the old one.
    await expect.poll(async () => isInert(app)).toBe(true);
    // The negative control for the reduced-motion case: the flip runs its transitions.
    expect(await sideTransitions(app)).toContain("opacity");

    // A quarter of the way through the Dashboard's 120ms exit, it is part way gone.
    await seekSide(app, 30);
    const leaving = await opacity(app);
    expect(leaving).toBeGreaterThan(0);
    expect(leaving).toBeLessThan(1);

    // The reversal starts from the opacity the exit reached: no jump in either direction. The
    // frozen reveal keeps the page out of hit testing, as any reveal does while it plays, so the
    // reversal comes from the keyboard: the flip left focus on the pressed External button.
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Space");
    await expect.poll(async () => isInert(app)).toBe(false);
    expect(await opacity(app)).toBeCloseTo(leaving, 5);

    await finishSide(app);
    await finishSide(site);
    expect(await opacity(app)).toBe(1);
    expect(await opacity(site)).toBe(0);
    await page.context().close();
  });
});

describe("landing hero window, opening on External", () => {
  it("leaves the Dashboard out until Internal first shows, then keeps it and its state through a round trip", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { search: "" });
    expect(await shownSide(page)).toBe("External");
    expect(await dashboard(page).count()).toBe(0);

    await showSide(page, "Internal");
    const app = dashboard(page);
    const scope = app.getByRole("group", { name: "Orders to show" });
    await scope.getByRole("button", { name: "All", exact: true }).click();
    await expect.poll(async () => scope.getByRole("button", { pressed: true }).textContent()).toBe("All");

    await showSide(page, "External");
    await expect.poll(async () => isInert(app)).toBe(true);
    await showSide(page, "Internal");
    await expect.poll(async () => isInert(app)).toBe(false);
    expect(await scope.getByRole("button", { pressed: true }).textContent()).toBe("All");
    await page.context().close();
  });
});

describe("landing hero window, opening on Internal", () => {
  it("keeps the server's Dashboard on screen while its code is still loading, until it hydrates", async () => {
    let held: HeldChunks | undefined;
    const page = await openLanding(DESKTOP_VIEWPORT, {
      hydrated: false,
      prepare: async (target) => {
        // Only the Dashboard's code renders its notifications region's label.
        held = await holdChunks(target, "Dashboard notifications");
        // DOM audit: a dropped server rendering empties the Dashboard's region between two
        // queries, so an observer watches every mutation for a region without its theme scope
        // and marks the document when it sees one.
        await target.addInitScript(() => {
          new MutationObserver(() => {
            const region = document.querySelector("[role='region'][aria-label='Dashboard']");
            if (region?.querySelector("[data-theme-variant]") === null) {
              document.documentElement.dataset.dashboardEmptied = "";
            }
          }).observe(document, { childList: true, subtree: true });
        });
      },
    });
    const app = dashboard(page);
    await app.getByRole("button", { name: /^New order/u }).waitFor();
    // The page's own code runs while the Dashboard's waits: Next's bootstrap marks the window
    // before it hydrates, and hydration then runs as far as it can without the Dashboard's code.
    await page.waitForFunction(() => "next" in window);
    await page.waitForTimeout(1000);
    expect(held?.caught().length).toBeGreaterThan(0);
    expect(await app.getByRole("button", { name: /^New order/u }).count()).toBe(1);

    held?.release();
    await app.getByRole("region", { name: "Dashboard notifications" }).waitFor({ state: "attached" });
    await app.getByRole("button", { name: /^New order/u }).click();
    await page.getByRole("dialog", { name: "New order" }).waitFor();
    expect(await page.locator("html").getAttribute("data-dashboard-emptied")).toBeNull();
    await page.context().close();
  });
});

describe("landing hero window, frame", () => {
  it("keeps the window's shadow inside every ancestor that clips it", async () => {
    const page = await openLanding(WIDE_VIEWPORT);
    const clips = await liveDemo(page).evaluate((demo) => {
      // The shadow's reach past each edge of its box, from the computed outset shadows: the blur
      // radius and the spread, moved by the offset (CSS Backgrounds 3, "box-shadow").
      const reach = { top: 0, right: 0, bottom: 0, left: 0 };
      for (const shadow of getComputedStyle(demo).boxShadow.split(/,(?![^(]*\))/u)) {
        if (shadow.includes("inset")) {
          continue;
        }
        const [x = 0, y = 0, blur = 0, spread = 0] = [...shadow.matchAll(/(-?[\d.]+)px/gu)].map((match) =>
          Number(match[1])
        );
        reach.top = Math.max(reach.top, blur + spread - y);
        reach.right = Math.max(reach.right, blur + spread + x);
        reach.bottom = Math.max(reach.bottom, blur + spread + y);
        reach.left = Math.max(reach.left, blur + spread - x);
      }
      const box = demo.getBoundingClientRect();
      const painted = {
        top: box.top - reach.top,
        right: box.right + reach.right,
        bottom: box.bottom + reach.bottom,
        left: box.left - reach.left,
      };
      // DOM audit: a mask or a clipping overflow on an ancestor cuts what it paints outside its box.
      const found: { clip: string; inside: boolean }[] = [];
      for (let element = demo.parentElement; element !== null; element = element.parentElement) {
        const style = getComputedStyle(element);
        const masks = style.maskImage !== "none";
        const clipsX = style.overflowX !== "visible";
        const clipsY = style.overflowY !== "visible";
        if (!masks && !clipsX && !clipsY) {
          continue;
        }
        const rect = element.getBoundingClientRect();
        const insideX = rect.left <= painted.left && painted.right <= rect.right;
        const insideY = rect.top <= painted.top && painted.bottom <= rect.bottom;
        found.push({
          clip: `${element.tagName.toLowerCase()}.${element.className}`,
          inside: (masks || clipsX ? insideX : true) && (masks || clipsY ? insideY : true),
        });
      }
      return { reach, found };
    });
    expect(clips.reach.bottom, "the window casts a shadow").toBeGreaterThan(0);
    expect(clips.found.length, "the fade's mask clips the window").toBeGreaterThan(0);
    expect(clips.found.filter((clip) => !clip.inside)).toEqual([]);
    await page.context().close();
  });
});
