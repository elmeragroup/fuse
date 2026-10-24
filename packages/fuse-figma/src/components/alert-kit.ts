/**
 * Alert, the status row, as one component set on the Alert page: its five tones without and with a
 * description, 10 cells, with columns by `described`.
 *
 * - Alert renders on Item: its root is an Item row of the `outline` variant at the `sm` size, which
 *   `alert.tsx` passes, with the tone's border, fill and text color over it. The row is 512px wide,
 *   the width the docs Variants demo's `max-w-lg` column gives it, which its `w-full` fills.
 * - The media is Item's icon media holding the tone's icon, a 20px glyph in the tone's color: Info
 *   in the default and info tones, WarningOctagon in destructive, Warning in warning and
 *   CheckCircle in success, as `ALERT_ICONS` in `alert.tsx` picks them. The tone decides the icon,
 *   so no property swaps it.
 * - The title and the description are the docs Variants demo's first row, `Scheduled maintenance`
 *   and `Read-only access tonight from 22:00 to 23:00.`, in the label text, `--label-text`, and the
 *   tone's text color. Their lines are 137.5% and 150% of that size, `leading-snug` and
 *   `leading-normal`, at each density. A text property sets each. The description wraps across the
 *   content column and shows every line, since Alert does not clamp it. Its rich-text spacing,
 *   which reaches the paragraphs and lists a consumer puts in it, draws nothing on one text.
 * - `described=on` adds the description, which `item-described:` reads: the media and the content
 *   then top-align, and the media is one title line tall, `--label-text` times `--leading-snug`,
 *   the `label-line-snug` variable. The description's presence is the `described` axis, not a
 *   BOOLEAN property, since a selector reads it.
 * - The action is `alert.tsx`'s `<Button size="sm">` in Item.Actions: an instance of Button's
 *   `default` variant at `sm`, at rest and with no icon, whose label is the docs Action demo's
 *   `Retry`. The tone's `button` slot overrides its fill and label color, which the build proves by
 *   the instance's in-place diff. It sits behind the `Action` BOOLEAN property, which starts false,
 *   so every variant draws the alert as the docs Variants demo shows it, and a designer turns it on.
 */
import {
  alertVariants,
  cn,
  ITEM_DESCRIPTION_CLASSES,
  ITEM_TITLE_CLASSES,
  itemActionsClass,
  itemContentClass,
  itemMediaVariants,
  itemVariants,
} from "@elmeragroup/fuse/recipe-catalog";

import { BUTTON } from "./button-kit";
import type {
  Cell,
  ComponentDefinition,
  IconSlot,
  InstanceDefinition,
  PartDefinition,
} from "./component-spec";
import { ownKey } from "./own-key";

/** The width the kit's previews and the compare host give an Alert, the docs demo's `max-w-lg`. */
export const ALERT_PREVIEW_WIDTH = 512;

/** The title's text, the default of its `Title` property: the docs Variants demo's first title. */
export const ALERT_TITLE_TEXT = "Scheduled maintenance";

/** The description's text, the default of its `Description` property: the demo's first description. */
export const ALERT_DESCRIPTION_TEXT = "Read-only access tonight from 22:00 to 23:00.";

/** The Item variant `Alert.Root` renders its row in, which `alert.tsx` passes. */
export const ALERT_ITEM_VARIANT = "outline";

/** The Item size `Alert.Root` renders its row at, which `alert.tsx` passes. */
export const ALERT_ITEM_SIZE = "sm";

type AlertVariant = keyof typeof alertVariants.variants.variant;

function isVariant(value: string | undefined): value is AlertVariant {
  return ownKey(alertVariants.variants.variant, value);
}

/** The tones in the recipe's order, its default first. */
const VARIANTS = Object.keys(alertVariants.variants.variant).filter(isVariant);

/** The Fuse icon each tone draws, by its export name, as `ALERT_ICONS` in `alert.tsx` maps them. */
const TONE_ICONS = {
  default: "Info",
  destructive: "WarningOctagon",
  warning: "Warning",
  success: "CheckCircle",
  info: "Info",
} as const satisfies Record<AlertVariant, string>;

/** What a cell renders: the tone, and whether the alert holds a description. */
export type AlertLook = {
  readonly variant: AlertVariant;
  readonly described: boolean;
};

/**
 * What an `alert` cell renders.
 *
 * @param cell - An `alert` cell.
 * @returns Its look.
 * @throws When the cell names a tone the recipe does not declare, a defect in the caller's cell.
 */
export function alertLook(cell: Cell): AlertLook {
  const { variant } = cell;
  if (!isVariant(variant)) {
    throw new Error(`Alert has no variant ${variant ?? ""}`);
  }
  return { variant, described: cell.described === "on" };
}

/** The recipe's slots in a cell's tone. */
function slotsFor(cell: Cell) {
  return alertVariants({ variant: alertLook(cell).variant });
}

const always = (): boolean => true;

