/**
 * Unit under test: the premise of the capture's `NATURAL_HEIGHT_PROPERTIES` (`run-capture.ts`), that
 * Base UI's `--toast-height` on a toast's root and `--toast-frontmost-height` on its viewport hold the
 * root's natural height for the page's current text and density, so the capture may record both as
 * `auto`. Oracle: Chromium's layout of the same root with `height: auto` set by this test, read in the
 * same task as the two properties and the root's used height, so Base UI cannot measure in between.
 * The page mounts a real Fuse Toast through React, raises one toast, then changes its description to
 * three lines and its density to comfortable. In each state the test waits until the three agree,
 * which a height Base UI stopped updating never does, so the hang guard fails it.
 */
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { fileURLToPath } from "node:url";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { build } from "rolldown";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { locateFuseBuild, readPageAssets } from "../compare/page-assets.ts";
import type { PageAssets } from "../compare/page-assets.ts";
import { ASSET_PATHS, PAGE_ORIGIN, STYLES_LAYERS } from "../compare/preview-page.ts";
import { kitFontCss } from "../kit-fonts.ts";

const ENTRY_ID = "\0natural-height-toast.js";

/**
 * The page's script: a Toast provider whose manager raised one toast before it mounted, with no
 * timeout, in a 384px stack. A `describe-toast` event on the window changes its description.
 */
const ENTRY = `
import { createElement, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { LocaleProvider } from ${JSON.stringify(fileURLToPath(new URL("../../../fuse/dist/theme.js", import.meta.url)))};
import { Toast } from ${JSON.stringify(fileURLToPath(new URL("../../../fuse/dist/toast.js", import.meta.url)))};
const manager = Toast.createToastManager();
const id = manager.add({ title: "Draft saved", description: "You can finish it later.", type: "info", timeout: 0 });
window.addEventListener("describe-toast", (event) => manager.update(id, { description: event.detail }));
function Stack() {
  const host = useRef(null);
  return createElement("div", { ref: host, style: { position: "relative", width: "384px", minHeight: "28rem" } },
    createElement(Toast.Provider, { toastManager: manager, children: createElement(Toast.Viewport, {
      container: host, style: { position: "absolute", right: 0, bottom: 0, width: "100%" } }) }));
}
const root = document.createElement("div");
document.body.append(root);
flushSync(() => createRoot(root).render(createElement(LocaleProvider, { locale: "en-US", children: createElement(Stack) })));
`;

/** A description that wraps to three lines in the 384px stack. */
const LONG_DESCRIPTION =
  "You can finish it later, from the drafts list, on this device or on any other device you sign in on, for thirty days.";

/** What the page reads of the toast in one task: both custom properties, the used and the auto height. */
type Reading = {
  readonly toastHeight: string;
  readonly frontmostHeight: string;
  readonly used: number;
  readonly natural: number;
};

let browser: Browser;
let page: Page;

/** The page's bundle: React, the Fuse build and {@link ENTRY}. */
async function bundle(): Promise<string> {
  const { output } = await build({
    input: ENTRY_ID,
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    plugins: [
      {
        name: "natural-height-toast",
        resolveId: (id) => (id === ENTRY_ID ? id : undefined),
        load: (id) => (id === ENTRY_ID ? ENTRY : undefined),
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
async function serve(assets: PageAssets, script: string): Promise<void> {
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

/** The state a reading waits for: the toast's description and the document's density. */
type Settled = { readonly description: string; readonly density: string };

/**
 * Read the toast once its fonts have loaded and the page shows `settled`, polling each frame until
 * both properties and the root's used height equal its height with `height: auto`. Each poll sets
 * and clears that `auto` in one task, so Base UI cannot measure in between, and it writes only the
 * root's inline style, which Base UI's observers on the toast's content do not watch. The wait sets
 * no timeout of its own: a height Base UI never updates leaves only the hang guard to end the test.
 */
async function read(settled: Settled): Promise<Reading> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const handle = await page.waitForFunction(
    ({ description, density }): Reading | false => {
      const root = document.querySelector<HTMLElement>('[data-slot="toast-root"]');
      const viewport = document.querySelector<HTMLElement>('[data-slot="toast-viewport"]');
      if (
        root === null ||
        viewport === null ||
        root.querySelector('[data-slot="toast-description"]')?.textContent !== description ||
        document.documentElement.dataset.density !== density
      ) {
        return false;
      }
      const toastHeight = root.style.getPropertyValue("--toast-height");
      const frontmostHeight = viewport.style.getPropertyValue("--toast-frontmost-height");
      const used = root.getBoundingClientRect().height;
      const { height } = root.style;
      root.style.height = "auto";
      const natural = root.getBoundingClientRect().height;
      root.style.height = height;
      const px = `${String(natural)}px`;
      return toastHeight === px && frontmostHeight === px && used === natural
        ? { toastHeight, frontmostHeight, used, natural }
        : false;
    },
    settled,
    { polling: "raf", timeout: 0 }
  );
  const reading = await handle.jsonValue();
  if (reading === false) {
    throw new Error("the wait resolved before the heights settled");
  }
  return reading;
}

beforeAll(async () => {
  const assets = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* readPageAssets(yield* locateFuseBuild(), new Map());
    }).pipe(Effect.provide(NodeServices.layer))
  );
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await serve(assets, await bundle());
  await page.goto(`${PAGE_ORIGIN}/toast.html`);
  await page.waitForSelector('[data-slot="toast-root"]');
});

afterAll(async () => {
  await browser.close();
});

describe("Base UI's toast heights, as the root's natural height", () => {
  it("holds the root's auto height as its text and density change", async () => {
    const short = await read({ description: "You can finish it later.", density: "dense" });
    await page.evaluate((text) => {
      window.dispatchEvent(new CustomEvent("describe-toast", { detail: text }));
    }, LONG_DESCRIPTION);
    const long = await read({ description: LONG_DESCRIPTION, density: "dense" });
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-density", "comfortable");
    });
    const comfortable = await read({ description: LONG_DESCRIPTION, density: "comfortable" });
    // Each change moves the natural height, so a value kept from an earlier state never settles.
    expect(long.natural).toBeGreaterThan(short.natural);
    expect(comfortable.natural).toBeGreaterThan(long.natural);
  });
});
