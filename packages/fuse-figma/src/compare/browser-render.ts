/// <reference lib="dom" />
/**
 * The browser side of the comparison: Playwright's Chromium renders a preview's cells on one page
 * at device scale 2 and crops each cell with a transparent background.
 *
 * Hover and focus come from Chrome DevTools Protocol `CSS.forcePseudoState`, so every cell of a
 * page shows its state at once and no pointer or focus moves between screenshots. The page forces
 * them on the measured element, on the part inside it that takes the set's states, as an Accordion
 * item's trigger, or on the sibling before it whose state it follows, as a Sidebar menu badge's menu
 * button. Fuse gates hover behind `@media (hover: hover)` and `:not(<disabled>)`, so the page checks
 * each forced cell against its resting twin: a forced cell whose measured element and descendants
 * have the twin's colors, shadows and underlines did not reach Fuse's `enabled-hover:` or
 * `focus-visible:` rules, and the page then hovers or focuses the forced element for real before its
 * screenshot, unless the request says the kit draws the cell as at rest in the preview's theme. React Aria draws its hover and focus faces from pointer and focus
 * events only a hydrated page sees, so with the pseudo classes the page writes the attributes the
 * cell's renderer names on the forced element, through CDP's `DOM.setAttributeValue`, as the
 * Calendar day's `data-hovered` and its focused class.
 */

import { Result } from "effect";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import type { Browser, Page, Route } from "playwright";

import type { ForcedPseudoClass } from "./cells.ts";
import type { PageAssets } from "./page-assets.ts";
import {
  ASSET_PATHS,
  BACKGROUND_PROBE,
  cellSelector,
  fontSweepSelector,
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

/** A cell to render: its element's HTML, the state to force, and its resting twin's HTML. */
export type CellRequest = {
  readonly id: string;
  readonly html: string;
  /**
   * The element the page compares and crops, as a selector for an element inside the cell's slot,
   * as `cellSelector` reads it. The resting twin's slot uses the same one.
   */
  readonly measured: string;
  /**
   * The element the page forces the cell's state on: the measured element, or the part inside it
   * that takes the set's states, as an Accordion item's trigger.
   */
  readonly forcedOn: string;
  readonly forced: readonly ForcedPseudoClass[];
  /**
   * The attributes the page writes on the forced element with the forced pseudo classes, as React
   * Aria would while the state holds. Empty for a cell whose state CSS draws from the pseudo classes
   * alone.
   */
  readonly forcedAttributes: Readonly<Record<string, string>>;
  /** The same element at rest, rendered off to the side to check the forced state. */
  readonly restingHtml: string | undefined;
  /**
   * Whether the kit draws the cell's forced state as it draws the cell at rest in the preview's
   * theme, as `unchangedByDesign` decides before the page renders. A forced state that changes
   * nothing is then what the cell should show, so the page hovers or focuses nothing for real.
   */
  readonly restsByDesign: boolean;
};

/**
 * How the page reached a cell's state.
 *
 * - `none`: the cell forces nothing.
 * - `forced`: forcing the pseudo classes changed the element's styles.
 * - `interaction`: forcing changed nothing, and a real hover or focus did.
 * - `missing`: neither changed anything, so the screenshot shows the resting element.
 */
export type StateOutcome = "none" | "forced" | "interaction" | "missing";

/** One rendered cell. */
export type RenderedCell = {
  /** The crop: the border box plus the layout's padding on every side, transparent outside. */
  readonly raster: Raster;
  /** The measured element's border box in CSS pixels. */
  readonly box: BoxSize;
  readonly state: StateOutcome;
};

/** One rendered preview. */
export type RenderedPreview = {
  /** The theme's `background`, which the comparison lays both pictures over. */
  readonly background: Rgb;
  /**
   * The fonts the cells' text uses, as `<weight> <family>`, after the page checked they loaded.
   * Empty when the page shows no text.
   */
  readonly font: string;
  readonly cells: ReadonlyMap<string, RenderedCell>;
};

/** Chromium could not start. */
export class BrowserUnavailable extends Error {
  readonly _tag = "BrowserUnavailable" as const;
}

/** The page did not load a font its text uses, so the text would come from a fallback. */
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
    const html = previewDocument(stamps, pageCells, layout, this.#assets.hostCss);
    const context = await this.#browser.newContext({
      deviceScaleFactor: DEVICE_SCALE,
      viewport: pageViewport(layout, pageCells.length),
      colorScheme: theme.scheme,
    });
    try {
      const page = await context.newPage();
      await page.route(`${PAGE_ORIGIN}/**`, (route) => this.#serve(route, html));
      await page.goto(`${PAGE_ORIGIN}/preview.html`);
      const font = await checkFont(page, fontSweepSelector(requests));
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

/**
 * Load the face of every element in the cells' measured elements that holds text, and check that
 * each one's first font family has a loaded face at its weight. The sweep covers every element with
 * a non-blank text node of its own, whatever the component, so a label in a child span counts too,
 * and every `<input>` or `<textarea>` that draws a value or a placeholder, which no text node holds.
 *
 * @param selector - The elements to sweep, as {@link fontSweepSelector} names them.
 */
async function checkFont(page: Page, selector: string): Promise<Result.Result<string, FontNotLoaded>> {
  const report = await page.evaluate(async (sweep) => {
    const swept = sweep === "" ? [] : [...document.querySelectorAll(sweep)];
    const styles = swept
      .filter(
        (element) =>
          [...element.childNodes].some(
            (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== ""
          ) ||
          ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) &&
            (element.value || element.placeholder).trim() !== "")
      )
      .map((element) => getComputedStyle(element));
    const fonts = new Set(styles.map((style) => `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`));
    await Promise.all([...fonts].map((font) => document.fonts.load(font)));
    await document.fonts.ready;
    const used = new Set(
      styles.map((style) => `${style.fontWeight}|${style.fontFamily.split(",")[0] ?? ""}`)
    );
    const loaded: string[] = [];
    document.fonts.forEach((face) => {
      if (face.status === "loaded") {
        loaded.push(`${face.weight}|${face.family}`);
      }
    });
    return { used: [...used], loaded };
  }, selector);
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
          `The cells' text uses ${unquote(family)} at weight ${weight}, and the page has no loaded face for it. The comparison loads only @fontsource/roboto, so a theme whose --font-sans starts with another family needs that family added to page-assets.ts.`
        )
      );
    }
    fonts.push(`${weight} ${unquote(family)}`);
  }
  return Result.succeed(fonts.join(", "));
}

