/**
 * Empty, the placeholder a list or a page shows when it has nothing to show, as one component set:
 * the recipe's three frames, 3 cells, with columns by frame. Each cell draws the docs Basic demo's
 * header: the icon media, the title and the description.
 *
 * - The root is a `<div data-slot="empty">`, a centered `flex flex-col` with a 24px gap. It is
 *   block-level, so it takes the 512px preview width. Its padding is `md:`'s `2 * --surface-pad-lg`,
 *   since the kit draws a desktop window, which binds `empty-pad-desktop`. `outline` strokes it 1px
 *   with `border`, and `outline-dashed` with 3px dashes and 2px gaps.
 * - The header is a `<div data-slot="empty-header">`, a centered column with an 8px gap that hugs
 *   what it holds up to `max-w-sm`, 384px, where the title and the description wrap.
 * - The media is `emptyMediaVariants`' `icon` box, a 40px `muted` square holding a 24px Tray, which
 *   the `Icon` swap property picks. Its `mb-2` adds 8px below it, which a frame around it draws, and
 *   the `Media` BOOLEAN property hides the frame, so the space goes with the media. The recipe's
 *   `default` media is a frameless box for an illustration, such as the docs' `FkasMeter`, which the
 *   kit does not ship, so the set draws the icon media only.
 * - The title is `No orders yet` at 18/28 Medium in the page's `foreground`, its letters -2.5% of
 *   the font size apart (`tracking-tight`). The description is `Orders you create will show up
 *   here.` at 14/22.75 in `muted-foreground`, behind the `Description` BOOLEAN property, as the docs
 *   leave it out beside a table. Their `Title` and `Description text` properties set them, the
 *   second named apart from the BOOLEAN, since the plugin finds a property by its name.
 * - Empty with actions, which holds Buttons in `Empty.Content`, waits until kit components can hold
 *   instances.
 */
import { emptyMediaVariants, emptyVariants } from "@elmeragroup/fuse/recipe-catalog";

import { swapProperties } from "./component-spec";
import type { Cell, ComponentDefinition, IconSlot, PartDefinition } from "./component-spec";

/** The width the kit's previews and the compare host give Empty: 384px of header inside its padding. */
export const EMPTY_PREVIEW_WIDTH = 512;

/** The title's text, the default of its `Title` property: the docs Basic demo's title. */
export const EMPTY_TITLE_TEXT = "No orders yet";

/** The description's text, the default of its `Description text` property: the docs Basic demo's. */
export const EMPTY_DESCRIPTION_TEXT = "Orders you create will show up here.";

/** The frames `emptyVariants` declares on its root, its default first. */
const VARIANTS = ["default", "outline", "outline-dashed"] as const;

/** A frame of Empty's root, as `Empty.Root` takes its `variant`. */
type EmptyVariant = (typeof VARIANTS)[number];

/**
 * A cell's frame.
 *
 * @param cell - An `empty` cell.
 * @returns The frame its `variant` names.
 * @throws When the cell names no frame the set declares, a defect in the caller's cell.
 */
export function emptyVariantFor(cell: Cell): EmptyVariant {
  const variant = VARIANTS.find((candidate) => candidate === cell.variant);
  if (variant === undefined) {
    throw new Error(`Empty has no variant ${cell.variant ?? ""}`);
  }
  return variant;
}

const always = (): boolean => true;

/** The slots of the parts without an axis. */
const styles = emptyVariants();

/** The Tray the docs Basic demo puts in the media, which the `Icon` swap property picks. */
const TRAY: IconSlot = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "Tray",
  swapProperty: "Icon",
};

/** The icon media, behind the `Media` BOOLEAN property. */
const MEDIA: PartDefinition = {
  key: "media",
  slot: "empty-media",
  shownIn: always,
  optional: { name: "Media", defaultValue: true },
  classesFor: () => emptyMediaVariants({ variant: "icon" }),
  label: undefined,
  iconsFor: () => [TRAY],
};

/** The title. */
const TITLE: PartDefinition = {
  key: "title",
  slot: "empty-title",
  shownIn: always,
  classesFor: () => styles.title(),
  label: { key: "text", name: "text", characters: EMPTY_TITLE_TEXT, textProperty: "Title", shownIn: always },
  iconsFor: () => [],
};

/** The description, behind the `Description` BOOLEAN property. */
const DESCRIPTION: PartDefinition = {
  key: "description",
  slot: "empty-description",
  shownIn: always,
  optional: { name: "Description", defaultValue: true },
  classesFor: () => styles.description(),
  label: {
    key: "text",
    name: "text",
    characters: EMPTY_DESCRIPTION_TEXT,
    textProperty: "Description text",
    shownIn: always,
  },
  iconsFor: () => [],
};

/** The header that stacks the media, the title and the description. */
const HEADER: PartDefinition = {
  key: "header",
  slot: "empty-header",
  shownIn: always,
  classesFor: () => styles.header(),
  label: undefined,
  iconsFor: () => [],
  parts: [MEDIA, TITLE, DESCRIPTION],
};

/** An Empty, as `<Empty.Root variant><Empty.Header>…</Empty.Header></Empty.Root>` in a 512px container. */
export const EMPTY: ComponentDefinition = {
  key: "empty",
  name: "Empty",
  slot: "empty",
  axes: [{ name: "variant", values: VARIANTS }],
  columnAxis: "variant",
  previewWidth: EMPTY_PREVIEW_WIDTH,
  classesFor: (cell) => emptyVariants({ variant: emptyVariantFor(cell) }).root(),
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: [HEADER],
  swapProperties: swapProperties([TRAY]),
};
