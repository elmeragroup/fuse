/**
 * Tooltip, as two component sets on a page of their own: the popup the docs Basic demo opens, and
 * that popup open above its trigger.
 *
 * - `Tooltip content` is the popup, 4 cells, one per side it opens on: `Tooltip.Content` renders Base
 *   UI's `<div data-slot="tooltip-content">`. Its text is the docs Basic demo's, which a TEXT
 *   property sets.
 * - The arrow is Base UI's `<div aria-hidden="true">` after the text, at the popup's first place. It
 *   hangs from the popup's edge that faces the trigger. Base UI writes its offset along that edge
 *   from the trigger's center, and the capture holds where the browser put it.
 * - `Tooltip (open)` is the ghost icon Button trigger with Info, and the popup open on each side of
 *   it, 4 cells. Base UI places the popup 4px from the trigger and centered on it.
 */
import type { SetManifest } from "../capture/manifest";
import { ICON_BUTTON_MANIFEST } from "./button-kit";
import { always } from "./popup-facts";
import { TOOLTIP_SIDE_OFFSET, TOOLTIP_SIDES, tooltipSideOf } from "./tooltip-sides";
import { TOOLTIP_TEXT } from "./tooltip-text";

/**
 * The popup's manifest, which the capture-backed build reads with `captures/tooltip-content.json`:
 * the open popup, as `<Tooltip.Content>` holding the docs Basic demo's text.
 */
export const TOOLTIP_CONTENT_MANIFEST: SetManifest = {
  key: "tooltip-content",
  name: "Tooltip content",
  api: { page: "tooltip", parts: ["Tooltip.Content"] },
  slot: "tooltip-content",
  axes: [
    { name: "content", values: ["basic"] },
    { name: "side", values: TOOLTIP_SIDES },
  ],
  // The side axis came after the set's first release, so the `top` popup keeps the key it had then
  // (W5-P2).
  addedAxes: new Set(["side"]),
  columnAxis: "side",
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
  api: { page: "tooltip", parts: ["Tooltip.Content"] },
  slot: "tooltip-open",
  axes: [{ name: "side", values: TOOLTIP_SIDES }],
  columnAxis: "side",
  union: ["tooltip-content", "tooltip-trigger"],
  sideOffset: TOOLTIP_SIDE_OFFSET,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "content",
      of: TOOLTIP_CONTENT_MANIFEST,
      cell: (outer) => ({ content: "basic", side: tooltipSideOf(outer) }),
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
