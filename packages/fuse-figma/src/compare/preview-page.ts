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

import type { Cell, ComponentDefinition } from "../components/component-spec.ts";
import type { ThemeStamps } from "./preview-theme.ts";

/** The origin the browser loads the page and its assets from, served by request interception. */
export const PAGE_ORIGIN = "https://fuse-compare.test";

/** Where the page asks for each asset. */
export const ASSET_PATHS = {
  styles: "/fuse/styles.css",
  themes: "/fuse/themes.css",
  preflight: "/tailwind/preflight.css",
  fonts: "/fonts/fonts.css",
  /** The bundle that mounts the client cells, as `client-bundle.ts` builds it. */
  client: "/compare/client.js",
  /** Font files, by file name under this prefix. */
  fontFiles: "/fonts/files/",
} as const;

/**
 * The attribute the client bundle sets on `<html>` once it has mounted the client cells, which the
 * page waits for before it measures: {@link MOUNTED_DONE}, or the reason the mount failed.
 */
export const MOUNTED = "data-compare-mounted";

/** {@link MOUNTED}'s value once every client cell is mounted and its popup placed. */
export const MOUNTED_DONE = "done";

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
 * The layout `figma:compare` uses. A slot holds the widest cell of one slot, Empty's 512px box, and the tallest
 * cell, the Sidebar panel's 448px, with the padding on every side, so a 3px ring
 * around a cell stays inside its own crop and nothing a cell renders reaches the next slot. A wider cell,
 * the Command list's 576px, spans slots, as {@link slotRects} places it.
 */
export const PAGE_LAYOUT: PageLayout = { padding: 8, slotWidth: 528, slotHeight: 464, columns: 6, top: 16 };

/**
 * What a cell's slot holds: the static markup of its element, or the set and cell the page's client
 * bundle mounts there, as an overlay renders only once a page runs it.
 */
export type CellContent =
  | { readonly _tag: "Static"; readonly html: string }
  | { readonly _tag: "Client"; readonly set: string; readonly cell: Cell };

/** A cell's place on the page: its id, what its slot holds, and the elements its box spans. */
export type PageCell = {
  readonly id: string;
  readonly content: CellContent;
  /** Selectors for the measured elements, as {@link cellSelector} takes them. */
  readonly measured: readonly string[];
  /** How many slots the cell spans across, as {@link slotSpan} gives them, 1 where absent. */
  readonly span?: number;
};

/** A point in CSS pixels. */
export type PagePoint = { readonly x: number; readonly y: number };

/** A size in CSS pixels. */
export type PageSize = { readonly width: number; readonly height: number };

/** A rectangle in CSS pixels. */
export type PageRect = PagePoint & PageSize;

/**
 * A cell's slot: the part of the page its element and its crop stay inside.
 *
 * @param layout - The page layout.
 * @param index - The cell's position on the page.
 * @returns The slot's rectangle. The element's border box starts `padding` pixels in from its
 *   corner.
 */
export function slotRect(layout: PageLayout, index: number): PageRect {
  return {
    x: (index % layout.columns) * layout.slotWidth,
    y: layout.top + Math.floor(index / layout.columns) * layout.slotHeight,
    width: layout.slotWidth,
    height: layout.slotHeight,
  };
}

/**
 * How many slots a cell spans across: one, or as many as its root's width and the padding on both
 * sides need where that is wider than a slot, as the Command list's 576px is.
 *
 * @param layout - The page layout.
 * @param width - The width the cell's definition gives its root, undefined for none.
 * @returns The span, at least 1.
 */
export function slotSpan(layout: PageLayout, width: number | undefined): number {
  return Math.max(1, Math.ceil(((width ?? 0) + 2 * layout.padding) / layout.slotWidth));
}

/**
 * Each cell's slot. A cell of one slot takes the place {@link slotRect} gives it among the other
 * cells of one slot, so a wide cell moves no other cell. Each wide cell takes a row of its own below
 * the grid, as wide as its span.
 *
 * @param layout - The page layout.
 * @param cells - The cells, in page order.
 * @returns The slots, in the cells' order.
 */
export function slotRects(layout: PageLayout, cells: readonly Pick<PageCell, "span">[]): readonly PageRect[] {
  const narrow = cells.filter(({ span }) => (span ?? 1) === 1).length;
  const rows = Math.max(1, Math.ceil(narrow / layout.columns));
  let placed = 0;
  let wide = 0;
  return cells.map(({ span = 1 }) => {
    if (span === 1) {
      placed += 1;
      return slotRect(layout, placed - 1);
    }
    wide += 1;
    return {
      x: 0,
      y: layout.top + (rows + wide - 1) * layout.slotHeight,
      width: span * layout.slotWidth,
      height: layout.slotHeight,
    };
  });
}

/**
 * The viewport that shows every slot, so no crop needs scrolling.
 *
 * @param layout - The page layout.
 * @param cells - The cells, in page order.
 * @returns The viewport size in CSS pixels.
 */
