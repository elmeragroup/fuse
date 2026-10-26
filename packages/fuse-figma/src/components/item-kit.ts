/**
 * Item, the row of media, content and actions, as two component sets on the Item page: the row as a
 * `<div>`, 36 cells, and the row as a link, 8 cells.
 *
 * - `Item` crosses the recipe's three variants and three sizes with `described` and the media kind.
 *   `described=on` adds the description, which `item-described:` reads: the media and the content
 *   then top-align, and icon media is one title line tall, `text-sm` at `leading-snug`, a literal
 *   19.25px, since no theme sets either value. The media kind is `icon`, the docs Lightning at
 *   16px, or `image`, the docs portrait framed in a rounded square that `group-data-[size]/item`
 *   sizes with the row. The recipe's `default` media holds whatever a consumer puts in it, as
 *   Empty's default media holds an illustration, so the set leaves it out.
 * - The media and the actions hide behind the `Media` and `Actions` BOOLEAN properties, since a
 *   docs demo leaves either out and no class reads whether they are there. The description's
 *   presence is the `described` axis instead.
 * - The title is the docs Basic demo's `Spot` at 14/19.25 Medium, and the description its
 *   `Hourly price with no lock-in.` at 14/21 in `muted-foreground`, two lines at most, or 12/18 in
 *   an `xs` row. The actions hold the demo's plain text `Active`. A text property sets each.
 * - Beside a description, `item-described:self-start` tops the media and the content, so the row
 *   aligns its layers at the start, and the actions, which paint nothing and center their text,
 *   fill the row's height there, so their text sits where CSS centers the actions on the row (PF).
 * - `Item link` is the row rendered as an `<a>`, as the docs As a link demo renders it, where the
 *   recipe's `[a]:` arms hold: the default and outline variants in four states at the default
 *   size, with icon media and a title. Hover fills it `muted`, focus draws the 2px ring, and an
 *   `aria-disabled="true"` link dims to 50%, as the docs mark an unavailable link row.
 * - The header and the footer wait for kit components that hold instances, since the docs fill
 *   them with other components. A row in a DropdownMenu or an `Item.Group` is not drawn either.
 */
import {
  ITEM_TITLE_CLASSES,
  itemActionsClass,
  itemContentClass,
  itemDescriptionClass,
  itemMediaVariants,
  itemVariants,
} from "@elmeragroup/fuse/recipe-catalog";

import { swapProperties } from "./component-spec";
import type { Cell, ComponentDefinition, IconSlot, PartDefinition } from "./component-spec";
import { ownKey } from "./own-key";
import { always } from "./popup-facts";
import { portraitPng } from "./portrait";

/** The width the kit's previews and the compare host give an Item row, which fills it. */
export const ITEM_PREVIEW_WIDTH = 384;

/** The title's text, the default of its `Title` property: the docs Basic demo's title. */
export const ITEM_TITLE_TEXT = "Spot";

/** The link row's title, the default of its `Title` property: the docs As a link demo's first row. */
export const ITEM_LINK_TITLE_TEXT = "Open order";

/** The description's text, the default of its `Description` property: the docs Basic demo's. */
export const ITEM_DESCRIPTION_TEXT = "Hourly price with no lock-in.";

/** The actions' text, the default of its `Actions text` property: the docs Basic demo's. */
export const ITEM_ACTIONS_TEXT = "Active";

type ItemVariant = keyof typeof itemVariants.variants.variant;
type ItemSize = keyof typeof itemVariants.variants.size;
type MediaKind = keyof typeof itemMediaVariants.variants.variant;

function isVariant(value: string | undefined): value is ItemVariant {
  return ownKey(itemVariants.variants.variant, value);
}

function isSize(value: string | undefined): value is ItemSize {
  return ownKey(itemVariants.variants.size, value);
}

function isMediaKind(value: string | undefined): value is MediaKind {
  return ownKey(itemMediaVariants.variants.variant, value);
}

/** The variants in the recipe's order, its default first. */
const VARIANTS = Object.keys(itemVariants.variants.variant).filter(isVariant);

