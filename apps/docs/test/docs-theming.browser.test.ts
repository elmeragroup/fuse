import type { Page } from "playwright";
import { expect, it } from "vitest";

import { launchSuiteBrowser, readThemeAttributes, waitForDocsShellHydration } from "./demo-page";
import { docsBaseUrl } from "./docs-server";
import { drawnFace, faceFamilies, firstFamily } from "./drawn-face";

const browser = launchSuiteBrowser();

async function expectRole(page: Page, selector: string, property: string, token: string): Promise<void> {
  const result = await page
    .locator(selector)
    .first()
    .evaluate(
      (element, { property, token }) => {
        const reference = document.createElement("span");
        reference.style.setProperty(property, `var(--${token})`);
        element.append(reference);
        const expected = getComputedStyle(reference).getPropertyValue(property);
        const actual = getComputedStyle(element).getPropertyValue(property);
        reference.remove();
        return { actual, expected };
      },
      { property, token }
    );
  expect(result.actual, `${selector} ${property} uses --${token}`).toBe(result.expected);
}

it.each(["/docs", "/handbook/theming", "/handbook/theme-matrix", "/components/button"])(
  "paints %s from internal Elmera tokens when data-theme changes manually",
  async (path) => {
    const page = await browser().newPage({ colorScheme: "light" });
    await page.goto(`${docsBaseUrl()}${path}`, { waitUntil: "networkidle" });
    for (const scheme of ["light", "dark", "light"] as const) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), scheme);
      await page
        .getByRole("button", { name: "Theme settings", exact: true })
        .evaluate((element) =>
          Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)))
        );
      expect(await readThemeAttributes(page.locator("html"))).toEqual({
        variant: "internal",
        brand: "elma",
        segment: "private",
      });
      expect(await page.locator("body").evaluate((el) => getComputedStyle(el).colorScheme)).toBe(scheme);
      for (const selector of ["html", "body", "[data-docs-root]"]) {
        await expectRole(page, selector, "background-color", "background");
        await expectRole(page, selector, "color", "foreground");
      }
      await expectRole(page, "body", "font-family", "font-sans");
      await expectRole(page, "main h1", "font-family", "font-heading");
      await expectRole(page, "main h1", "color", "foreground");
      await expectRole(page, "main p", "color", "foreground");
      await expectRole(page, "header", "border-bottom-color", "border");
      await expectRole(
        page,
        'nav[aria-label="Main navigation"] a[href="/quick-start"]',
        "color",
        "muted-foreground"
      );
      // The trigger is a ghost Button: it paints no background or border, so the
      // inherited foreground is the only theme token it carries.
      await expectRole(page, 'button[aria-label="Theme settings"]', "color", "foreground");
      if (path === "/handbook/theming") {
        await expectRole(page, "main pre", "background-color", "card");
        await expectRole(page, "main pre", "font-family", "font-mono");
      }
    }
    await page.close();
  }
);

it("switches both matrix variants and the docs chrome together", async () => {
  const page = await browser().newPage({ colorScheme: "light" });
  await page.goto(`${docsBaseUrl()}/handbook/theme-matrix`, { waitUntil: "load" });
  const external = page.locator('[data-theme-matrix-cell][data-theme-variant="external"]').first();
  const internal = page.locator('[data-theme-matrix-cell][data-theme-variant="internal"]').first();
  const paint = async (): Promise<string[]> => [
    await external.evaluate((el) => getComputedStyle(el).backgroundColor),
    await internal.evaluate((el) => getComputedStyle(el).backgroundColor),
    await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor),
  ];
  const light = await paint();
  // Each cell's ThemeScope sets its own body font under the docs body's Inter: an external cell's
  // button draws Roboto and an internal cell's draws Inter.
  expect([
    await drawnFace(external.locator("button").first()),
    await drawnFace(internal.locator("button").first()),
  ]).toEqual(["--font-roboto", "--font-inter"]);
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
  const dark = await paint();
  expect(dark[0]).not.toBe(light[0]);
  expect(dark[1]).not.toBe(light[1]);
  expect(dark[2]).not.toBe(light[2]);
  expect(await page.getByRole("button", { name: "Dark", exact: true }).getAttribute("aria-pressed")).toBe(
    "true"
  );
  expect(await external.evaluate((el) => getComputedStyle(el).colorScheme)).toBe("dark");
  expect(await internal.evaluate((el) => getComputedStyle(el).colorScheme)).toBe("dark");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "light");
  expect(await paint()).toEqual(light);
  await page.close();
});

// The API rows' label band and a demo's code view paint on --card.
it.each([
  ["/components/tabs", "[data-api-rows-header]"],
  ["/components/button", "[data-demo-source]"],
] as const)("keeps the %s %s on --card in both schemes", async (path, selector) => {
  const page = await browser().newPage({ colorScheme: "light" });
  await page.goto(`${docsBaseUrl()}${path}`, { waitUntil: "networkidle" });
  for (const scheme of ["light", "dark"] as const) {
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), scheme);
    await expectRole(page, selector, "background-color", "card");
  }
  await page.close();
});

it("keeps search overlays in the document's dark palette", async () => {
  const page = await browser().newPage({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto(`${docsBaseUrl()}/components/button`, { waitUntil: "domcontentloaded" });
  await waitForDocsShellHydration(page);
  // The trigger's caps repeat its `aria-keyshortcuts`, so its name is the word alone.
  await page.getByRole("banner").getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)))
  );
  await expectRole(page, '[role="dialog"]', "background-color", "popover");
  await expectRole(page, '[role="dialog"]', "color", "popover-foreground");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.getByRole("dialog").count()).toBe(0);
  await page.close();
});

// Unit under test: the faces the docs load (`components/site-fonts.ts`). Oracle: the fonts page's
// weights, 400, 500, 600 and 700, for Inter and Roboto. Each face variable's first computed family
// is the face `next/font` declared. The CSS Font Loading API's `load()` resolves with the face font
// matching picks, which is a nearby weight when the requested one is missing, so the test reads
// each face's own family, weight and status. `Strøm` falls in the Latin subset the docs load.
it("serves Inter and Roboto in every weight Fuse parts set", async () => {
  const page = await browser().newPage({ colorScheme: "light" });
  await page.goto(`${docsBaseUrl()}/handbook/fonts`, { waitUntil: "load" });
  const families = [
    firstFamily(await faceFamilies(page, "--font-inter")),
    firstFamily(await faceFamilies(page, "--font-roboto")),
  ];
  expect(families.every((family) => family !== "")).toBe(true);
  expect(new Set(families).size).toBe(2);
  const loaded = await page.evaluate(
    async (named) =>
      Promise.all(
        named.flatMap((family) =>
          ["400", "500", "600", "700"].map(async (weight) => {
            const matched = await document.fonts.load(`${weight} 16px "${family}"`, "Strøm");
            return matched.map(
              (face) => `${face.family.replaceAll(/["']/g, "")} ${face.weight} ${face.status}`
            );
          })
        )
      ),
    families
  );
  expect(loaded).toEqual(
    families.flatMap((family) => ["400", "500", "600", "700"].map((weight) => [`${family} ${weight} loaded`]))
  );
  await page.close();
});
