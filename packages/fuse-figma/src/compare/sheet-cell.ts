/// <reference lib="dom" />
/**
 * The client renderer of the `sheet-content` set: the docs "No close button" demo's Sheet mounted
 * open on the right side at the md size, with `showCloseButton={false}`, in a host as large as the
 * viewport the definition declares, its panel and scrim portalled into that host, which is their
 * containing block, as `viewport-host.ts` says. The page measures the panel alone and hides the scrim.
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
  SHEET_DESCRIPTION,
  SHEET_TITLE,
  SHEET_VIEWPORT,
} from "../components/sheet-text.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";
import { viewportHost } from "./viewport-host.ts";

/** The demo's Sheet, open. */
function openSheet() {
  return viewportHost(SHEET_VIEWPORT, (host) =>
    createElement(LocaleProvider, {
      locale: "en-US",
      children: createElement(Sheet.Root, {
        defaultOpen: true,
        children: createElement(Sheet.Content, {
          container: host,
          showCloseButton: false,
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
    })
  );
}

/** The open Sheet's panel. */
export const sheetContent: ClientCellRendering = {
  element: () => openSheet(),
};