export function pageViewport(layout: PageLayout, cells: readonly Pick<PageCell, "span">[]): PageSize {
  const rects = slotRects(layout, cells);
  return {
    width: Math.max(layout.columns * layout.slotWidth, ...rects.map((rect) => rect.x + rect.width)),
    height: Math.max(layout.top + layout.slotHeight, ...rects.map((rect) => rect.y + rect.height)),
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
 * The elements whose text the font check reads: each cell's measured element and every element in
 * it, the box the page crops and compares. Text a renderer draws around that box takes no part, as
 * the month heading of the Calendar a day cell sits in, which takes the theme's heading font, Neo
 * Sans in Fjordkraft's external themes, and which the comparison never shows.
 *
 * @param requests - The cells, by id and measured element.
 * @returns A selector list from the document root, empty for no cells.
 */
export function fontSweepSelector(
  requests: readonly { readonly id: string; readonly measured: readonly string[] }[]
): string {
  return requests
    .flatMap(({ id, measured }) =>
      measured.flatMap((element) => {
        const root = cellSelector(id, element);
        return [root, `${root} *`];
      })
    )
    .join(", ");
}

/**
 * The selector of the element a definition's cells force hover and focus on: the part its
 * `statePart` names inside the measured element, as an Accordion item's trigger, the sibling before
 * the measured element its `statePeer` names, as a Sidebar menu badge's menu button, or the measured
 * element itself.
 *
 * @param definition - The root's slot and element, and the part or sibling that takes the set's
 *   states.
 * @returns A selector for an element anywhere inside a cell's slot, as {@link cellSelector} takes it.
 */
export function forcedSelector(
  definition: Pick<ComponentDefinition, "slot" | "element" | "statePart" | "statePeer">
): string {
  const measured = measuredSelector(definition);
  if (definition.statePeer !== undefined) {
    return `[data-slot="${definition.statePeer}"]:has(~ ${measured})`;
  }
  return definition.statePart === undefined ? measured : `${measured} [data-slot="${definition.statePart}"]`;
}

/**
 * The selector of the element a definition's cells measure: the one whose `data-slot` is the
 * definition's `slot`, or, for a root whose markup carries no `data-slot`, the one its `element`
 * names by tag and attributes, such as `*[data-rac]`, each attribute by its presence or its value,
 * each of its `prefixes` by the start of its value and each of its `suffixes` by its end.
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
  const suffixes = Object.entries(element.suffixes ?? {}).map(
    ([name, suffix]) => `[${name}$=${cssString(suffix)}]`
  );
  return `${element.tag}${[...attributes, ...prefixes, ...suffixes].join("")}`;
}

/**
 * The selectors of the elements a cell's box spans: the measured element of {@link measuredSelector},
 * or, for an open composite, the trigger and popup its renderer names by `data-slot`, whose union
 * the page measures.
 *
 * @param definition - The root's slot and, for a root without a `data-slot`, its element.
 * @param union - The `data-slot` of each element an open composite's box spans, undefined for a cell
 *   that measures its root.
 * @returns One selector per measured element, as {@link cellSelector} takes it.
 */
export function measuredSelectors(
  definition: Pick<ComponentDefinition, "slot" | "element">,
  union: readonly string[] | undefined
): readonly string[] {
  return union === undefined
    ? [measuredSelector(definition)]
    : union.map((slot) => `[data-slot=${cssString(slot)}]`);
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

/**
 * The selector of every client cell's slot. The page hides each one and shows only its measured
 * elements, so a popup part's crop shows none of the trigger it anchors to.
 */
export const CLIENT_HIDDEN = "[data-compare-client]";

function slotHtml(cell: PageCell, { x, y, width }: PageRect): string {
  // A wide slot gives its cell the width it spans, which beats the client slot's one-slot width.
  const wide = (cell.span ?? 1) > 1 ? `;width:${String(width)}px;box-sizing:border-box` : "";
  const style = `left:${String(x)}px;top:${String(y)}px${wide}`;
  switch (cell.content._tag) {
    case "Static":
      return `<div data-compare-cell="${cell.id}" style="${style}">${cell.content.html}</div>`;
    case "Client": {
      const marks = attributes({
        "data-compare-client": cell.content.set,
        "data-compare-props": JSON.stringify(cell.content.cell),
      });
      return `<div data-compare-cell="${cell.id}"${marks} style="${style}"></div>`;
    }
  }
}

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
  const rects = slotRects(layout, cells);
  const slots = cells.map((cell, index) => slotHtml(cell, rects[index] ?? slotRect(layout, index)));
  const clients = cells.filter((cell) => cell.content._tag === "Client");
  const shown = clients.flatMap((cell) =>
    cell.measured.map((element) => `${cellSelector(cell.id, element)}{visibility:visible}`)
  );
  // A popup shrinks to fit the slot that holds its portal (CSS 2.1 §10.3.7), so a client slot takes the
  // whole slot's width, as a page gives a popup room for its widest row.
  const clientCss =
    clients.length === 0
      ? []
      : [
          `${CLIENT_HIDDEN}{visibility:hidden}`,
          `${CLIENT_HIDDEN}{width:${String(layout.slotWidth)}px;box-sizing:border-box}`,
          ...shown,
        ];
  const script = clients.length === 0 ? [] : [`<script type="module" src="${ASSET_PATHS.client}"></script>`];
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
${clientCss.join("\n")}
</style>
</head>
<body${attributes(stamps.body)}>
<div data-compare-probe></div>
${[...slots, ...script].join("\n")}
</body>
</html>
`;
}
