import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

import * as Hex from "@elmeragroup/color/hex";

import { DESKTOP_VIEWPORT, expectInside, launchSuiteBrowser, readThemeAttributes } from "./demo-page";
import { docsBaseUrl } from "./docs-server";

const browser = launchSuiteBrowser();

/** WCAG 2.2 target size (minimum), the floor AGENTS.md holds every control to. */
const TARGET_FLOOR_PX = 24;

/**
 * Opens the landing in a fresh context. `prepare` runs before navigation, for routes, clocks,
 * permissions and init scripts. No test checks motion, so every context reduces motion.
 *
 * Unless `shaders` is set, the brand marks are refused, so no shader draws. Processing the six
 * marks blurs large canvases on the main thread at load. On a slow runner that holds a brand
 * pick back for seconds (measured: 2.8s at 4x CPU throttling, 0.1s with the marks refused), and
 * only the shader tests look at a shader.
 */
async function openLanding(
  viewport: { width: number; height: number },
  { shaders = false, prepare }: { shaders?: boolean; prepare?: (page: Page) => Promise<void> } = {}
): Promise<Page> {
  const context = await browser().newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  if (!shaders) {
    await page.route("**/landing/marks/**", async (route) => route.abort());
  }
  await prepare?.(page);
  await page.goto(`${docsBaseUrl()}/`, { waitUntil: "load" });
  await page.getByRole("heading", { level: 1 }).waitFor();
  return page;
}

/** Every unhandled error and rejection the page raises, collected from now on. */
function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

