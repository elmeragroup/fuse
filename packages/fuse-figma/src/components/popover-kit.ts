/**
 * Popover, as two component sets on a page of their own: the popup the docs Basic demo opens, and
 * that popup open below its trigger.
 *
 * - `Popover content` is the popup, 1 cell: `Popover.Content` renders Base UI's `<div
 *   data-slot="popover-content">`. It holds the docs Basic demo: a header with the title
 *   `Dimensions` and the description, each a TEXT property, and two vertical Fields, `Width` and
 *   `Height`, each a label above an `Input` instance. The label is a frame with its own text, since
 *   the Field stretches it and its text fills it, which a `Label` instance cannot draw. The demo's
 *   inputs hold no placeholder and no value, so each Input instance's `Text` is empty.
 * - `Popover (open)` is the outline Button trigger, `Details`, with the popup open below it, 1 cell.
 *   Base UI places the popup under the trigger, 4px below it and centered on it. The popup's shadow
 *   shows past the composite (PQ1).
 * - The arrow is left out: `showArrow` draws it as a rotated, bordered pseudo-element, and the docs
 *   Basic demo shows none.
 */
import type { PartManifest, SetManifest } from "../capture/manifest";
import { BUTTON_MANIFEST } from "./button-kit";
import { INPUT_MANIFEST } from "./input-kit";
import {
  POPOVER_DESCRIPTION_TEXT,
  POPOVER_FIELD_LABELS,
  POPOVER_TITLE_TEXT,
  POPOVER_TRIGGER_TEXT,
} from "./popover-text";
import { always } from "./popup-facts";

/** A labelled Field of the popup as its manifest names it: the label's frame, then the input's instance. */
function fieldManifest(label: string): PartManifest {
  const key = label.toLowerCase();
  return {
    key: `field-${key}`,
    slot: "field",
    shownIn: always,
    label: undefined,
    iconsFor: () => [],
    parts: [
      {
        key: `label-${key}`,
        slot: "field-label",
        shownIn: always,
        label: {
          key: "label",
          name: "label",
          characters: label,
          textProperty: `${label} label`,
          shownIn: always,
        },
        iconsFor: () => [],
      },
      {
        kind: "instance",
        key: `input-${key}`,
        of: INPUT_MANIFEST,
        cell: () => ({ content: "value", state: "rest" }),
        properties: () => ({ text: { Text: "" } }),
        shownIn: always,
        exposed: true,
      },
    ],
  };
}

/**
 * The popup's manifest, which the capture-backed build reads with `captures/popover-content.json`,
 * as `<Popover.Content>` holding the docs Basic demo's header and Fields renders it.
 */
export const POPOVER_CONTENT_MANIFEST: SetManifest = {
  key: "popover-content",
  name: "Popover content",
  slot: "popover-content",
  axes: [{ name: "content", values: ["basic"] }],
  columnAxis: "content",
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "header",
      slot: "popover-header",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "title",
          slot: "popover-title",
          shownIn: always,
          label: {
            key: "text",
            name: "text",
            characters: POPOVER_TITLE_TEXT,
            textProperty: "Title",
            shownIn: always,
          },
          iconsFor: () => [],
        },
        {
          key: "description",
          slot: "popover-description",
          shownIn: always,
          label: {
            key: "text",
            name: "text",
            characters: POPOVER_DESCRIPTION_TEXT,
            textProperty: "Description",
            shownIn: always,
          },
          iconsFor: () => [],
        },
      ],
    },
    ...POPOVER_FIELD_LABELS.map(fieldManifest),
  ],
  swapProperties: [],
};

/**
 * The open Popover's manifest, which the capture-backed build reads with `captures/popover-open.json`:
 * the trigger Button, which `Popover.Trigger` stamps with its own slot, and the popup, and
 * `Popover.Content`'s `sideOffset` as the docs' API reference gives it.
 */
export const POPOVER_OPEN_MANIFEST: SetManifest = {
  key: "popover-open",
  name: "Popover (open)",
  slot: "popover-open",
  axes: [{ name: "placement", values: ["below"] }],
  columnAxis: "placement",
  union: ["popover-trigger", "popover-content"],
  sideOffset: 4,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "trigger",
      of: BUTTON_MANIFEST,
      cell: () => ({ variant: "outline", size: "default", state: "rest", icon: "none" }),
      properties: () => ({ text: { Label: POPOVER_TRIGGER_TEXT } }),
      slot: "popover-trigger",
      shownIn: always,
      exposed: true,
    },
    {
      kind: "instance",
      key: "content",
      of: POPOVER_CONTENT_MANIFEST,
      cell: () => ({ content: "basic" }),
      shownIn: always,
    },
  ],
  swapProperties: [],
};
