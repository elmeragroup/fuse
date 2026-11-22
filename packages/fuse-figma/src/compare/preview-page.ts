/**
 * The page that renders one preview's cells. It loads the CSS a docs-like host loads: Tailwind's
 * preflight in the `base` layer, Fuse's standalone `styles.css`, `themes.css` and the brand
 * font, and then, in the `utilities` layer, the classes the host compiles in its own build, such
 * as the lengths a docs demo gives a Separator. Preflight comes first, as in a Tailwind-source host, because its `border: 0 solid` and
 * Fuse's base rule, which gives every border the `border` role, share the `base` layer and the
 * later one wins. The page names the layers first, in the order `styles.css` declares them, so
 * preflight's import does not reorder them. The docs layout sets `font-sans text-foreground` on `<body>`, and the kit's labels
 * inherit both, so the page body does the same. Preflight matters too: without it a native form
 * control keeps the browser's own font. Fuse's themes name no fonts, so the page sets
 * `--font-sans` and `--font-heading` on the themed `<body>` from the kit's own families, as an app
 * sets its fonts (`kit-fonts.ts`).
 *
 * Each cell sits in its own absolutely placed slot at whole CSS pixels, with its element at a
 * fixed padding from the slot's corner, so every crop starts on a device pixel. A slot is a flex
 * row that never shrinks what it holds, a client cell's host inside its `display: contents` mount
 * root included, so a host wider than its slot keeps its width and reaches past the slot, where the
 * run's check finds it, instead of narrowing to the slot. Each slot clips what it paints to the
 * rect it was given, so a shadow or an outline past the slot's edge, which no layout box holds,
 * cannot paint into the next slot. The page stops every animation and transition, so a pending
 * spinner stays at 0°.
 */

import type {
  BoxDefinition,
  Cell,
  ComponentDefinition,
  InstanceDefinition,
  PartDefinition,
} from "../components/component-spec.ts";
import { labelCharacters } from "../components/component-spec.ts";
import type { Viewport } from "../components/css-values.ts";
import { instanceRootSlotOf, partsOf } from "../components/definition-parts.ts";
import { kitFontCss } from "../kit-fonts.ts";
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
export const STYLES_LAYERS = ["properties", "theme", "base", "components", "utilities"] as const;

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
  | {
      readonly _tag: "Client";
      readonly set: string;
      readonly cell: Cell;
      /** The BOOLEAN properties that are on, whose parts the cell renders. */
      readonly turnedOn: readonly string[];
    };

