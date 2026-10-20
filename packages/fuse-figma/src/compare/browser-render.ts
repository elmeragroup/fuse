/// <reference lib="dom" />
/**
 * The browser side of the comparison: Playwright's Chromium renders a preview's cells on one page
 * at device scale 2 and crops each cell with a transparent background.
 *
 * Hover and focus come from Chrome DevTools Protocol `CSS.forcePseudoState`, so every cell of a
 * page shows its state at once and no pointer or focus moves between screenshots. Fuse gates
 * hover behind `@media (hover: hover)` and `:not(<disabled>)`, so the page checks each forced
 * cell against its resting twin: a forced cell whose colors, shadow and underline equal the
 * twin's did not reach Fuse's `enabled-hover:` or `focus-visible:` rules, and the page then
 * hovers or focuses that button for real before its screenshot.
 */

import { Result } from "effect";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import type { Browser, Page, Route } from "playwright";

import type { ForcedPseudoClass } from "./cell-markup.ts";
import type { PageAssets } from "./page-assets.ts";
import {
  ASSET_PATHS,
  BACKGROUND_PROBE,
  cellButtonSelector,
  PAGE_ORIGIN,
  pageViewport,
  previewDocument,
} from "./preview-page.ts";
import type { PageCell, PageLayout } from "./preview-page.ts";
import type { PreviewTheme, ThemeStamps } from "./preview-theme.ts";
import { themeStamps } from "./preview-theme.ts";
import { crop, decodePng } from "./raster.ts";
import type { Raster, Rgb } from "./raster.ts";
import type { BoxSize } from "./verdict.ts";

/** Device pixels per CSS pixel, the scale the plugin exports at. */
export const DEVICE_SCALE = 2;

/** A cell to render: its Button's HTML, the state to force, and its resting twin's HTML. */
export type CellRequest = {
  readonly id: string;
  readonly html: string;
  readonly forced: readonly ForcedPseudoClass[];
  /** The same Button at rest, rendered off to the side to check the forced state. */
  readonly restingHtml: string | undefined;
};

/**
 * How the page reached a cell's state.
 *
 * - `none`: the cell forces nothing.
 * - `forced`: forcing the pseudo classes changed the button's styles.
 * - `interaction`: forcing changed nothing, and a real hover or focus did.
 * - `missing`: neither changed anything, so the screenshot shows the resting button.
 */
export type StateOutcome = "none" | "forced" | "interaction" | "missing";

/** One rendered cell. */
export type RenderedCell = {
  /** The crop: the border box plus the layout's padding on every side, transparent outside. */
  readonly raster: Raster;
  /** The button's border box in CSS pixels. */
  readonly box: BoxSize;
  readonly state: StateOutcome;
};

/** One rendered preview. */
export type RenderedPreview = {
  /** The theme's `background`, which the comparison lays both pictures over. */
  readonly background: Rgb;
  /** The font the buttons use, as `<weight> <family>`, after the page checked it loaded. */
  readonly font: string;
  readonly cells: ReadonlyMap<string, RenderedCell>;
};

/** Chromium could not start. */
export class BrowserUnavailable extends Error {
  readonly _tag = "BrowserUnavailable" as const;
}

/** The page did not load the font its buttons use, so the text would come from a fallback. */
export class FontNotLoaded extends Error {
  readonly _tag = "FontNotLoaded" as const;
}

/** The computed styles a hover or focus face changes. */
type StyleSignature = readonly string[];

const REFERENCE_PREFIX = "rest-";

