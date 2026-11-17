/**
 * Empty, the placeholder a list or a page shows when it has nothing to show, as one component set:
 * the recipe's three frames, 3 cells, with columns by frame. Each cell draws the docs Basic demo's
 * header: the icon media, the title and the description.
 *
 * - The root is a `<div data-slot="empty">`. Its sample renders in a 512px host.
 * - The header is a `<div data-slot="empty-header">` that holds the media, the title and the
 *   description.
 * - The media is the icon media, holding a Tray, which the `Icon` swap property picks. The `Media`
 *   BOOLEAN property hides it. The recipe's `default` media is a frameless box for an illustration,
 *   such as the docs' `FkasMeter`, which the kit does not ship, so the set draws the icon media only.
 * - The title is `No orders yet`. The description is `Orders you create will show up here.`, behind
 *   the `Description` BOOLEAN property, as the docs leave it out beside a table. Their `Title` and
 *   `Description text` properties set them, the second named apart from the BOOLEAN, since the
 *   plugin finds a property by its name.
 * - The content is the docs With actions demo's `Empty.Content`, which holds a default and a
 *   secondary Button: instances of Button at the default size, at rest and with no icon, labeled
 *   `Create order` and `Import orders`. The `Actions` BOOLEAN property, which starts false, hides
 *   the content, so every variant draws the Basic demo's header alone, and a designer turns the
 *   actions on.
 */
import type {
  IconManifest,
  InstanceManifest,
  LabelManifest,
  PartManifest,
  SetManifest,
} from "../capture/manifest";
import { BUTTON_MANIFEST } from "./button-kit";
import { swapProperties } from "./component-spec";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";

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

/** The Tray the docs Basic demo puts in the media, which the `Icon` swap property picks. */
const TRAY: IconManifest = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "Tray",
  swapProperty: "Icon",
};

/** The BOOLEAN property that hides the media. */
const MEDIA_PROPERTY = { name: "Media", defaultValue: true };

/** The title's text, which the `Title` property sets. */
const TITLE_TEXT: LabelManifest = {
  key: "text",
  name: "text",
  characters: EMPTY_TITLE_TEXT,
  textProperty: "Title",
  shownIn: always,
};

/** The description's text, which the `Description text` property sets. */
const DESCRIPTION_TEXT: LabelManifest = {
  key: "text",
  name: "text",
  characters: EMPTY_DESCRIPTION_TEXT,
  textProperty: "Description text",
  shownIn: always,
};

/** The BOOLEAN property that hides the description. */
const DESCRIPTION_PROPERTY = { name: "Description", defaultValue: true };

/** The BOOLEAN property that shows the actions, which starts false, so a published cell shows none. */
export const EMPTY_ACTIONS_PROPERTY = "Actions";

/** The label of the first action, the default Button, as the docs With actions demo gives it. */
export const EMPTY_PRIMARY_ACTION_LABEL = "Create order";

/** The label of the second action, the secondary Button, as the docs With actions demo gives it. */
export const EMPTY_SECONDARY_ACTION_LABEL = "Import orders";

/** The BOOLEAN property that shows the actions, which starts false. */
const ACTIONS_PROPERTY = { name: EMPTY_ACTIONS_PROPERTY, defaultValue: false };

/**
 * An action, a Button of the given variant at the default size, as the docs With actions demo
 * places it.
 *
 * @param key - The instance's key.
 * @param variant - The Button variant.
 * @param label - The label, which the instance gives Button's `Label`.
 */
function actionManifest(key: string, variant: string, label: string): InstanceManifest {
  return {
    kind: "instance",
    key,
    of: BUTTON_MANIFEST,
    cell: () => ({ variant, size: "default", state: "rest", icon: "none" }),
    properties: () => ({ text: { Label: label } }),
    shownIn: always,
    exposed: true,
  };
}

/** The header's manifest: the media, the title and the description. */
const HEADER_MANIFEST: PartManifest = {
  key: "header",
  slot: "empty-header",
  shownIn: always,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "media",
      slot: "empty-media",
      shownIn: always,
      optional: MEDIA_PROPERTY,
      label: undefined,
      iconsFor: () => [TRAY],
    },
    { key: "title", slot: "empty-title", shownIn: always, label: TITLE_TEXT, iconsFor: () => [] },
    {
      key: "description",
      slot: "empty-description",
      shownIn: always,
      optional: DESCRIPTION_PROPERTY,
      label: DESCRIPTION_TEXT,
      iconsFor: () => [],
    },
  ],
};

/** The content's manifest, around the two actions, behind the `Actions` BOOLEAN property. */
const CONTENT_MANIFEST: PartManifest = {
  key: "content",
  slot: "empty-content",
  shownIn: always,
  optional: ACTIONS_PROPERTY,
  label: undefined,
  iconsFor: () => [],
  parts: [
    actionManifest("primary", "default", EMPTY_PRIMARY_ACTION_LABEL),
    actionManifest("secondary", "secondary", EMPTY_SECONDARY_ACTION_LABEL),
  ],
};

/**
 * Empty's manifest, which the capture-backed build reads with `captures/empty.json`: an Empty, as
 * `<Empty.Root variant><Empty.Header>…</Empty.Header></Empty.Root>` in a 512px container, with the
 * actions' `Empty.Content` behind the `Actions` property.
 */
export const EMPTY_MANIFEST: SetManifest = {
  key: "empty",
  name: "Empty",
  slot: "empty",
  axes: [{ name: "variant", values: VARIANTS }],
  columnAxis: "variant",
  previewWidth: EMPTY_PREVIEW_WIDTH,
  label: undefined,
  iconsFor: () => [],
  parts: [HEADER_MANIFEST, CONTENT_MANIFEST],
  swapProperties: swapProperties([TRAY]),
};
