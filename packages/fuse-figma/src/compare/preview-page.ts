/**
 * The page that renders one preview's cells. It loads the CSS a docs-like host loads: Tailwind's
 * preflight in the `base` layer, Fuse's standalone `styles.css`, `themes.css` and the brand
 * font. Preflight comes first, as in a Tailwind-source host, because its `border: 0 solid` and
 * Fuse's base rule, which gives every border the `border` role, share the `base` layer and the
 * later one wins. The page names the layers first, in the order `styles.css` declares them, so
 * preflight's import does not reorder them. The docs layout sets `font-sans text-foreground` on `<body>`, and the kit's labels
 * inherit both, so the page body does the same. Preflight matters too: without it a native form
 * control keeps the browser's own font.
 *
 * Each cell sits in its own absolutely placed slot at whole CSS pixels, with its element at a
 * fixed padding from the slot's corner, so every crop starts on a device pixel. The page stops
 * every animation and transition, so a pending spinner stays at 0°.
 */

import type { ThemeStamps } from "./preview-theme.ts";

/** The origin the browser loads the page and its assets from, served by request interception. */
export const PAGE_ORIGIN = "https://fuse-compare.test";

/** Where the page asks for each asset. */
export const ASSET_PATHS = {
  styles: "/fuse/styles.css",
  themes: "/fuse/themes.css",
  preflight: "/tailwind/preflight.css",
  fonts: "/fonts/fonts.css",
  /** Font files, by file name under this prefix. */
  fontFiles: "/fonts/files/",
} as const;

/** The layers Fuse's built `styles.css` declares, in its order. */
const STYLES_LAYERS = ["properties", "theme", "base", "components", "utilities"] as const;

/** How the page lays out its cells, in CSS pixels. */
export type PageLayout = {
  /** The space around each measured element that the crop keeps, wide enough for a focus ring. */
  readonly padding: number;
  readonly slotWidth: number;
  readonly slotHeight: number;
  readonly columns: number;
  /** The space above the first row, which holds the background probe. */
  readonly top: number;
};

/** The layout `figma:compare` uses. */
export const PAGE_LAYOUT: PageLayout = { padding: 8, slotWidth: 280, slotHeight: 96, columns: 6, top: 16 };

/** A cell's place on the page: its id and its element's HTML. */
export type PageCell = { readonly id: string; readonly html: string };

/** A point in CSS pixels. */
export type PagePoint = { readonly x: number; readonly y: number };

/** A size in CSS pixels. */
export type PageSize = { readonly width: number; readonly height: number };

/**
 * The top-left corner of a cell's slot.
 *
 * @param layout - The page layout.
 * @param index - The cell's position on the page.
 * @returns The slot's corner. The measured element's border box starts `padding` pixels further
 *   in.
 */
function slotOrigin(layout: PageLayout, index: number): PagePoint {
  return {
    x: (index % layout.columns) * layout.slotWidth,
    y: layout.top + Math.floor(index / layout.columns) * layout.slotHeight,
  };
}

/**
 * The viewport that shows every slot, so no crop needs scrolling.
 *
 * @param layout - The page layout.
 * @param count - How many cells the page holds.
 * @returns The viewport size in CSS pixels.
 */
export function pageViewport(layout: PageLayout, count: number): PageSize {
  return {
    width: layout.columns * layout.slotWidth,
    height: layout.top + Math.max(1, Math.ceil(count / layout.columns)) * layout.slotHeight,
  };
}

/**
 * The selector of an element in a cell's slot.
 *
 * @param id - The cell's id.
 * @param measured - A selector relative to the slot that starts with a combinator, such as
 *   `> [data-slot="button"]`.
 * @returns The selector from the document root.
 */
export function cellSelector(id: string, measured: string): string {
  return `[data-compare-cell="${id}"] ${measured}`;
}

/** The selector of the element that paints the theme's `background`. */
export const BACKGROUND_PROBE = "[data-compare-probe]";

function attributes(entries: Readonly<Record<string, string>>): string {
  return Object.entries(entries)
    .map(([name, value]) => ` ${name}="${value.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`)
    .join("");
}

/**
 * The page's HTML.
 *
 * @param stamps - The theme attributes for `<html>` and `<body>`.
 * @param cells - The cells, in page order.
 * @param layout - The page layout.
 * @returns A complete HTML document.
 */
export function previewDocument(stamps: ThemeStamps, cells: readonly PageCell[], layout: PageLayout): string {
  const slots = cells.map((cell, index) => {
    const { x, y } = slotOrigin(layout, index);
    return `<div data-compare-cell="${cell.id}" style="left:${x}px;top:${y}px">${cell.html}</div>`;
  });
  return `<!doctype html>
<html lang="en"${attributes(stamps.root)}>
<head>
<meta charset="utf-8">
<style>
@layer ${STYLES_LAYERS.join(", ")};
@import url("${ASSET_PATHS.preflight}") layer(base);
@import url("${ASSET_PATHS.styles}");
@import url("${ASSET_PATHS.themes}");
@import url("${ASSET_PATHS.fonts}");
*,*::before,*::after{animation:none!important;transition:none!important}
html,body{background:transparent!important}
body{margin:0;font-family:var(--font-sans);color:var(--foreground);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
[data-compare-cell]{position:absolute;display:flex;align-items:flex-start;padding:${layout.padding}px}
${BACKGROUND_PROBE}{position:absolute;left:0;top:0;width:4px;height:4px;background:var(--background)}
</style>
</head>
<body${attributes(stamps.body)}>
<div data-compare-probe></div>
${slots.join("\n")}
</body>
</html>
`;
}