function unquote(family: string): string {
  return family.trim().replaceAll(/^["']|["']$/g, "");
}

/** A Chromium instance that renders preview pages. */
export class CompareBrowser {
  readonly #browser: Browser;
  readonly #assets: PageAssets;

  private constructor(browser: Browser, assets: PageAssets) {
    this.#browser = browser;
    this.#assets = assets;
  }

  /**
   * Start Chromium.
   *
   * @param assets - The files the page loads.
   * @returns The browser, or `BrowserUnavailable` when Playwright's Chromium is not installed.
   */
  static async launch(assets: PageAssets): Promise<Result.Result<CompareBrowser, BrowserUnavailable>> {
    try {
      return Result.succeed(new CompareBrowser(await chromium.launch(), assets));
    } catch (error) {
      return Result.fail(
        new BrowserUnavailable(
          `Playwright could not start Chromium. Install it with \`pnpm --filter @elmeragroup/fuse-figma exec playwright install chromium\`. ${String(error)}`
        )
      );
    }
  }

  /** Stop Chromium. */
  async close(): Promise<void> {
    await this.#browser.close();
  }

  async #serve(route: Route, html: string): Promise<void> {
    const { pathname } = new URL(route.request().url());
    const file = new Map<string, string>([
      [ASSET_PATHS.styles, this.#assets.styles],
      [ASSET_PATHS.themes, this.#assets.themes],
      [ASSET_PATHS.preflight, this.#assets.preflight],
    ]).get(pathname);
    if (pathname === "/preview.html") {
      await route.fulfill({ body: html, contentType: "text/html; charset=utf-8" });
    } else if (pathname === ASSET_PATHS.fonts) {
      await route.fulfill({ body: this.#assets.fontCss, contentType: "text/css; charset=utf-8" });
    } else if (pathname.startsWith(ASSET_PATHS.fontFiles)) {
      await route.fulfill({
        path: join(this.#assets.fontDirectory, pathname.slice(ASSET_PATHS.fontFiles.length)),
      });
    } else if (file === undefined) {
      await route.fulfill({ status: 404, body: `${pathname} is not a comparison asset` });
    } else {
      await route.fulfill({ body: readFileSync(file, "utf8"), contentType: "text/css; charset=utf-8" });
    }
  }

  /**
   * Render one preview's cells.
   *
   * @param theme - The preview's theme.
   * @param requests - The cells.
   * @param layout - The page layout.
   * @returns The crops, boxes and state outcomes by cell id, or `FontNotLoaded`.
   */
  async renderPreview(
    theme: PreviewTheme,
    requests: readonly CellRequest[],
    layout: PageLayout
  ): Promise<Result.Result<RenderedPreview, FontNotLoaded>> {
    const pageCells: PageCell[] = [
      ...requests.map((request) => ({ id: request.id, html: request.html })),
      ...requests.flatMap((request) =>
        request.restingHtml === undefined
          ? []
          : [{ id: `${REFERENCE_PREFIX}${request.id}`, html: request.restingHtml }]
      ),
    ];
    const stamps: ThemeStamps = themeStamps(theme);
    const html = previewDocument(stamps, pageCells, layout);
    const context = await this.#browser.newContext({
      deviceScaleFactor: DEVICE_SCALE,
      viewport: pageViewport(layout, pageCells.length),
      colorScheme: theme.scheme,
    });
    try {
      const page = await context.newPage();
      await page.route(`${PAGE_ORIGIN}/**`, (route) => this.#serve(route, html));
      await page.goto(`${PAGE_ORIGIN}/preview.html`);
      // A browser fetches a face only for text it lays out, and an icon button preview has
      // none, so the page loads the face each button's font names before the check.
      await page.evaluate(async () => {
        const fonts = new Set<string>();
        document.querySelectorAll("[data-compare-cell] > button").forEach((button) => {
          const style = getComputedStyle(button);
          fonts.add(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`);
        });
        await Promise.all([...fonts].map((font) => document.fonts.load(font)));
        await document.fonts.ready;
      });
      const font = await checkFont(page);
      if (Result.isFailure(font)) {
        return Result.fail(font.failure);
      }
      const forcedIds = await forceStates(page, requests);
      const cells = new Map<string, RenderedCell>();
      for (const request of requests) {
        const state: StateOutcome =
          request.forced.length === 0 ? "none" : forcedIds.has(request.id) ? "forced" : "missing";
        cells.set(request.id, await renderCell(page, request, state, layout));
      }
      return Result.succeed({ background: await probeBackground(page), font: font.success, cells });
    } finally {
      await context.close();
    }
  }
}

/** Check that every button's first font family has a loaded face at its weight. */
async function checkFont(page: Page): Promise<Result.Result<string, FontNotLoaded>> {
  const report = await page.evaluate(() => {
    const used = new Set<string>();
    document.querySelectorAll("[data-compare-cell] > button").forEach((button) => {
      const style = getComputedStyle(button);
      used.add(`${style.fontWeight}|${style.fontFamily.split(",")[0] ?? ""}`);
    });
    const loaded: string[] = [];
    document.fonts.forEach((face) => {
      if (face.status === "loaded") {
        loaded.push(`${face.weight}|${face.family}`);
      }
    });
    return { used: [...used], loaded };
  });
  const loaded = new Set(
    report.loaded.map((entry) => {
      const [weight = "", family = ""] = entry.split("|");
      return `${weight}|${unquote(family)}`;
    })
  );
  const fonts: string[] = [];
  for (const entry of report.used) {
    const [weight = "", family = ""] = entry.split("|");
    const key = `${weight}|${unquote(family)}`;
    if (!loaded.has(key)) {
      return Result.fail(
        new FontNotLoaded(
          `The buttons use ${unquote(family)} at weight ${weight}, and the page has no loaded face for it. The comparison loads only @fontsource/roboto, so a theme whose --font-sans starts with another family needs that family added to page-assets.ts.`
        )
      );
    }
    fonts.push(`${weight} ${unquote(family)}`);
  }
  return Result.succeed(fonts.join(", "));
}

/** Force each cell's pseudo classes, and return the ids whose styles the forcing changed. */
async function forceStates(page: Page, requests: readonly CellRequest[]): Promise<ReadonlySet<string>> {
  const forcing = requests.filter((request) => request.forced.length > 0);
  if (forcing.length === 0) {
    return new Set();
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
  for (const request of forcing) {
    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: cellButtonSelector(request.id),
    });
    await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [...request.forced] });
  }
  const changed = new Set<string>();
  for (const request of forcing) {
    if (await stateChanged(page, request.id)) {
      changed.add(request.id);
    }
  }
  return changed;
}

/** Whether a cell's button styles differ from its resting twin's. */
async function stateChanged(page: Page, id: string): Promise<boolean> {
  const [state, rest] = await Promise.all([
    signature(page, cellButtonSelector(id)),
    signature(page, cellButtonSelector(`${REFERENCE_PREFIX}${id}`)),
  ]);
  return state.some((value, index) => value !== rest[index]);
}

function signature(page: Page, selector: string): Promise<StyleSignature> {
  return page.locator(selector).evaluate((element) => {
    const style = getComputedStyle(element);
    return [
      style.backgroundColor,
      style.borderTopColor,
      style.borderRightColor,
      style.borderBottomColor,
      style.borderLeftColor,
      style.color,
      style.boxShadow,
      style.textDecorationLine,
      style.outlineStyle,
      style.opacity,
    ];
  });
}

/**
 * Screenshot one cell. A cell whose forced state did not take, `missing` on entry, is hovered or
 * focused for real first, and let go after its screenshot.
 */
async function renderCell(
  page: Page,
  request: CellRequest,
  forcedState: StateOutcome,
  layout: PageLayout
): Promise<RenderedCell> {
  const button = page.locator(cellButtonSelector(request.id));
  const box = await button.boundingBox();
  if (box === null) {
    throw new Error(`the page did not lay out the button of cell ${request.id}`);
  }
  if (Math.abs(box.x - Math.round(box.x)) > 1 / 64 || Math.abs(box.y - Math.round(box.y)) > 1 / 64) {
    throw new Error(`the page placed cell ${request.id} at ${box.x},${box.y}, off the pixel grid`);
  }
  if (
    box.width + 2 * layout.padding > layout.slotWidth ||
    box.height + 2 * layout.padding > layout.slotHeight
  ) {
    throw new Error(`cell ${request.id} is ${box.width}×${box.height}, larger than its slot`);
  }
  const interact = forcedState === "missing";
  if (interact && request.forced.includes("hover")) {
    await button.hover({ force: true });
  } else if (interact) {
    await button.focus();
  }
  const state: StateOutcome = !interact
    ? forcedState
    : (await stateChanged(page, request.id))
      ? "interaction"
      : "missing";
  const clip = {
    x: Math.round(box.x) - layout.padding,
    y: Math.round(box.y) - layout.padding,
    width: Math.ceil(box.width) + 2 * layout.padding,
    height: Math.ceil(box.height) + 2 * layout.padding,
  };
  const raster = decodePng(
    await page.screenshot({ clip, omitBackground: true, animations: "disabled", caret: "hide" })
  );
  if (interact) {
    await page.mouse.move(0, 0);
    await button.blur();
  }
  return { raster, box: { width: box.width, height: box.height }, state };
}

async function probeBackground(page: Page): Promise<Rgb> {
  const probe = await page.locator(BACKGROUND_PROBE).boundingBox();
  if (probe === null) {
    throw new Error("the page did not lay out its background probe");
  }
  const raster = decodePng(
    await page.screenshot({ clip: { x: probe.x, y: probe.y, width: probe.width, height: probe.height } })
  );
  const pixel = crop(raster, { x: 1, y: 1 }, { width: 1, height: 1 }).data;
  return { r: pixel[0] ?? 0, g: pixel[1] ?? 0, b: pixel[2] ?? 0 };
}
