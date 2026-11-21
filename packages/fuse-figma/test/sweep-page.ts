/**
 * The page the Chromium sweeps of a set's layout render their samples on: Fuse's preflight, styles,
 * themes and the kit's fonts, as the capture's preview page loads them, served from the preview
 * page's origin.
 */
import type { Page } from "playwright";

import type { PageAssets } from "../src/compare/page-assets.ts";
import { ASSET_PATHS, PAGE_ORIGIN, STYLES_LAYERS } from "../src/compare/preview-page.ts";
import { kitFontCss } from "../src/kit-fonts.ts";

/** The path the sweep page is served at. */
const SWEEP_PATH = "/sweep.html";

/**
 * The sweep page around the samples' markup.
 *
 * @param slots - Each sample's markup, in a slot of its own.
 * @returns The page's HTML.
 */
function sweepDocument(slots: readonly string[]): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
@layer ${STYLES_LAYERS.join(", ")};
@import url("${ASSET_PATHS.preflight}") layer(base);
@import url("${ASSET_PATHS.styles}");
@import url("${ASSET_PATHS.themes}");
@import url("${ASSET_PATHS.fonts}");
${kitFontCss("body")}
body{margin:0;font-family:var(--font-sans)}
</style></head><body>${slots.join("\n")}</body></html>`;
}

/**
 * Serve the sweep page and its assets from the preview page's origin, and open it.
 *
 * @param page - The browser page.
 * @param assets - The Fuse build's styles and the kit's fonts.
 * @param slots - Each sample's markup, in a slot of its own.
 */
export async function openSweep(page: Page, assets: PageAssets, slots: readonly string[]): Promise<void> {
  const html = sweepDocument(slots);
  await page.route(`${PAGE_ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    const css = new Map<string, string>([
      [ASSET_PATHS.styles, assets.styles],
      [ASSET_PATHS.themes, assets.themes],
      [ASSET_PATHS.preflight, assets.preflight],
      [ASSET_PATHS.fonts, assets.fontCss],
    ]).get(pathname);
    if (pathname === SWEEP_PATH) {
      await route.fulfill({ body: html, contentType: "text/html; charset=utf-8" });
    } else if (css !== undefined) {
      await route.fulfill({ body: css, contentType: "text/css; charset=utf-8" });
    } else if (pathname.startsWith(ASSET_PATHS.fontFiles)) {
      const [name = "", file = ""] = pathname.slice(ASSET_PATHS.fontFiles.length).split("/");
      const directory = assets.fontDirectories.get(name);
      await (directory === undefined
        ? route.fulfill({ status: 404 })
        : route.fulfill({ path: `${directory}/${file}` }));
    } else {
      await route.fulfill({ status: 404 });
    }
  });
  await page.goto(`${PAGE_ORIGIN}${SWEEP_PATH}`);
}
