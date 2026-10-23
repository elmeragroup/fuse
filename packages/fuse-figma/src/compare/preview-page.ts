/**
 * The page that renders one preview's cells. It loads the CSS a docs-like host loads: Tailwind's
 * preflight in the `base` layer, Fuse's standalone `styles.css`, `themes.css` and the brand
 * font, and then, in the `utilities` layer, the classes the host compiles in its own build, such
 * as the lengths a docs demo gives a Separator. Preflight comes first, as in a Tailwind-source host, because its `border: 0 solid` and
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

import type { ComponentDefinition } from "../components/component-spec.ts";
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

/**
 * The layout `figma:compare` uses. A slot holds the widest and the tallest cell, Empty's 512px box,
 * which stands about 213px tall at the comfortable density, with the padding on every side, so a 3px
 * ring around a cell stays inside its own crop and clear of the next slot.
 */
export const PAGE_LAYOUT: PageLayout = { padding: 8, slotWidth: 528, slotHeight: 240, columns: 6, top: 16 };

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
 * @param measured - A selector for an element anywhere inside the slot, such as
 *   `[data-slot="button"]`, or one that starts with a combinator, such as `> span`.
 * @returns The selector from the document root.
 */
export function cellSelector(id: string, measured: string): string {
  return `[data-compare-cell="${id}"] ${measured}`;
}

/**
 * The selector of the element a definition's cells measure: the one whose `data-slot` is the
 * definition's `slot`, or, for a root whose markup carries no `data-slot`, the one its `element`
 * names by tag and attributes, such as `a[data-rac]`, each attribute by its presence or its value,
 * and each of its `prefixes` by the start of its value.
 *
 * @param definition - The root's slot and, for a root without a `data-slot`, its element.
 * @returns A selector for an element anywhere inside a cell's slot, as {@link cellSelector} takes it.
 */
export function measuredSelector(definition: Pick<ComponentDefinition, "slot" | "element">): string {
  const { element } = definition;
  if (element === undefined) {
    return `[data-slot="${definition.slot}"]`;
  }
  const attributes = Object.entries(element.attributes).map(([name, value]) =>
    value === true ? `[${name}]` : `[${name}=${cssString(value)}]`
  );
  const prefixes = Object.entries(element.prefixes ?? {}).map(
    ([name, prefix]) => `[${name}^=${cssString(prefix)}]`
  );
  return `${element.tag}${[...attributes, ...prefixes].join("")}`;
}

/**
 * A value as a quoted CSS string, as CSSOM's "serialize a string" writes it: NUL becomes U+FFFD, a
 * control character from U+0001 to U+001F and U+007F becomes a backslash, its code point in hex and
 * a space, and `"` and `\` take a backslash. A raw newline would end the string and void the
 * selector.
 */
function cssString(value: string): string {
  const escaped = Array.from(value, (character) => {
    const code = character.codePointAt(0) ?? 0;
    if (code === 0) {
      return "�";
    }
    if (code <= 0x1f || code === 0x7f) {
      return `\\${code.toString(16)} `;
    }
    return character === '"' || character === "\\" ? `\\${character}` : character;
  });
  return `"${escaped.join("")}"`;
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
 * @param hostCss - The rules of the classes the host compiles itself, which the page puts in the
 *   `utilities` layer after Fuse's stylesheets.
 * @returns A complete HTML document.
 */
export function previewDocument(
  stamps: ThemeStamps,
  cells: readonly PageCell[],
  layout: PageLayout,
  hostCss: string
): string {
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
@layer utilities {
${hostCss}
}
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
