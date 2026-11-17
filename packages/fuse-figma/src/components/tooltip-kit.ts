/**
 * Tooltip, as two component sets on a page of their own: the popup the docs Basic demo opens, and
 * that popup open above its trigger.
 *
 * - `Tooltip content` is the popup, 1 cell: `Tooltip.Content` renders Base UI's `<div
 *   data-slot="tooltip-content">`. Its text is the docs Basic demo's, which a TEXT property sets.
 * - The arrow is Base UI's `<div aria-hidden="true">` after the text, at the popup's first place.
 *   Base UI writes its `left` from the trigger's center, and the capture holds where the browser
 *   put it.
 * - `Tooltip (open)` is the ghost icon Button trigger with Info, and the popup open above it, 1 cell.
 *   Base UI places the popup on the trigger's top side, 4px above it and centered on it.
 */
import type { SetManifest } from "../capture/manifest";
import { ICON_BUTTON_MANIFEST } from "./button-kit";
import { always } from "./popup-facts";
import { TOOLTIP_TEXT } from "./tooltip-text";

/**
 * The popup's manifest, which the capture-backed build reads with `captures/tooltip-content.json`:
 * the open popup, as `<Tooltip.Content>` holding the docs Basic demo's text.
 */
export const TOOLTIP_CONTENT_MANIFEST: SetManifest = {
  key: "tooltip-content",
  name: "Tooltip content",
  slot: "tooltip-content",
  axes: [{ name: "content", values: ["basic"] }],
  columnAxis: "content",
  label: { key: "text", name: "text", characters: TOOLTIP_TEXT, textProperty: "Text", shownIn: always },
  iconsFor: () => [],
  parts: [
    {
      key: "arrow",
      slot: undefined,
      place: "tooltip-content/0",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
    },
  ],
  swapProperties: [],
};

/**
 * The open Tooltip's manifest, which the capture-backed build reads with `captures/tooltip-open.json`:
 * the popup and the trigger, which `Tooltip.Trigger` stamps with its own slot, and
 * `Tooltip.Content`'s `sideOffset` as the docs' API reference gives it.
 */
export const TOOLTIP_OPEN_MANIFEST: SetManifest = {
  key: "tooltip-open",
  name: "Tooltip (open)",
  slot: "tooltip-open",
  axes: [{ name: "placement", values: ["above"] }],
  columnAxis: "placement",
  union: ["tooltip-content", "tooltip-trigger"],
  sideOffset: 4,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "content",
      of: TOOLTIP_CONTENT_MANIFEST,
      cell: () => ({ content: "basic" }),
      shownIn: always,
    },
    {
      kind: "instance",
      key: "trigger",
      of: ICON_BUTTON_MANIFEST,
      cell: () => ({ variant: "ghost", size: "icon", state: "rest" }),
      properties: () => ({ swap: { Icon: "Info" } }),
      slot: "tooltip-trigger",
      shownIn: always,
      exposed: true,
    },
  ],
  swapProperties: [],
};
