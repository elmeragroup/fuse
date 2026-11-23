/**
 * A Chromium page on Fuse's styles, themes and the kit's fonts, served from the preview page's origin
 * as the capture's pages are, shared by the suites that read a real Fuse component's layout. A suite
 * gives the page's body as markup, or an entry script that Rolldown bundles with React and the Fuse
 * build and the page runs as a module.
 */
import { NodeServices } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";
import { build } from "rolldown";

import { locateFuseBuild, readPageAssets } from "../src/compare/page-assets.ts";
import { ASSET_PATHS, PAGE_ORIGIN, STYLES_LAYERS } from "../src/compare/preview-page.ts";
import { kitFontCss } from "../src/kit-fonts.ts";

/** The module id of a suite's entry script, which only the bundle's plugin resolves. */
const ENTRY_ID = "\0fuse-page.js";

/** The page's path on the preview page's origin. */
const PAGE_PATH = "/fuse-page.html";

/**
 * The import specifier of a module of the Fuse build, for an entry script to import.
 *
 * @param file - The module's file in `packages/fuse/dist`, such as `toast.js`.
 * @returns The module's absolute path, as a JavaScript string literal.
 */
export function fuseModule(file: string): string {
  return JSON.stringify(fileURLToPath(new URL(`../../fuse/dist/${file}`, import.meta.url)));
}

/** The bundle of an entry script: React, the Fuse build and the script. */
async function bundle(entry: string): Promise<string> {
  const { output } = await build({
    input: ENTRY_ID,
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    plugins: [
      {
        name: "fuse-page",
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

/** What a suite puts on the page. */
export type FusePageContent = {
  /** The attributes of the `<html>` element, such as a theme and a density. */
  readonly htmlAttributes?: Readonly<Record<string, string>>;
  /** The body's markup. */
  readonly body?: string;
  /** An entry script the page bundles and runs as a module after the body. */
  readonly entry?: string;
};

/**
 * Serve a page with Fuse's styles, themes and fonts and the suite's content from the preview page's
 * origin, and open it. The page turns every animation and transition off.
 *
 * @param page - The Playwright page to open it in.
 * @param content - The page's `<html>` attributes, body and entry script.
 */
export async function openFusePage(page: Page, content: FusePageContent): Promise<void> {
  const assets = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* readPageAssets(yield* locateFuseBuild(), new Map());
    }).pipe(Effect.provide(NodeServices.layer))
  );
  const script = content.entry === undefined ? undefined : await bundle(content.entry);
  const attributes = Object.entries(content.htmlAttributes ?? {})
    .map(([name, value]) => ` ${name}="${value}"`)
    .join("");
  const html = `<!doctype html>
<html lang="en"${attributes}><head><meta charset="utf-8"><style>
@layer ${STYLES_LAYERS.join(", ")};
@import url("${ASSET_PATHS.preflight}") layer(base);
@import url("${ASSET_PATHS.styles}");
@import url("${ASSET_PATHS.themes}");
@import url("${ASSET_PATHS.fonts}");
${kitFontCss("body")}
body{margin:0;font-family:var(--font-sans)}
*,::before,::after{animation:none!important;transition:none!important}
</style></head><body>${content.body ?? ""}${script === undefined ? "" : `<script type="module" src="${ASSET_PATHS.client}"></script>`}</body></html>`;
  const served = new Map<string, readonly [string, string]>([
    [PAGE_PATH, [html, "text/html"]],
    [ASSET_PATHS.styles, [assets.styles, "text/css"]],
    [ASSET_PATHS.themes, [assets.themes, "text/css"]],
    [ASSET_PATHS.preflight, [assets.preflight, "text/css"]],
    [ASSET_PATHS.fonts, [assets.fontCss, "text/css"]],
    ...(script === undefined ? [] : [[ASSET_PATHS.client, [script, "text/javascript"]] as const]),
  ]);
  await page.route(`${PAGE_ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    const body = served.get(pathname);
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
  await page.goto(`${PAGE_ORIGIN}${PAGE_PATH}`);
}
