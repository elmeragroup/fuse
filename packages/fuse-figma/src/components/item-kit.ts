/**
 * Item, the row of media, content and actions, as two component sets on the Item page: the row as a
 * `<div>`, 36 cells, and the row as a link, 8 cells.
 *
 * - `Item` crosses the recipe's three variants and three sizes with `described` and the media kind.
 *   `described=on` adds the description. The media kind is `icon`, the docs Lightning, or `image`,
 *   the docs portrait. The recipe's `default` media holds whatever a consumer puts in it, as Empty's
 *   default media holds an illustration, so the set leaves it out.
 * - The media and the actions hide behind the `Media` and `Actions` BOOLEAN properties, since a
 *   docs demo leaves either out and no class reads whether they are there. The description's
 *   presence is the `described` axis instead.
 * - The title is the docs Basic demo's `Spot`, and the description its `Hourly price with no
 *   lock-in.`. The actions hold the demo's plain text `Active`. A text property sets each.
 * - `Item link` is the row rendered as an `<a>`, as the docs As a link demo renders it: the default
 *   and outline variants in four states at the default size, with icon media and a title. A
 *   disabled cell is an `aria-disabled="true"` link, as the docs mark an unavailable link row.
 * - The header and the footer wait for kit components that hold instances, since the docs fill
 *   them with other components. A row in a DropdownMenu or an `Item.Group` is not drawn either.
 */
import { itemMediaVariants, itemVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { IconManifest, PartManifest, SetManifest } from "../capture/manifest";
import { swapProperties } from "./component-spec";
import type { Cell } from "./component-spec";
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
const LIGHTNING: IconManifest = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "Lightning",
  swapProperty: "Icon",
};

/** The BOOLEAN property that hides the media. */
const MEDIA_PROPERTY = { name: "Media", defaultValue: true };

/**
 * The media and the content column of a row, for a set's look and texts. The media sits behind the
 * `Media` BOOLEAN property, and image media holds the docs portrait, an `<img>` at its first place.
 */
function rowManifest(
  look: (cell: Cell) => ItemLook,
  texts: readonly PartManifest[]
): readonly PartManifest[] {
  const holdsImage = (cell: Cell): boolean => look(cell).media === "image";
  return [
    {
      key: "media",
      slot: "item-media",
      shownIn: always,
      optional: MEDIA_PROPERTY,
      label: undefined,
      iconsFor: (cell) => (holdsImage(cell) ? [] : [LIGHTNING]),
      parts: [
        {
          key: "image",
          slot: undefined,
          place: "item-media/0",
          shownIn: holdsImage,
          image: portraitPng,
          label: undefined,
          iconsFor: () => [],
        },
      ],
    },
    {
      key: "content",
      slot: "item-content",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: texts,
    },
  ];
}

/** The title, in the text a set gives it, which its `Title` property sets. */
function titleManifest(characters: string): PartManifest {
  return {
    key: "title",
    slot: "item-title",
    shownIn: always,
    label: { key: "text", name: "text", characters, textProperty: "Title", shownIn: always },
    iconsFor: () => [],
  };
}

/**
 * The Item row's manifest, which the capture-backed build reads with `captures/item.json`: an Item
 * row as a `<div>`, as `<Item.Root variant size>` around its media, content and actions in a 384px
 * container. The actions hold the demo's plain text in a `<span>`.
 */
export const ITEM_MANIFEST: SetManifest = {
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
  label: undefined,
  iconsFor: () => [],
  parts: [
    ...rowManifest(itemLook, [
      titleManifest(ITEM_TITLE_TEXT),
      {
        key: "description",
        slot: "item-description",
        shownIn: (cell) => itemLook(cell).described,
        label: {
          key: "text",
          name: "text",
          characters: ITEM_DESCRIPTION_TEXT,
          textProperty: "Description",
          shownIn: always,
        },
        iconsFor: () => [],
      },
    ]),
    {
      key: "actions",
      slot: "item-actions",
      shownIn: always,
      optional: { name: "Actions", defaultValue: true },
      label: {
        key: "text",
        name: "text",
        characters: ITEM_ACTIONS_TEXT,
        textProperty: "Actions text",
        shownIn: always,
      },
      iconsFor: () => [],
    },
  ],
  swapProperties: swapProperties([LIGHTNING]),
};

/**
 * The link row's manifest, which the capture-backed build reads with `captures/item-link.json`: an
 * Item row as a link, as `<Item.Root variant render={<a href="#order" />}>` around icon media and a
 * title in a 384px container, `aria-disabled="true"` where the cell is disabled.
 */
export const ITEM_LINK_MANIFEST: SetManifest = {
  key: "item-link",
  name: "Item link",
  slot: "item",
  axes: [
    { name: "variant", values: ["default", "outline"] },
    { name: "state", values: ["rest", "hover", "focus", "disabled"] },
  ],
  columnAxis: "state",
  previewWidth: ITEM_PREVIEW_WIDTH,
  label: undefined,
  iconsFor: () => [],
  parts: rowManifest(itemLinkLook, [titleManifest(ITEM_LINK_TITLE_TEXT)]),
  swapProperties: swapProperties([LIGHTNING]),
};