/** A cell's place on the page: its id, what its slot holds, and the elements its box spans. */
export type PageCell = {
  readonly id: string;
  readonly content: CellContent;
  /** Selectors for the measured elements, as {@link cellSelector} takes them. */
  readonly measured: readonly string[];
  /** How many slots the cell spans across, as {@link slotSpan} gives them, 1 where absent. */
  readonly span?: number;
  /**
   * The height the definition gives the cell's root, as the viewport a fixed root sits in, or
   * undefined for none. A cell taller than a slot with its padding takes a row of its own that tall.
   */
  readonly height?: number | undefined;
  /**
   * `measured` where the page hides the static cell's slot and shows only its measured elements, as
   * it shows a client cell's. Undefined shows the whole slot.
   */
  readonly shows?: "measured" | undefined;
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
 * How many slots a cell spans across: one, or as many as its host's width and the padding on both
 * sides need where that is wider than a slot, as the Command list's 576px is.
 *
 * @param layout - The page layout.
 * @param width - The width of the cell's host: its renderer's `hostWidth`, else the width the cell's
 *   definition gives its root, undefined for none.
 * @returns The span, at least 1.
 */
function slotSpan(layout: PageLayout, width: number | undefined): number {
  return Math.max(1, Math.ceil(((width ?? 0) + 2 * layout.padding) / layout.slotWidth));
}

/** What decides the room a cell takes on the page, each undefined for none. */
export type CellHost = {
  /** The width of the host the cell's renderer mounts, its `hostWidth`. */
  readonly hostWidth: number | undefined;
  /** The width the cell's definition gives its root, its preview width. */
  readonly rootWidth: number | undefined;
  /** The viewport the definition's fixed root sits in, which the renderer mounts a host as large as. */
  readonly viewport: Viewport | undefined;
};

/**
 * The room a cell takes on the page, which the compare and the capture both give it: as many slots
 * across as its host needs, and the viewport's height. The host's width is the renderer's
 * `hostWidth` where it names one, else the root's preview width, else the viewport's width.
 *
 * @param layout - The page layout.
 * @param host - The widths and the viewport the cell's host takes.
 * @returns The cell's span, as {@link slotSpan} gives it, and its height, as {@link PageCell} reads it.
 */
export function cellRoom(
  layout: PageLayout,
  { hostWidth, rootWidth, viewport }: CellHost
): Required<Pick<PageCell, "span" | "height">> {
  return { span: slotSpan(layout, hostWidth ?? rootWidth ?? viewport?.width), height: viewport?.height };
}

/**
 * Each cell's slot. A cell of one slot takes the place {@link slotRect} gives it among the other
 * cells of one slot, so a wide or tall cell moves no other cell. Each wide or tall cell takes a row
 * of its own below the grid, as wide as its span and as tall as a slot or its height with the padding
 * on both sides, whichever is more, as the Command dialog's 500px viewport needs 516px.
 *
 * @param layout - The page layout.
 * @param cells - The cells, in page order.
 * @returns The slots, in the cells' order.
 */
export function slotRects(
  layout: PageLayout,
  cells: readonly Pick<PageCell, "span" | "height">[]
): readonly PageRect[] {
  const rowHeight = (height: number | undefined) =>
    Math.max(layout.slotHeight, (height ?? 0) + 2 * layout.padding);
  const own = ({ span = 1, height }: Pick<PageCell, "span" | "height">) =>
    span > 1 || rowHeight(height) > layout.slotHeight;
  const narrow = cells.filter((cell) => !own(cell)).length;
  const rows = Math.max(1, Math.ceil(narrow / layout.columns));
  let placed = 0;
  let below = layout.top + rows * layout.slotHeight;
  return cells.map((cell) => {
    if (!own(cell)) {
      placed += 1;
      return slotRect(layout, placed - 1);
    }
    const rect = {
      x: 0,
      y: below,
      width: (cell.span ?? 1) * layout.slotWidth,
      height: rowHeight(cell.height),
    };
    below += rect.height;
    return rect;
  });
}

/**
 * The viewport that shows every slot of a page, so no crop needs scrolling.
 *
 * @param layout - The page layout.
 * @param cells - The cells, in page order.
 * @returns The viewport size in CSS pixels.
 */
export function pageViewport(
  layout: PageLayout,
  cells: readonly Pick<PageCell, "span" | "height">[]
): PageSize {
  const rects = slotRects(layout, cells);
  return {
    width: Math.max(layout.columns * layout.slotWidth, ...rects.map((rect) => rect.x + rect.width)),
    height: Math.max(layout.top + layout.slotHeight, ...rects.map((rect) => rect.y + rect.height)),
  };
}

/**
 * The tallest viewport a preview page takes, in CSS pixels: eight rows of slots and the top margin.
 * Chromium rasterizes a page's compositor tiles under a memory budget, and a viewport that holds a
 * whole preview, about 100,000px tall, outgrows it: on a 4-vCPU Linux runner a sixth of the crops
 * came back with tiles not yet painted, blank or cut along a tile edge. Pages this tall paint every
 * tile before each screenshot, and each screenshot costs a fifth as much.
 */
export const MAX_PAGE_HEIGHT = 3728;

/**
 * Split a preview's items into pages whose viewport stays within a height, in order. An item goes
 * on the current page while the page's viewport, with the item's cells added, stays within the
 * height; otherwise it starts the next page. An item taller than the height gets a page of its own.
 *
 * @param layout - The page layout.
 * @param items - The items, in page order.
 * @param cellsOf - The cells an item puts on its page, such as a cell and its resting twin.
 * @param maxHeight - The tallest viewport a page may take.
 * @returns The pages, each a run of items in order, together holding every item once.
 */
export function pageBatches<T>(
  layout: PageLayout,
  items: readonly T[],
  cellsOf: (item: T) => readonly Pick<PageCell, "span" | "height">[],
  maxHeight: number
): readonly (readonly T[])[] {
  const batches: T[][] = [];
  let current: T[] = [];
  let cells: Pick<PageCell, "span" | "height">[] = [];
  for (const item of items) {
    const next = [...cells, ...cellsOf(item)];
    if (current.length > 0 && pageViewport(layout, next).height > maxHeight) {
      batches.push(current);
      current = [item];
      cells = [...cellsOf(item)];
    } else {
      current.push(item);
      cells = next;
    }
  }
  if (current.length > 0) {
    batches.push(current);
  }
  return batches;
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
 * it, the box the page crops and compares. Text a renderer draws around that box takes no part, since
 * the comparison never shows it.
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
 * The selector of the element a definition's cell forces hover or focus on: for a focus cell, the
 * part its `focusPart` names inside the measured element, as File upload's trigger; otherwise the part
 * its `statePart` names inside the measured element, as an Accordion item's trigger, the element at
 * its `statePlace`, as Number field's `<input>`, the sibling before the measured element its
 * `statePeer` names, as a Sidebar menu badge's menu button, or the measured element itself.
 *
 * @param definition - The root's slot, and the parts or sibling that take the set's states.
 * @param cell - The cell, whose `state` picks the focus part for a focus cell.
 * @returns A selector for an element anywhere inside a cell's slot, as {@link cellSelector} takes it.
 */
export function forcedSelector(
  definition: Pick<ComponentDefinition, "slot" | "statePart" | "statePlace" | "statePeer" | "focusPart">,
  cell: Cell
): string {
  const measured = measuredSelector(definition);
  if (cell.state === "focus" && definition.focusPart !== undefined) {
    return `${measured} [data-slot="${definition.focusPart}"]`;
  }
  if (definition.statePeer !== undefined) {
    return `[data-slot="${definition.statePeer}"]:has(~ ${measured})`;
  }
  if (definition.statePlace !== undefined) {
    return placeSelector(definition, definition.statePlace);
  }
  return definition.statePart === undefined ? measured : `${measured} [data-slot="${definition.statePart}"]`;
}

/**
 * A part a BOOLEAN property shows: the key of its layer, a selector for its element, how that
 * selector finds it, and the text that element holds, from the part's label, or undefined for a part
 * that holds no text of its own.
 */
export type ShownPart = {
  readonly key: string;
  readonly selector: string;
  /**
   * `"element"` where the selector ends on the part's own `data-slot` or icon, so it matches nothing
   * where the part is absent. `"position"` where it ends on the part's `place`, which a sibling takes
   * where the part is absent.
   */
  readonly foundBy: "element" | "position";
  readonly text: string | undefined;
};

/** A part below a definition's root, with the frame part that holds it and the parts beside it. */
type PlacedPart = {
  readonly part: PartDefinition | InstanceDefinition;
  readonly parent: PartDefinition | undefined;
  readonly siblings: readonly (PartDefinition | InstanceDefinition)[];
};

/** Every part below a box, depth first, each with its parent and siblings. */
function placedParts(box: BoxDefinition, parent: PartDefinition | undefined): readonly PlacedPart[] {
  const siblings = box.parts ?? [];
  return siblings.flatMap((part) => [
    { part, parent, siblings },
    ...("kind" in part ? [] : placedParts(part, part)),
  ]);
}

/**
 * The parts a BOOLEAN property shows in a cell, each with a selector for its element. A part counts
 * only where the cell shows it and every part above it, as `shownIn` and the properties on say. A
 * part goes by the first of these that picks out one element:
 *
 * - its `data-slot`, a frame part's own or an instance part's inner root's, where no other part
 *   carries it;
 * - for a frame part, that slot with an instance it holds whose inner root's `data-slot` no other
 *   part carries, as Breadcrumb's ellipsis item holds the ellipsis;
 * - the slot as a direct child of its parent's element, where no sibling carries it, as Sheet's
 *   corner close sits in `sheet-content-inner` and the footer's Close in the footer;
 * - the slot right after the element of the sibling before it that the cell shows on the same side
 *   of the label, as Breadcrumb's separator after the ellipsis follows the ellipsis item.
 *
 * A frame part without a `data-slot` goes by its `place`. Its expected text is the characters its
 * label shows in the cell where the label is its own text, so the caller can tell a positional selector that
 * lands on the wrong element. An icon of the root is the `<svg>` the root holds, marked by its
 * `data-icon` as the capture finds it.
 *
 * @param definition - The set's root, with its name and the `data-slot` it carries in the cell.
 * @param cell - The cell, which picks the icons the root lists and an instance part's inner cell.
 * @param property - The BOOLEAN property's name.
 * @param on - The BOOLEAN properties on in the instance, which pick the siblings the cell shows.
 * @returns One entry per part, each selector as {@link cellSelector} takes it.
 * @throws When an optional icon sits below the root or inside a wrapper, or a part that the property
 *   shows, or one its selector goes through, has none of the above, which leaves the page no
 *   selector for the part.
 */
export function shownParts(
  definition: BoxDefinition & Pick<ComponentDefinition, "name" | "slot">,
  cell: Cell,
  property: string,
  on: ReadonlySet<string>
): readonly ShownPart[] {
  const measured = measuredSelector(definition);
  const placed = placedParts(definition, undefined);
  const placeOf = new Map(placed.map((entry) => [entry.part, entry]));
  const slotOf = (part: PartDefinition | InstanceDefinition): string | undefined =>
    "kind" in part ? instanceRootSlotOf(part, part.cell(cell)) : part.slot;
  const carriers = (slot: string): number => placed.filter(({ part }) => slotOf(part) === slot).length;
  const shown = (part: PartDefinition | InstanceDefinition): boolean =>
    part.shownIn(cell) && (part.optional === undefined || on.has(part.optional.name));
  const unplaceable = (part: PartDefinition | InstanceDefinition, why: string): Error =>
    new Error(`${definition.name}: the page cannot pick out the ${part.key} part behind ${property}: ${why}`);
  const entryOf = (part: PartDefinition | InstanceDefinition): PlacedPart => {
    const entry = placeOf.get(part);
    if (entry === undefined) {
      throw new Error(`${definition.name}: the ${part.key} part is not below the root`);
    }
    return entry;
  };
  const selectorOf = ({ part, parent, siblings }: PlacedPart): string => {
    const slot = slotOf(part);
    if (slot === undefined) {
      if ("kind" in part || part.place === undefined) {
        throw unplaceable(part, "it carries no data-slot and has no place");
      }
      return placeSelector(definition, part.place);
    }
    const own = `[data-slot=${cssString(slot)}]`;
    if (carriers(slot) === 1) {
      return `${measured} ${own}`;
    }
    const marker =
      "kind" in part
        ? undefined
        : (part.parts ?? [])
            .map((inner) => ("kind" in inner ? slotOf(inner) : undefined))
            .find((inner) => inner !== undefined && carriers(inner) === 1);
    if (marker !== undefined) {
      return `${measured} ${own}:has([data-slot=${cssString(marker)}])`;
    }
    if (siblings.filter((sibling) => slotOf(sibling) === slot).length === 1) {
      return `${parent === undefined ? measured : selectorOf(entryOf(parent))} > ${own}`;
    }
    const before = siblings
      .slice(0, siblings.indexOf(part))
      .filter((sibling) => shown(sibling) && sibling.after === part.after)
      .at(-1);
    if (before === undefined) {
      throw unplaceable(part, `its data-slot ${slot} is shared and no shown sibling precedes it`);
    }
    return `${selectorOf(entryOf(before))} + ${own}`;
  };
  const visible = ({ part, parent }: PlacedPart): boolean =>
    shown(part) && (parent === undefined || visible(entryOf(parent)));
  const parts = placed.flatMap((entry): ShownPart[] => {
    const { part } = entry;
    if (part.optional?.name !== property || !visible(entry)) {
      return [];
    }
    const label = "kind" in part ? undefined : part.label;
    const text =
      label !== undefined && label.shownIn(cell) && label.textAttribute?.(cell) === undefined
        ? labelCharacters(label, cell)
        : undefined;
    const foundBy = "kind" in part || part.slot !== undefined ? "element" : "position";
    return [{ key: part.key, selector: selectorOf(entry), foundBy, text }];
  });
  const icons = definition.iconsFor(cell).flatMap((slot): ShownPart[] => {
    if (slot.optional?.name !== property) {
      return [];
    }
    if (!slot.direct) {
      throw new Error(`${definition.name}: the ${slot.key} icon behind ${property} sits inside a wrapper`);
    }
    const mark =
      slot.dataIcon === undefined ? ":not([data-icon])" : `[data-icon=${cssString(slot.dataIcon)}]`;
    return [{ key: slot.key, selector: `${measured} > svg${mark}`, foundBy: "element", text: undefined }];
  });
  const below = partsOf(definition).some((part) =>
    part.iconsFor(cell).some((slot) => slot.optional?.name === property)
  );
  if (below) {
    throw new Error(`${definition.name}: an icon behind ${property} sits below the root`);
  }
  return [...parts, ...icons];
}

/**
 * The selector of the element at a place: from the measured element where the place starts at the
 * root's own `data-slot`, else from the element inside it that carries that slot, each step down a
 * child by its element ordinal, as `:nth-child()` counts elements.
 */
function placeSelector(definition: Pick<ComponentDefinition, "slot">, place: string): string {
  const [slot = "", ...steps] = place.split("/");
  const measured = measuredSelector(definition);
  const from = slot === definition.slot ? measured : `${measured} [data-slot=${cssString(slot)}]`;
  return [from, ...steps.map((step) => `:nth-child(${String(Number(step) + 1)})`)].join(" > ");
}

/**
 * A definition with the `data-slot` its root carries in a cell: the one its family stamps where the
 * set names one in `elementSlot`, as Pagination's edge carries `pagination-previous`, else its `slot`.
 *
 * @param definition - The definition.
 * @param cell - The cell.
 * @returns The definition with that slot in `slot`.
 */
export function rootInCell<Definition extends Pick<ComponentDefinition, "slot" | "elementSlot">>(
  definition: Definition,
  cell: Cell
): Definition {
  return { ...definition, slot: definition.elementSlot?.(cell) ?? definition.slot };
}

/**
 * The selector of the element a definition's cells measure: the one whose `data-slot` is the
 * definition's `slot`.
 *
 * @param definition - The root's slot.
 * @returns A selector for an element anywhere inside a cell's slot, as {@link cellSelector} takes it.
 */
export function measuredSelector(definition: Pick<ComponentDefinition, "slot">): string {
  return `[data-slot="${definition.slot}"]`;
}

/**
 * The selectors of the elements a cell's box spans: the measured element of {@link measuredSelector},
 * or, for an open composite, the trigger and popup its renderer names by `data-slot`, whose union
 * the page measures.
 *
 * @param definition - The root's slot.
 * @param union - The `data-slot` of each element an open composite's box spans, undefined for a cell
 *   that measures its root.
 * @returns One selector per measured element, as {@link cellSelector} takes it.
 */
export function measuredSelectors(
  definition: Pick<ComponentDefinition, "slot">,
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

function slotHtml(cell: PageCell, { x, y, width, height }: PageRect): string {
  // A wide slot gives its cell the width it spans, which beats the client slot's one-slot width.
  const wide = (cell.span ?? 1) > 1 ? `;width:${String(width)}px;box-sizing:border-box` : "";
  // The slot's own box hugs what it holds, so the clip names the slot's rect in pixels from the
  // box's corner, which `clip` may reach past (CSS 2.1 §11.1.2). It changes no layout and starts
  // no stacking context, where a `clip-path` would and moved the Command palette's edge pixels.
  const clip = `;clip:rect(0px,${String(width)}px,${String(height)}px,0px)`;
  const style = `left:${String(x)}px;top:${String(y)}px${wide}${clip}`;
  switch (cell.content._tag) {
    case "Static":
      return `<div data-compare-cell="${cell.id}" style="${style}">${cell.content.html}</div>`;
    case "Client": {
      const marks = attributes({
        "data-compare-client": cell.content.set,
        "data-compare-props": JSON.stringify(cell.content.cell),
        "data-compare-on": JSON.stringify(cell.content.turnedOn),
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
 * The page's rule that stops every animation and transition, so a pending spinner stays at 0°. It
 * sits in a `<style>` of its own, marked with {@link STILL_ATTRIBUTE}, so the capture's page
 * function can lift it while it reads which animations a consumer's page runs (`stillInEveryMode`
 * in `capture/uncovered.ts`).
 */
export const STILL_RULE = "*,*::before,*::after{animation:none!important;transition:none!important}";

/** The attribute that marks the `<style>` holding {@link STILL_RULE}. */
export const STILL_ATTRIBUTE = "data-still";

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
  // A slot hidden this way keeps its layout, so the measured element lays out among the same
  // neighbors, and `visibility` inherits, so the element's own parts stay shown.
  const isolated = cells.filter((cell) => cell.content._tag === "Static" && cell.shows === "measured");
  const shown = [...clients, ...isolated].flatMap((cell) =>
    cell.measured.map((element) => `${cellSelector(cell.id, element)}{visibility:visible}`)
  );
  const isolatedCss = isolated.map((cell) => `[data-compare-cell="${cell.id}"]{visibility:hidden}`);
  // A popup shrinks to fit the slot that holds its portal (CSS 2.1 §10.3.7), so a client slot takes the
  // whole slot's width, as a page gives a popup room for its widest row.
  const clientCss =
    clients.length === 0
      ? []
      : [
          `${CLIENT_HIDDEN}{visibility:hidden}`,
          `${CLIENT_HIDDEN}{width:${String(layout.slotWidth)}px;box-sizing:border-box}`,
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
html,body{background:transparent!important}
${kitFontCss("body")}
body{margin:0;font-family:var(--font-sans);color:var(--foreground);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
[data-compare-cell]{position:absolute;display:flex;align-items:flex-start;padding:${layout.padding}px}
[data-compare-cell]>*,${CLIENT_HIDDEN}>:first-child>*{flex-shrink:0}
${BACKGROUND_PROBE}{position:absolute;left:0;top:0;width:4px;height:4px;background:var(--background)}
${[...clientCss, ...isolatedCss, ...shown].join("\n")}
</style>
<style ${STILL_ATTRIBUTE}>${STILL_RULE}</style>
</head>
<body${attributes(stamps.body)}>
<div data-compare-probe></div>
${[...slots, ...script].join("\n")}
</body>
</html>
`;
}