/**
 * Force each cell's pseudo classes and write its forced attributes on its forced element, and
 * return the ids whose styles that changed.
 */
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
      selector: cellSelector(request.id, request.forcedOn),
    });
    await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [...request.forced] });
    for (const [name, value] of Object.entries(request.forcedAttributes)) {
      await cdp.send("DOM.setAttributeValue", { nodeId, name, value });
    }
  }
  const changed = new Set<string>();
  for (const request of forcing) {
    if (await stateChanged(page, request)) {
      changed.add(request.id);
    }
  }
  return changed;
}

/** Whether a cell's measured element, or any element inside it, differs from its resting twin's. */
async function stateChanged(page: Page, request: CellRequest): Promise<boolean> {
  const [state, rest] = await Promise.all([
    signature(page, cellSelector(request.id, request.measured)),
    signature(page, cellSelector(`${REFERENCE_PREFIX}${request.id}`, request.measured)),
  ]);
  return state.length !== rest.length || state.some((value, index) => value !== rest[index]);
}

/**
 * The styles of an element and its descendants, so a state that repaints only a child, such as
 * a switch's thumb, still counts as reached.
 */
function signature(page: Page, selector: string): Promise<StyleSignature> {
  return page.locator(selector).evaluate((element) =>
    [element, ...element.querySelectorAll("*")].flatMap((part) => {
      const style = getComputedStyle(part);
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
    })
  );
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
  const measured = page.locator(cellSelector(request.id, request.measured));
  const box = await measured.boundingBox();
  if (box === null) {
    throw new Error(`the page did not lay out the measured element of cell ${request.id}`);
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
  const interact = forcedState === "missing" && !request.restsByDesign;
  const forcedOn = page.locator(cellSelector(request.id, request.forcedOn));
  if (interact && request.forced.includes("hover")) {
    await forcedOn.hover({ force: true });
  } else if (interact) {
    await forcedOn.focus();
  }
  const state: StateOutcome = !interact
    ? forcedState
    : (await stateChanged(page, request))
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
    await forcedOn.blur();
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
