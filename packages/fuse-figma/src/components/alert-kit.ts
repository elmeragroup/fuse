/**
 * Alert, the status row, as one component set on the Alert page: its five tones without and with a
 * description, 10 cells, with columns by `described`.
 *
 * - Alert renders on Item: its root is an Item row, `<div data-slot="item">`. Its sample renders in
 *   a 512px host, the width the docs Variants demo's `max-w-lg` column gives it.
 * - The media is Item's icon media holding the tone's icon: Info in the default and info tones,
 *   WarningOctagon in destructive, Warning in warning and CheckCircle in success, as `ALERT_ICONS`
 *   in `alert.tsx` picks them. The tone decides the icon, so no property swaps it.
 * - The title and the description are the docs Variants demo's first row, `Scheduled maintenance`
 *   and `Read-only access tonight from 22:00 to 23:00.`. A text property sets each.
 * - `described=on` adds the description. The description's presence is the `described` axis, not
 *   a BOOLEAN property, since a selector reads it.
 * - The action is `alert.tsx`'s `<Button size="sm">` in Item.Actions: an instance of Button's
 *   `default` variant at `sm`, at rest and with no icon, whose label is the docs Action demo's
 *   `Retry`. It sits behind the `Action` BOOLEAN property, which starts false, so every variant
 *   draws the alert as the docs Variants demo shows it, and a designer turns it on.
 */
import { alertVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { IconManifest, SetManifest } from "../capture/manifest";
import { BUTTON_MANIFEST } from "./button-kit";
import type { Cell } from "./component-spec";
import { ownKey } from "./own-key";
import { always } from "./popup-facts";

/** The width the kit's previews and the compare host give an Alert, the docs demo's `max-w-lg`. */
export const ALERT_PREVIEW_WIDTH = 512;

/** The title's text, the default of its `Title` property: the docs Variants demo's first title. */
export const ALERT_TITLE_TEXT = "Scheduled maintenance";

/** The description's text, the default of its `Description` property: the demo's first description. */
export const ALERT_DESCRIPTION_TEXT = "Read-only access tonight from 22:00 to 23:00.";

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

/** The tone's icon, `Alert.Icon`'s `<svg>`. */
function toneIcon(cell: Cell): IconManifest {
  return {
    key: "icon",
    name: "Icon",
    side: "start",
    direct: true,
    dataIcon: undefined,
    icon: TONE_ICONS[alertLook(cell).variant],
    swapProperty: undefined,
  };
}

/** The action's label, which the instance gives Button's `Label`: the docs Action demo's. */
export const ALERT_ACTION_LABEL = "Retry";

/** The BOOLEAN property that shows the action, which starts false, so a published cell shows none. */
export const ALERT_ACTION_PROPERTY = "Action";

/**
 * The alert's manifest, which the capture-backed build reads with `captures/alert.json`: an Alert,
 * as `<Alert.Root variant>` around its title and, where the cell is described, its description, in
 * a 512px container, with the action behind the `Action` property.
 */
export const ALERT_MANIFEST: SetManifest = {
  key: "alert",
  name: "Alert",
  slot: "item",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "described", values: ["off", "on"] },
  ],
  columnAxis: "described",
  previewWidth: ALERT_PREVIEW_WIDTH,
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
  parts: [
    {
      key: "media",
      slot: "item-media",
      shownIn: always,
      label: undefined,
      iconsFor: (cell) => [toneIcon(cell)],
    },
    {
      key: "content",
      slot: "item-content",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "title",
          slot: "item-title",
          shownIn: always,
          label: {
            key: "text",
            name: "text",
            characters: ALERT_TITLE_TEXT,
            textProperty: "Title",
            shownIn: always,
          },
          iconsFor: () => [],
        },
        {
          key: "description",
          slot: "item-description",
          shownIn: (cell) => alertLook(cell).described,
          label: {
            key: "text",
            name: "text",
            characters: ALERT_DESCRIPTION_TEXT,
            textProperty: "Description",
            shownIn: always,
          },
          iconsFor: () => [],
        },
      ],
    },
    {
      key: "actions",
      slot: "item-actions",
      shownIn: always,
      optional: { name: ALERT_ACTION_PROPERTY, defaultValue: false },
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          kind: "instance",
          key: "action",
          of: BUTTON_MANIFEST,
          cell: () => ({ variant: "default", size: "sm", state: "rest", icon: "none" }),
          properties: () => ({ text: { Label: ALERT_ACTION_LABEL } }),
          shownIn: always,
          exposed: true,
        },
      ],
    },
  ],
};
