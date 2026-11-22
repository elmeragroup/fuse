/// <reference lib="dom" />
/**
 * The client renderers of the Popover sets, each the docs Basic demo's Popover mounted open on the
 * compare page with its popup in the cell's slot, as `popover-kit.ts` draws it.
 *
 * - `popoverContent`: the popup, measured alone. Its outline Button trigger is the anchor, which the
 *   page hides. Without the arrow the popup aligns to the trigger's start, so it starts on the slot's
 *   pixel grid. With `showArrow` it opens centred on the trigger in a host as wide as the popup, as
 *   `popoverOpen` does, since Base UI points the arrow at the trigger's centre and the capture reads
 *   that offset only where the popup is centred on the trigger.
 * - `popoverOpen`: the trigger and the popup, measured together. It keeps the demo's centered popup
 *   and centers the trigger in a host as wide as the popup, so the popup starts at the slot's start.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Button } from "../../../fuse/dist/button.js";
import { Field } from "../../../fuse/dist/field.js";
import { Input } from "../../../fuse/dist/input.js";
import { Popover } from "../../../fuse/dist/popover.js";
import type { Cell } from "../components/component-spec.ts";
import {
  POPOVER_DESCRIPTION_TEXT,
  POPOVER_FIELD_LABELS,
  POPOVER_TITLE_TEXT,
  POPOVER_TRIGGER_TEXT,
} from "../components/popover-text.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";

/** The docs Basic demo's Popover, open, its popup portalled into `container`, with or without its arrow. */
function basicPopover(container: HTMLElement, align: "start" | "center", showArrow = false) {
  return createElement(
    Popover.Root,
    { defaultOpen: true },
    createElement(
      Popover.Trigger,
      { render: createElement(Button, { variant: "outline" }) },
      POPOVER_TRIGGER_TEXT
    ),
    createElement(
      Popover.Content,
      { container, align, showArrow },
      createElement(
        Popover.Header,
        null,
        createElement(Popover.Title, null, POPOVER_TITLE_TEXT),
        createElement(Popover.Description, null, POPOVER_DESCRIPTION_TEXT)
      ),
      ...POPOVER_FIELD_LABELS.map((label) =>
        createElement(
          Field.Root,
          { key: label },
          createElement(Field.Label, null, label),
          // The demo's input holds no value. An empty `defaultValue` draws the same and writes the
          // empty `value` the build reads the Input's empty text from.
          createElement(Input, { defaultValue: "" })
        )
      )
    )
  );
}

/** A host as wide as the popup, which centers the trigger in it, so the centered popup starts at its start. */
const HOST = "flex w-72 justify-center";

/** The open Popover's popup, with its arrow where the cell's `showArrow` is `true`. */
export const popoverContent: ClientCellRendering = {
  hostClasses: HOST.split(" "),
  element: (cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    cell.showArrow === "true"
      ? createElement("div", { className: HOST }, basicPopover(container, "center", true))
      : basicPopover(container, "start"),
};

/** The open Popover, its trigger and its popup. */
export const popoverOpen: ClientCellRendering = {
  hostClasses: HOST.split(" "),
  element: (_cell: Cell, _turnedOn: ReadonlySet<string>, container: HTMLElement) =>
    createElement("div", { className: HOST }, basicPopover(container, "center")),
  union: ["popover-trigger", "popover-content"],
};