describe("landing page", () => {
  it("swaps the Components menu's stage as its entry links take hover or keyboard focus", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);

    await page.getByRole("button", { name: "Components", exact: true }).click();
    // DOM audit: the menu panel has no role, so it is found by its slot. The density demo in
    // the page has its own "Save reading" button, so the stage is looked up inside the panel.
    const panel = page.locator("[data-slot='navigation-menu-content']");
    const buttonStage = panel.getByRole("button", { name: "Save reading" });
    await buttonStage.waitFor();

    const entry = (name: string) => panel.getByRole("link", { name: new RegExp(`^${name}`, "u") });
    expect(await entry("Button").getAttribute("href")).toBe("/components/button");

    await entry("Button").focus();
    await page.keyboard.press("ArrowDown");
    await expect.poll(async () => panel.getByRole("switch", { name: "Price alerts" }).isVisible()).toBe(true);
    await expect.poll(async () => buttonStage.count()).toBe(0);

    await page.keyboard.press("Tab");
    await expect
      .poll(async () => panel.getByRole("meter", { name: "Monthly budget" }).isVisible())
      .toBe(true);

    await entry("Badge").hover();
    await expect.poll(async () => panel.getByText("Overdue", { exact: true }).isVisible()).toBe(true);
    await page.context().close();
  });

  it("keeps the page working when the brand marks fail to load", async () => {
    let errors: string[] = [];
    const failed = new Set<string>();
    const page = await openLanding(DESKTOP_VIEWPORT, {
      // The test refuses the marks itself, so it can count the failed requests.
      shaders: true,
      prepare: async (target) => {
        errors = collectPageErrors(target);
        target.on("requestfailed", (request) => failed.add(request.url()));
        await target.route("**/landing/marks/**", async (route) => route.abort());
      },
    });

    // Every brand's mark is requested once, then shared by the shaders that show it.
    await expect.poll(() => failed.size, { timeout: 10_000 }).toBe(6);
    // A rejected mark reaches its shader on React's next render; give that render time to land.
    await page.waitForTimeout(1000);

    expect(errors).toEqual([]);
    expect(await page.getByRole("heading", { level: 1, name: /One system/u }).isVisible()).toBe(true);
    expect(await page.getByRole("navigation", { name: "Primary" }).isVisible()).toBe(true);
    expect(
      await page
        .getByRole("region", { name: /Pick a brand/u })
        .getByRole("button")
        .count()
    ).toBe(6);
    await page.context().close();
  });

  it("keeps the hero's shader canvas mounted when a brand is picked", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { shaders: true });
    // DOM audit: a shader canvas has no role.
    const canvas = page.getByRole("region", { name: /One system/u }).locator("canvas");
    await expect.poll(async () => canvas.count(), { timeout: 10_000 }).toBe(1);
    const before = await canvas.elementHandle();

    await page.getByRole("button").filter({ hasText: 'data-theme-brand="fkas"' }).click();
    // The other brands' marks may still be processing; give the pick the page's 5s budget.
    await expect
      .poll(async () => (await readThemeAttributes(page.locator("html"))).brand, { timeout: 5000 })
      .toBe("fkas");

    expect(await canvas.evaluate((current, original) => current === original, before)).toBe(true);
    await page.context().close();
  });

  it("never scrolls sideways, and draws every wordmark at its full height inside its slot", async () => {
    // The marks are refused (openLanding's default), so no shader draws. Their canvas is
    // absolutely positioned with `contain: strict`, so it could not change the page width or a
    // wordmark's box anyway.
    const page = await openLanding({ width: 768, height: 900 });
    const picker = page.getByRole("region", { name: /Pick a brand/u });
    const tiles = picker.getByRole("button");
    await expect.poll(async () => tiles.count()).toBe(6);

    // The rail has three columns below 1280px and six from there; both layouts are measured.
    for (const width of [768, 820, 960, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${String(width)}px viewport`).toBe(0);
      for (const mark of await picker.getByRole("img").all()) {
        await expectInside(mark, mark.locator(".."));
      }
      // A capped box keeps its height and narrows, so a wordmark at its full optical size is
      // exactly as wide as its declared aspect ratio makes that height.
      const shrunk = await tiles.evaluateAll((buttons) =>
        buttons.flatMap((button) => {
          const mark = button.querySelector("[role='img']");
          if (mark === null) {
            return [`no wordmark in ${button.textContent}`];
          }
          const [across = Number.NaN, down = Number.NaN] = getComputedStyle(mark)
            .aspectRatio.split("/")
            .map(Number);
          const box = mark.getBoundingClientRect();
          const expected = (box.height * across) / down;
          return Math.abs(box.width - expected) <= 1
            ? []
            : [
                `${mark.getAttribute("aria-label") ?? ""}: ${String(box.width)}px wide, ${String(expected)}px expected`,
              ];
        })
      );
      expect(shrunk, `${String(width)}px viewport`).toEqual([]);
    }
    await page.context().close();
  });

  it("gives every invoice row's button a target at least 24px tall", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    await page.getByRole("tab", { name: "Invoices" }).click();
    const invoices = page.getByRole("button", { name: /^\d{4}$/u });
    await expect.poll(async () => invoices.count()).toBeGreaterThan(0);

    // A press 1/4px inside each edge of a 24px band centred on the button must still land on it.
    const reach = TARGET_FLOOR_PX / 2 - 0.25;
    const misses = await invoices.evaluateAll(
      (buttons, offset) =>
        buttons.flatMap((button) => {
          // elementFromPoint only sees the viewport.
          button.scrollIntoView({ block: "center" });
          const rect = button.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          return [y - offset, y + offset].flatMap((probe) => {
            const hit = document.elementFromPoint(x, probe);
            return hit !== null && button.contains(hit)
              ? []
              : [`${button.textContent} at y=${String(probe)}`];
          });
        }),
      reach
    );
    expect(misses).toEqual([]);
    await page.context().close();
  });

  it("reports a refused clipboard write instead of raising an unhandled rejection", async () => {
    let errors: string[] = [];
    const page = await openLanding(DESKTOP_VIEWPORT, {
      prepare: async (target) => {
        errors = collectPageErrors(target);
        await target.addInitScript(() => {
          navigator.clipboard.writeText = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
        });
      },
    });

    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await page.getByRole("region", { name: "Notifications" }).getByText("Could not copy").waitFor();
    expect(await page.getByRole("button", { name: "Copy", exact: true }).isVisible()).toBe(true);
    expect(errors).toEqual([]);
    await page.context().close();
  });

  it("confirms a copy, then restores the Copy label", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, {
      prepare: async (target) => {
        await target.context().grantPermissions(["clipboard-read", "clipboard-write"]);
        await target.clock.install();
      },
    });
    // A paused clock keeps "Copied" up until the test moves time on, however busy the page is.
    await page.clock.pauseAt(Date.now() + 1000);

    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await page.getByRole("button", { name: "Copied", exact: true }).waitFor();
    // landing-install.tsx shows "Copied" for 1600ms.
    await page.clock.runFor(1600);
    await page.getByRole("button", { name: "Copy", exact: true }).waitFor();
    expect(await page.evaluate(async () => navigator.clipboard.readText())).toBe(
      "pnpm add @elmeragroup/fuse"
    );
    await page.context().close();
  });

  it("points both theme-color tags at the background of the brand just picked", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);

    await page.getByRole("button").filter({ hasText: 'data-theme-brand="fkas"' }).click();
    await expect.poll(async () => (await readThemeAttributes(page.locator("html"))).brand).toBe("fkas");

    // The canvas rasterises the computed background to sRGB bytes, independent of the page's
    // own colour parsing.
    const read = async () =>
      page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const context2d = canvas.getContext("2d");
        if (context2d === null) {
          return undefined;
        }
        context2d.fillStyle = getComputedStyle(document.body).backgroundColor;
        context2d.fillRect(0, 0, 1, 1);
        return {
          painted: [...context2d.getImageData(0, 0, 1, 1).data.slice(0, 3)],
          tags: [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((meta) => ({
            media: meta.media,
            content: meta.content,
          })),
        };
      });
    const drift = async () => {
      const page2d = await read();
      if (page2d === undefined) {
        return ["no 2d context"];
      }
      const { painted, tags } = page2d;
      const media = tags.map((tag) => tag.media).sort();
      const problems =
        media.join() === "(prefers-color-scheme: dark),(prefers-color-scheme: light)"
          ? []
          : [`theme-color media: [${media.join(", ")}]`];
      for (const { content } of tags) {
        const parsed = Hex.parse(content);
        if (parsed._tag === "err") {
          problems.push(`not a hex colour: "${content}"`);
          continue;
        }
        const { r, g, b } = parsed.value;
        const tagged = [r, g, b].map((channel) => Math.round(channel * 255));
        if (tagged.some((channel, index) => Math.abs(channel - (painted[index] ?? -1)) > 1)) {
          problems.push(`${content} vs rgb(${painted.join(", ")})`);
        }
      }
      return problems;
    };
    await expect.poll(drift).toEqual([]);
    await page.context().close();
  });
});
