import type { Page } from "playwright";

import { docsBaseUrl } from "./docs-server";
import { launchSuiteBrowser } from "./suite-browser";

/** WCAG 2.2 target size (minimum), the floor AGENTS.md holds every control to. */
export const TARGET_FLOOR_PX = 24;

/** How a landing suite opens the page. */
export type LandingOptions = {
  /** Let the brand marks load, so the shaders draw. */
  readonly shaders?: boolean;
  /** The context's reduced-motion preference. Only a test that checks motion allows it. */
  readonly reducedMotion?: "reduce" | "no-preference";
  /** Runs before navigation, for routes, clocks, permissions and init scripts. */
  readonly prepare?: (page: Page) => Promise<void>;
};

/** The landing's opener for one suite file, bound to that file's browser. */
export type LandingSuite = {
  readonly openLanding: (
    viewport: { readonly width: number; readonly height: number },
    options?: LandingOptions
  ) => Promise<Page>;
};

/**
 * Launches one browser for the suite file and returns its landing opener. Each call opens the
 * landing in a fresh context and resolves once the hero's heading has rendered. Contexts reduce
 * motion unless a test that checks motion asks otherwise.
 *
 * Unless `shaders` is set, the brand marks are refused, so the closing shader never draws and the
 * picker's mark masks stay empty. Processing a mark blurs a large canvas on the main thread, which
 * on a slow runner held a brand pick back for seconds (measured with six shaders on the page: 2.8s
 * at 4x CPU throttling, 0.1s with the marks refused), and only the shader tests look at a shader.
 */
export function launchLandingSuite(): LandingSuite {
  const browser = launchSuiteBrowser();
  return {
    openLanding: async (viewport, { shaders = false, reducedMotion = "reduce", prepare } = {}) => {
      const context = await browser().newContext({ viewport, reducedMotion });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      if (!shaders) {
        await page.route("**/landing/marks/**", async (route) => route.abort());
      }
      await prepare?.(page);
      await page.goto(`${docsBaseUrl()}/`, { waitUntil: "load" });
      await page.getByRole("heading", { level: 1 }).waitFor();
      return page;
    },
  };
}
