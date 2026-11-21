/// <reference lib="dom" />
/**
 * The client renderers of the Sheet sets, each the docs "No close button" demo's Sheet mounted open
 * on the right side at the md size, in a host as large as the viewport the definitions declare, its
 * panel and scrim portalled into that host, which is their containing block, as `viewport-host.ts`
 * says.
 *
 * - `sheetContent`: the panel, with `showCloseButton` on only where the `Close button` property is,
 *   measured alone; the page hides the scrim.
 * - `sheetOpen`: the panel over the scrim, with the corner close the docs default demo shows,
 *   measured together, the scrim as large as the viewport. Its host clips the panel's shadow where
 *   it falls past the viewport, as the browser window does and as the built Figma frame clips it.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Button } from "../../../fuse/dist/button.js";
import { Sheet } from "../../../fuse/dist/sheet.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import {
  SHEET_CLOSE_LABEL,
  SHEET_CORNER_CLOSE_PROPERTY,
  SHEET_DESCRIPTION,
  SHEET_TITLE,
  SHEET_VIEWPORT,
} from "../components/sheet-text.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";
import { viewportHost } from "./viewport-host.ts";

/**
 * The demo's Sheet, open, with the corner close where `turnedOn` names its property, in a host that
 * clips what paints past it where `overflow` is `clip`.
 */
function openSheet(turnedOn: ReadonlySet<string>, overflow: "visible" | "clip") {
  return viewportHost(
    SHEET_VIEWPORT,
    (host) =>
      createElement(LocaleProvider, {
        locale: "en-US",
        children: createElement(Sheet.Root, {
          defaultOpen: true,
          children: createElement(Sheet.Content, {
            container: host,
            showCloseButton: turnedOn.has(SHEET_CORNER_CLOSE_PROPERTY),
            children: [
              createElement(Sheet.Header, {
                key: "header",
                children: [
                  createElement(Sheet.Title, { key: "title", children: SHEET_TITLE }),
                  createElement(Sheet.Description, { key: "description", children: SHEET_DESCRIPTION }),
                ],
              }),
              createElement(Sheet.Footer, {
                key: "footer",
                children: createElement(Sheet.Close, {
                  render: createElement(Button, { variant: "outline" }),
                  children: SHEET_CLOSE_LABEL,
                }),
              }),
            ],
          }),
        }),
      }),
    { overflow }
  );
}

/** The open Sheet's panel. */
export const sheetContent: ClientCellRendering = {
  element: (_cell, turnedOn) => openSheet(turnedOn, "visible"),
};

/** The open Sheet, its scrim and its panel. */
export const sheetOpen: ClientCellRendering = {
  element: () => openSheet(new Set([SHEET_CORNER_CLOSE_PROPERTY]), "clip"),
  union: ["sheet-overlay", "sheet-content"],
};