/** The sizes in the recipe's order, its default first. */
const SIZES = Object.keys(itemVariants.variants.size).filter(isSize);

/** The media kinds the set draws: the recipe's, but the `default` box a consumer fills. */
const MEDIA_KINDS = ["icon", "image"] as const satisfies readonly MediaKind[];

/** What a cell renders: the row's variant and size, whether it holds a description, and its media. */
export type ItemLook = {
  readonly variant: ItemVariant;
  readonly size: ItemSize;
  readonly described: boolean;
  readonly media: MediaKind;
};

/**
 * What an `item` cell renders.
 *
 * @param cell - An `item` cell.
 * @returns Its look.
 * @throws When the cell names a variant, size or media kind the recipes do not declare, a defect
 *   in the caller's cell.
 */
export function itemLook(cell: Cell): ItemLook {
  const { variant, size, media } = cell;
  if (!isVariant(variant) || !isSize(size) || !isMediaKind(media)) {
    throw new Error(`Item has no variant ${variant ?? ""}, size ${size ?? ""} or media ${media ?? ""}`);
  }
  return { variant, size, described: cell.described === "on", media };
}

/**
 * What an `item-link` cell renders: its variant at the default size, with icon media and no
 * description.
 *
 * @param cell - An `item-link` cell.
 * @returns Its look.
 * @throws When the cell names a variant the recipe does not declare, a defect in the caller's cell.
 */
export function itemLinkLook(cell: Cell): ItemLook {
  const { variant } = cell;
  if (!isVariant(variant)) {
    throw new Error(`Item link has no variant ${variant ?? ""}`);
  }
  return { variant, size: "default", described: false, media: "icon" };
}

/** The docs demos' Lightning in icon media, which the `Icon` swap property picks. */
const LIGHTNING: IconSlot = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "Lightning",
  swapProperty: "Icon",
};

/** The title, in the text a set gives it, which its `Title` property sets. */
function title(characters: string): PartDefinition {
  return {
    key: "title",
    slot: "item-title",
    shownIn: always,
    classesFor: () => ITEM_TITLE_CLASSES,
    label: { key: "text", name: "text", characters, textProperty: "Title", shownIn: always },
    iconsFor: () => [],
  };
}

/** The description, in the `item` cells that hold one. */
const DESCRIPTION: PartDefinition = {
  key: "description",
  slot: "item-description",
  shownIn: (cell) => itemLook(cell).described,
  classesFor: () => itemDescriptionClass,
  label: {
    key: "text",
    name: "text",
    characters: ITEM_DESCRIPTION_TEXT,
    textProperty: "Description",
    shownIn: always,
  },
  iconsFor: () => [],
};

/**
 * The media and the content column of a row, the row's classes, and the variants that read the row
 * around a part, by how a set reads its cells.
 *
 * @param look - What a cell of the set renders.
 * @param texts - The parts the content column holds.
 */
function row(look: (cell: Cell) => ItemLook, texts: readonly PartDefinition[]) {
  const holdsImage = (cell: Cell): boolean => look(cell).media === "image";

  /** The docs portrait in image media, an `<img>` with no class of its own, which the media sizes. */
  const image: PartDefinition = {
    key: "image",
    slot: undefined,
    element: { tag: "img", attributes: {} },
    shownIn: holdsImage,
    classesFor: () => "",
    label: undefined,
    iconsFor: () => [],
    image: portraitPng,
  };

  /** The media, behind the `Media` BOOLEAN property. */
  const media: PartDefinition = {
    key: "media",
    slot: "item-media",
    shownIn: always,
    optional: { name: "Media", defaultValue: true },
    classesFor: (cell) => itemMediaVariants({ variant: look(cell).media }),
    label: undefined,
    iconsFor: (cell) => (holdsImage(cell) ? [] : [LIGHTNING]),
    parts: [image],
  };

  const content: PartDefinition = {
    key: "content",
    slot: "item-content",
    shownIn: always,
    classesFor: () => itemContentClass,
    label: undefined,
    iconsFor: () => [],
    parts: texts,
  };

  /** The variants that read the row around a part: its size and whether it holds a description. */
  const facts = new Map<string, (cell: Cell) => boolean>([
    ...SIZES.map(
      (size) => [`group-data-[size=${size}]/item`, (cell: Cell) => look(cell).size === size] as const
    ),
    ["item-described", (cell: Cell) => look(cell).described],
  ]);

  return {
    classesFor: (cell: Cell) => itemVariants({ variant: look(cell).variant, size: look(cell).size }),
    facts,
    media,
    content,
  };
}