/** The tone's icon, `Alert.Icon`'s `<svg>`, with the classes it carries. */
function toneIcons(cell: Cell): readonly IconSlot[] {
  return [
    {
      key: "icon",
      name: "Icon",
      side: "start",
      direct: true,
      dataIcon: undefined,
      icon: TONE_ICONS[alertLook(cell).variant],
      swapProperty: undefined,
      classes: slotsFor(cell).icon(),
    },
  ];
}

/** Item's icon media with the alert's media line, holding the tone's icon. */
const MEDIA: PartDefinition = {
  key: "media",
  slot: "item-media",
  shownIn: always,
  classesFor: (cell) => cn(itemMediaVariants({ variant: "icon" }), slotsFor(cell).media()),
  label: undefined,
  iconsFor: toneIcons,
};

/** The title, Item's title face in the label text, which its `Title` property sets. */
const TITLE: PartDefinition = {
  key: "title",
  slot: "item-title",
  shownIn: always,
  classesFor: (cell) => cn(ITEM_TITLE_CLASSES, slotsFor(cell).title()),
  label: { key: "text", name: "text", characters: ALERT_TITLE_TEXT, textProperty: "Title", shownIn: always },
  iconsFor: () => [],
};

/** The description, unclamped, in the `alert` cells that hold one. */
const DESCRIPTION: PartDefinition = {
  key: "description",
  slot: "item-description",
  shownIn: (cell) => alertLook(cell).described,
  classesFor: (cell) => cn(ITEM_DESCRIPTION_CLASSES, slotsFor(cell).description()),
  label: {
    key: "text",
    name: "text",
    characters: ALERT_DESCRIPTION_TEXT,
    textProperty: "Description",
    shownIn: always,
  },
  iconsFor: () => [],
};

const CONTENT: PartDefinition = {
  key: "content",
  slot: "item-content",
  shownIn: always,
  classesFor: () => itemContentClass,
  label: undefined,
  iconsFor: () => [],
  parts: [TITLE, DESCRIPTION],
};

/** The action's label, which the instance gives Button's `Label`: the docs Action demo's. */
export const ALERT_ACTION_LABEL = "Retry";

/** The BOOLEAN property that shows the action, which starts false, so a published cell shows none. */
export const ALERT_ACTION_PROPERTY = "Action";

/** The action, a small Button in the tone's fill and text color, as `alert.tsx` renders it. */
const ACTION: InstanceDefinition = {
  kind: "instance",
  key: "action",
  of: BUTTON,
  cell: () => ({ variant: "default", size: "sm", state: "rest", icon: "none" }),
  classesFor: (cell) => slotsFor(cell).button(),
  properties: () => ({ text: { Label: ALERT_ACTION_LABEL } }),
  shownIn: always,
  exposed: true,
};

/** Item's actions around the action, behind the `Action` BOOLEAN property, which starts false. */
const ACTIONS: PartDefinition = {
  key: "actions",
  slot: "item-actions",
  shownIn: always,
  optional: { name: ALERT_ACTION_PROPERTY, defaultValue: false },
  classesFor: () => itemActionsClass,
  label: undefined,
  iconsFor: () => [],
  parts: [ACTION],
};

/**
 * An Alert, as `<Alert.Root variant>` around its title and, where the cell is described, its
 * description, in a 512px container, with the action behind the `Action` property.
 */
export const ALERT: ComponentDefinition = {
  key: "alert",
  name: "Alert",
  slot: "item",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "described", values: ["off", "on"] },
  ],
  columnAxis: "described",
  previewWidth: ALERT_PREVIEW_WIDTH,
  classesFor: (cell) =>
    cn(itemVariants({ variant: ALERT_ITEM_VARIANT, size: ALERT_ITEM_SIZE }), slotsFor(cell).base()),
  states: {},
  // The variants that read the row around a part: its size, which Alert fixes at `sm`, and whether
  // it holds a description.
  facts: new Map<string, (cell: Cell) => boolean>([
    ...Object.keys(itemVariants.variants.size).map(
      (size) => [`group-data-[size=${size}]/item`, () => size === ALERT_ITEM_SIZE] as const
    ),
    ["item-described", (cell: Cell) => alertLook(cell).described],
  ]),
  // An alert's `<div>` row takes no focus, hover or disabled state.
  omittedStates: new Set(["focus-visible", "disabled", "aria-disabled"]),
  omittedCompositions: new Map([
    ["[a]", "the row as a link, which an Alert never renders, since its row is a `<div>`"],
    ["[&+[data-slot=item-content]]", "a second Item.Content after this one, which an Alert never renders"],
    [
      "rich-text-block",
      "the paragraphs and lists a rich-text description holds, which the set draws as one text",
    ],
    [
      "rich-text-gap",
      "the space between the blocks a rich-text description holds, which the set draws as one text",
    ],
  ]),
  label: undefined,
  iconsFor: () => [],
  parts: [MEDIA, CONTENT, ACTIONS],
  swapProperties: [],
};
