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
 * - The content is the docs With actions demo's `Empty.Content`, a column that fills the root's width
 *   up to `max-w-sm`, 384px, centering a default and a secondary Button 16px apart: instances of
 *   Button at the default size, at rest and with no icon, labelled `Create order` and `Import
 *   orders`. Their own classes draw them but the alignment of their labels, which the root's
 *   `text-center` centers, so each instance overrides its label's alignment. The `Actions` BOOLEAN
 *   property, which starts false, hides the content, so every variant draws the Basic demo's header
 *   alone, and a designer turns the actions on.
 */
import { emptyMediaVariants, emptyVariants } from "@elmeragroup/fuse/recipe-catalog";

import { BUTTON } from "./button-kit";
import { swapProperties } from "./component-spec";
import type {
  Cell,
  ComponentDefinition,
  IconSlot,
  InstanceDefinition,
  PartDefinition,
} from "./component-spec";

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

/** The BOOLEAN property that shows the actions, which starts false, so a published cell shows none. */
export const EMPTY_ACTIONS_PROPERTY = "Actions";

/** The label of the first action, the default Button, as the docs With actions demo gives it. */
export const EMPTY_PRIMARY_ACTION_LABEL = "Create order";

/** The label of the second action, the secondary Button, as the docs With actions demo gives it. */
export const EMPTY_SECONDARY_ACTION_LABEL = "Import orders";

/**
 * An action, a Button of the given variant at the default size, as the docs With actions demo
 * places it.
 *
 * @param key - The instance's key.
 * @param variant - The Button variant.
 * @param label - The label, which the instance gives Button's `Label`.
 */
function actionOf(key: string, variant: string, label: string): InstanceDefinition {
  return {
    kind: "instance",
    key,
    of: BUTTON,
    cell: () => ({ variant, size: "default", state: "rest", icon: "none" }),
    properties: () => ({ text: { Label: label } }),
    shownIn: always,
    exposed: true,
  };
}

/** The content around the actions, behind the `Actions` BOOLEAN property, which starts false. */
const CONTENT: PartDefinition = {
  key: "content",
  slot: "empty-content",
  shownIn: always,
  optional: { name: EMPTY_ACTIONS_PROPERTY, defaultValue: false },
  classesFor: () => styles.content(),
  label: undefined,
  iconsFor: () => [],
  parts: [
    actionOf("primary", "default", EMPTY_PRIMARY_ACTION_LABEL),
    actionOf("secondary", "secondary", EMPTY_SECONDARY_ACTION_LABEL),
  ],
};

/**
 * An Empty, as `<Empty.Root variant><Empty.Header>…</Empty.Header></Empty.Root>` in a 512px container,
 * with the actions' `Empty.Content` behind the `Actions` property.
 */
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
  parts: [HEADER, CONTENT],
  swapProperties: swapProperties([TRAY]),
};
