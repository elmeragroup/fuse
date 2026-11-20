/**
 * A page that mounts a real Fuse Toast through React in Chromium, shared by the suites that read a
 * toast's layout. Rolldown bundles React, the Fuse build and a suite's entry script, and the page
 * serves the bundle with Fuse's styles, themes and fonts from the preview page's origin, so the toast
 * lays out as the capture's pages lay it out.
 */
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { fileURLToPath } from "node:url";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { build } from "rolldown";

import { locateFuseBuild, readPageAssets } from "../src/compare/page-assets.ts";
import type { PageAssets } from "../src/compare/page-assets.ts";
import { ASSET_PATHS, PAGE_ORIGIN, STYLES_LAYERS } from "../src/compare/preview-page.ts";
import { kitFontCss } from "../src/kit-fonts.ts";

/** The module id of a suite's entry script, which only the bundle's plugin resolves. */
const ENTRY_ID = "\0toast-page.js";

/**
 * The import specifier of a module of the Fuse build, for an entry script to import.
 *
 * @param file - The module's file in `packages/fuse/dist`, such as `toast.js`.
 * @returns The module's absolute path, as a JavaScript string literal.
 */
export function fuseModule(file: string): string {
  return JSON.stringify(fileURLToPath(new URL(`../../fuse/dist/${file}`, import.meta.url)));
}

/** The page's bundle: React, the Fuse build and the entry script. */
async function bundle(entry: string): Promise<string> {
  const { output } = await build({
    input: ENTRY_ID,
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    plugins: [
      {
        name: "toast-page",
        resolveId: (id) => (id === ENTRY_ID ? id : undefined),
        load: (id) => (id === ENTRY_ID ? entry : undefined),
      },
    ],
    platform: "browser",
    logLevel: "silent",
    transform: { define: { "process.env.NODE_ENV": JSON.stringify("production") } },
    output: { format: "esm", codeSplitting: false },
    write: false,
  });
  return output[0].code;
}

/** Serve the page, its bundle and Fuse's styles from the page's origin. */
async function serve(page: Page, assets: PageAssets, script: string): Promise<void> {
  const html = `<!doctype html>
<html lang="en" data-theme="light" data-density="dense"><head><meta charset="utf-8"><style>
@layer ${STYLES_LAYERS.join(", ")};
@import url("${ASSET_PATHS.preflight}") layer(base);
@import url("${ASSET_PATHS.styles}");
@import url("${ASSET_PATHS.themes}");
@import url("${ASSET_PATHS.fonts}");
${kitFontCss("body")}
body{margin:0;font-family:var(--font-sans)}
*,::before,::after{animation:none!important;transition:none!important}
</style></head><body><script type="module" src="${ASSET_PATHS.client}"></script></body></html>`;
  await page.route(`${PAGE_ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    const body = new Map<string, readonly [string, string]>([
      ["/toast.html", [html, "text/html"]],
      [ASSET_PATHS.client, [script, "text/javascript"]],
      [ASSET_PATHS.styles, [assets.styles, "text/css"]],
      [ASSET_PATHS.themes, [assets.themes, "text/css"]],
      [ASSET_PATHS.preflight, [assets.preflight, "text/css"]],
      [ASSET_PATHS.fonts, [assets.fontCss, "text/css"]],
    ]).get(pathname);
    if (body !== undefined) {
      await route.fulfill({ body: body[0], contentType: `${body[1]}; charset=utf-8` });
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
}

/**
 * Launch Chromium on a page that runs the entry script and wait until it shows a toast's root. The
 * caller closes the browser.
 *
 * @param entry - The entry script, which mounts a Toast provider and raises a toast. It imports the
 *   Fuse build through {@link fuseModule}.
 * @returns The browser and the page.
 */
export async function openToastPage(
  entry: string
): Promise<{ readonly browser: Browser; readonly page: Page }> {
  const assets = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* readPageAssets(yield* locateFuseBuild(), new Map());
    }).pipe(Effect.provide(NodeServices.layer))
  );
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await serve(page, assets, await bundle(entry));
  await page.goto(`${PAGE_ORIGIN}/toast.html`);
  await page.waitForSelector('[data-slot="toast-root"]');
  return { browser, page };
}
