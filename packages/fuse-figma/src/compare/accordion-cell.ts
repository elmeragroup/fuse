/**
 * The renderer of the `accordion-item` set: each cell as one real Fuse `Accordion.Item` in an
 * `Accordion.Root` of the cell's variant and radius, in a host as wide as the kit's preview width,
 * which the root and the item fill as blocks. The item holds the docs Basic demo's first trigger
 * and panel.
 *
 * - `open=on` names the item in the root's `defaultValue`, so Base UI opens it without interaction:
 *   it marks the trigger `data-panel-open` and `aria-expanded="true"`, and mounts the panel with
 *   `--accordion-panel-height: auto`. A closed item renders no panel.
 * - `disabled` sets the item's `disabled`, which Base UI passes to the trigger as the native
 *   `disabled` and `data-disabled`. The page forces hover and focus on the trigger.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Accordion } from "../../../fuse/dist/accordion.js";
import {
  ACCORDION_CONTENT_TEXT,
  ACCORDION_PREVIEW_WIDTH,
  ACCORDION_TRIGGER_TEXT,
  accordionLook,
} from "../components/accordion-kit.ts";
import type { Cell } from "../components/component-spec.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The item's value, which the root's `defaultValue` names to open it. */
const ITEM = "shipping";

/** An `accordion-item` cell: the Basic demo's first item, closed or open, at rest or disabled. */
export const accordionItem: CellRendering = {
  element: (cell: Cell) => {
    const look = accordionLook(cell);
    return createElement(
      "div",
      { style: { width: `${ACCORDION_PREVIEW_WIDTH}px` } },
      createElement(
        Accordion.Root,
        { variant: look.variant, radius: look.radius, defaultValue: look.open ? [ITEM] : [] },
        createElement(
          Accordion.Item,
          { value: ITEM, disabled: cell.state === "disabled" },
          createElement(
            Accordion.Header,
            null,
            createElement(Accordion.Trigger, null, ACCORDION_TRIGGER_TEXT)
          ),
          createElement(Accordion.Content, null, ACCORDION_CONTENT_TEXT)
        )
      )
    );
  },
};
