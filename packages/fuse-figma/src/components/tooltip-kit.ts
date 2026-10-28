/**
 * Tooltip, as two component sets on a page of their own: the popup the docs Basic demo opens, and
 * that popup open above its trigger.
 *
 * - `Tooltip content` is the popup, 1 cell: `Tooltip.Content` renders Base UI's `<div
 *   data-slot="tooltip-content">` with the `popup` slot of `tooltipVariants`. It inverts the fill,
 *   `bg-foreground` behind `text-background` 12px text, rounded `radius-md` and padded `surface-pad-md`
 *   across and `row-py` down, at most 320px wide. Its text is the docs Basic demo's, which a TEXT
 *   property sets.
 * - The arrow is Base UI's `<div aria-hidden="true">` after the text, a 10px square in the popup's
 *   fill with 2px corners, turned 45° and pulled half out of the popup's bottom edge:
 *   `-bottom-2.5` and `translate-y-[calc(-50%-2px)]` put its centre 2px above the edge. Base UI writes
 *   `position: absolute` and its `left` inline, the trigger's centre less half the arrow, which in the
 *   open example's centred popup is `calc(50% - 5px)`, so the arrow centres across the popup: Chromium
 *   read `left: 41px` in a 92px popup and `45px` in a 100px one. Its containing block is Base UI's
 *   positioner, which has the popup's box, so the popup names it in `positionedBy`. The popup leaves
 *   the arrow unclipped, as CSS draws it past the edge. A real file drew the arrow so, its
 *   `relativeTransform` `[[0.7071, -0.7071, W/2], [0.7071, 0.7071, H - 9.0703]]` in either write order,
 *   kept it through density and text-driven resizes with no instance overrides, and exported the
 *   overhang in its PNG (W5-P11, W5-P11b).
 * - `Tooltip (open)` is the ghost icon Button trigger with Info, and the popup open above it, 1 cell.
 *   Base UI places the popup on the trigger's top side, 4px above it and centred on it, so the
 *   composite is a column of the popup's instance and the trigger's, centred, which clips nothing.
 */
import { focusRing, tooltipVariants } from "@elmeragroup/fuse/recipe-catalog";

import { ICON_BUTTON } from "./button-kit";
import type { ComponentDefinition, PartDefinition } from "./component-spec";
import { always, openPopupFacts } from "./popup-facts";
import { TOOLTIP_TEXT } from "./tooltip-text";

const slots = tooltipVariants();

/**
 * The arrow, Base UI's `<div>` after the text. Base UI writes its `left` from the trigger's centre,
 * which the kit's centred popup puts at its own centre, half the arrow's 10px to the left.
 */
const ARROW: PartDefinition = {
  key: "arrow",
  slot: undefined,
  element: { tag: "div", attributes: { "aria-hidden": "true" } },
  shownIn: always,
  classesFor: () => slots.arrow(),
  styleFor: () => [
    { property: "position", value: "absolute" },
    {
      property: "left",
      value: "calc(50% - 5px)",
      measured:
        "Base UI writes the trigger's centre less half the arrow in pixels, which in the kit's centred popup is half the popup's width less 5px",
    },
  ],
  label: undefined,
  iconsFor: () => [],
};

/** The open popup, as `<Tooltip.Content>` holding the docs Basic demo's text. */
export const TOOLTIP_CONTENT: ComponentDefinition = {
  key: "tooltip-content",
  name: "Tooltip content",
  slot: "tooltip-content",
  axes: [{ name: "content", values: ["basic"] }],
  columnAxis: "content",
  classesFor: () => slots.popup(),
  positionedBy: "Base UI's tooltip positioner, an absolute box with the popup's size",
  // The arrow hangs below the popup's edge, which the popup does not clip.
  rootOverflow: "visible",
  fitsOneLine:
    "Chromium measured the Basic demo's text on one line, the popup 92px wide dense and 100px comfortable, far inside its 320px max-width (2026-10-27)",
  states: {},
  // Base UI stamps an open popup above its trigger `data-open` and `data-side="top"`, and the arrow
  // too, which reads its side.
  facts: openPopupFacts({ side: "top" }),
  omittedStates: new Set(),
  label: {
    key: "text",
    name: "text",
    characters: TOOLTIP_TEXT,
    textProperty: "Text",
    shownIn: always,
  },
  iconsFor: () => [],
  parts: [ARROW],
  swapProperties: [],
};

/**
 * The open Tooltip: the ghost icon Button trigger and the popup above it. The composite has no element
 * of its own: the column draws Base UI's placement, the popup 4px above the trigger and centred on it.
 */
export const TOOLTIP_OPEN: ComponentDefinition = {
  key: "tooltip-open",
  name: "Tooltip (open)",
  slot: "tooltip-open",
  axes: [{ name: "placement", values: ["above"] }],
  columnAxis: "placement",
  classesFor: () => "flex flex-col items-center gap-1",
  // The popup's arrow reaches past the popup into the gap above the trigger.
  rootOverflow: "visible",
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "content",
      of: TOOLTIP_CONTENT,
      cell: () => ({ content: "basic" }),
      shownIn: always,
    },
    {
      kind: "instance",
      key: "trigger",
      of: ICON_BUTTON,
      cell: () => ({ variant: "ghost", size: "icon", state: "rest" }),
      properties: () => ({ swap: { Icon: "Info" } }),
      // `Tooltip.Trigger` renders the Button with its own slot and its self focus ring, and Base UI
      // marks it `data-popup-open` while the popup is open.
      slot: "tooltip-trigger",
      classesFor: () => focusRing({ target: "self" }).root(),
      facts: new Map([["data-popup-open", always]]),
      shownIn: always,
      exposed: true,
    },
  ],
  swapProperties: [],
};
