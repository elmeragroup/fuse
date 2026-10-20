import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT } from "./demo-page";
import { dashboard, liveDemo, showSide } from "./landing-dashboard";
import { launchLandingSuite } from "./landing-page";
import { canvas, openStudio } from "./studio/page";
import { launchSuiteBrowser } from "./suite-browser";

const { openLanding } = launchLandingSuite();
const browser = launchSuiteBrowser();

/** The studio's autosave key, which a fresh session must discard. */
const AUTOSAVE_KEY = "fuse-studio-v1";

/**
 * A share link holding one readable edit. The studio restores it and keeps it saved; text it
 * cannot read would be dropped from the autosave once the session settles as pristine.
 */
const EDITED_SESSION = `#1.${Buffer.from(
  JSON.stringify({ t: "external-elma-private", l: { primary: "#ff0000" } }),
  "utf8"
).toString("base64url")}`;

describe("render failures stay inside the part that failed", () => {
  it("shows a reload prompt in place of a Dashboard whose code chunk is gone, and keeps the rest of the landing", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    // A redeploy removed the chunks this tab's build names.
    await page.route("**/_next/static/chunks/**", async (route) => route.abort());
    await showSide(page, "Internal");

    const failure = liveDemo(page).getByRole("alert").filter({ hasText: "The Dashboard could not load." });
    await failure.waitFor();
    expect(await failure.getByRole("button", { name: "Reload", exact: true }).count()).toBe(1);
    expect(await dashboard(page).count()).toBe(1);
    expect(await page.getByText("Application error", { exact: false }).count()).toBe(0);
    expect(await page.getByRole("navigation").count()).toBeGreaterThan(0);

    await page.unrouteAll({ behavior: "ignoreErrors" });
    await showSide(page, "External");
    const site = liveDemo(page).getByRole("region", { name: /website$/u });
    await expect.poll(async () => site.getByRole("heading", { level: 1 }).count()).toBeGreaterThan(0);
    await page.context().close();
  });

  it("offers a fresh session when the studio fails to render, which discards the saved edits", async () => {
    const { context, page } = await openStudio(browser(), {
      hash: EDITED_SESSION,
      prepare: async (target) => {
        await target.addInitScript(() => {
          // While the flag is set, every custom property the studio paints throws, so the studio
          // fails as it commits, as an edit that breaks rendering would.
          // oxlint-disable-next-line typescript/unbound-method -- kept to call with the declaration as `this` below
          const setProperty = CSSStyleDeclaration.prototype.setProperty;
          CSSStyleDeclaration.prototype.setProperty = function (
            this: CSSStyleDeclaration,
            name: string,
            value: string | null,
            priority?: string
          ): void {
            if (sessionStorage.getItem("break-studio") === "1" && name.startsWith("--")) {
              throw new Error("studio render failure");
            }
            setProperty.call(this, name, value, priority);
          };
        });
      },
    });
    // The restored edit is the session's saved state once the studio has written it.
    const autosave = async () => page.evaluate((key) => localStorage.getItem(key), AUTOSAVE_KEY);
    await expect.poll(autosave).not.toBeNull();
    const saved = await autosave();
    await page.evaluate(() => {
      sessionStorage.setItem("break-studio", "1");
    });
    await page.reload({ waitUntil: "load" });

    const title = page.getByRole("heading", { level: 1, name: "The studio could not load" });
    await title.waitFor();
    // The failed session's saved edits survive until the visitor chooses a fresh session.
    expect(await autosave()).toBe(saved);

    await page.evaluate(() => {
      sessionStorage.removeItem("break-studio");
    });
    await page.getByRole("button", { name: "Start a fresh session", exact: true }).click();
    await canvas(page).waitFor();
    expect(await autosave()).toBeNull();
    expect(new URL(page.url()).hash).toBe("");
    await context.close();
  });
});