/** The actions, the demo's plain text in a `<span>`, behind the `Actions` BOOLEAN property. */
const ACTIONS: PartDefinition = {
  key: "actions",
  slot: "item-actions",
  shownIn: always,
  optional: { name: "Actions", defaultValue: true },
  classesFor: () => itemActionsClass,
  label: {
    key: "text",
    name: "text",
    characters: ITEM_ACTIONS_TEXT,
    textProperty: "Actions text",
    textElement: { tag: "span", attributes: {} },
    shownIn: always,
  },
  iconsFor: () => [],
};

/** The compositions neither set draws, each with the reason a designer reads. */
const OMITTED_COMPOSITIONS: ReadonlyMap<string, string> = new Map([
  [
    "in-data-[slot=dropdown-menu-content]",
    "an extra-small row inside a DropdownMenu, which the set does not draw",
  ],
  ["[&+[data-slot=item-content]]", "a second Item.Content after this one, which the set does not draw"],
]);

const ITEM_ROW = row(itemLook, [title(ITEM_TITLE_TEXT), DESCRIPTION]);

/**
 * An Item row as a `<div>`, as `<Item.Root variant size>` around its media, content and actions in
 * a 384px container.
 */
export const ITEM: ComponentDefinition = {
  key: "item",
  name: "Item",
  slot: "item",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "size", values: SIZES },
    { name: "described", values: ["off", "on"] },
    { name: "media", values: MEDIA_KINDS },
  ],
  columnAxis: "size",
  previewWidth: ITEM_PREVIEW_WIDTH,
  classesFor: ITEM_ROW.classesFor,
  states: {},
  facts: ITEM_ROW.facts,
  // A `<div>` row takes no focus, hover or disabled state; the link set draws them.
  omittedStates: new Set(["focus-visible", "disabled", "aria-disabled"]),
  omittedCompositions: new Map([
    ...OMITTED_COMPOSITIONS,
    ["[a]", "the row as a link, which the Item link set draws"],
  ]),
  label: undefined,
  iconsFor: () => [],
  parts: [ITEM_ROW.media, ITEM_ROW.content, ACTIONS],
  swapProperties: swapProperties([LIGHTNING]),
};

const LINK_ROW = row(itemLinkLook, [title(ITEM_LINK_TITLE_TEXT)]);

/**
 * An Item row as a link, as `<Item.Root variant render={<a href="#order" />}>` around icon media and
 * a title in a 384px container, `aria-disabled="true"` where the cell is disabled.
 */
export const ITEM_LINK: ComponentDefinition = {
  key: "item-link",
  name: "Item link",
  slot: "item",
  // An `<a>` takes no `disabled`, so the docs mark an unavailable link row `aria-disabled="true"`,
  // which only its author stamps.
  rootKind: "plain-element",
  axes: [
    { name: "variant", values: ["default", "outline"] },
    { name: "state", values: ["rest", "hover", "focus", "disabled"] },
  ],
  columnAxis: "state",
  previewWidth: ITEM_PREVIEW_WIDTH,
  classesFor: LINK_ROW.classesFor,
  states: { disabled: ["aria-disabled"] },
  facts: new Map([...LINK_ROW.facts, ["[a]", always]]),
  // An `<a>` never matches `:disabled`, which a `render={<button disabled />}` row reads.
  omittedStates: new Set(["disabled"]),
  omittedCompositions: OMITTED_COMPOSITIONS,
  label: undefined,
  iconsFor: () => [],
  parts: [LINK_ROW.media, LINK_ROW.content],
  swapProperties: swapProperties([LIGHTNING]),
};
