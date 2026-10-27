/// <reference lib="dom" />
/**
 * The client renderers of the Dialog sets, each the docs Basic or Footer close demo's Dialog mounted
 * open on the compare page in a host as large as the viewport the definitions declare, its popup and
 * scrim portalled into that host, which is their containing block, as `viewport-host.ts` says.
 *
 * - `dialogContent`: the popup, measured alone, basic or with the footer close; the page hides the
 *   scrim.
 * - `dialogOpen`: the Basic popup over the scrim, measured together, the scrim as large as the viewport.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Button } from "../../../fuse/dist/button.js";
import { Dialog } from "../../../fuse/dist/dialog.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import type { Cell } from "../components/component-spec.ts";
import { DIALOG_VIEWPORT, dialogCopy } from "../components/dialog-text.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";
import { viewportHost } from "./viewport-host.ts";

/** The footer of a demo: the Basic demo's `Dialog.Close` Cancel and action, or the Footer close demo's action and appended Close. */
function footer(content: string | undefined) {
  const [first, second] = dialogCopy(content).actions;
  if (content === "footer-close") {
    return createElement(Dialog.Footer, {
      key: "footer",
      showCloseButton: true,
      children: createElement(Button, { children: first?.label }),
    });
  }
  return createElement(Dialog.Footer, {
    key: "footer",
    children: [
      createElement(Dialog.Close, {
        key: "cancel",
        render: createElement(Button, { variant: "outline" }),
        children: first?.label,
      }),
      createElement(Button, { key: "action", children: second?.label }),
    ],
  });
}

/** The demo's Dialog, open, in a cell's content. */
function openDialog(cell: Cell) {
  const copy = dialogCopy(cell.content);
  return viewportHost(DIALOG_VIEWPORT, (host) =>
    createElement(LocaleProvider, {
      locale: "en-US",
      children: createElement(Dialog.Root, {
        defaultOpen: true,
        children: createElement(Dialog.Content, {
          container: host,
          children: [
            createElement(Dialog.Header, {
              key: "header",
              children: [
                createElement(Dialog.Title, { key: "title", children: copy.title }),
                createElement(Dialog.Description, { key: "description", children: copy.description }),
              ],
            }),
            footer(cell.content),
          ],
        }),
      }),
    })
  );
}

/** The open Dialog's popup. */
export const dialogContent: ClientCellRendering = {
  element: (cell: Cell) => openDialog(cell),
};

/** The open Dialog, its scrim and its Basic popup. */
export const dialogOpen: ClientCellRendering = {
  element: () => openDialog({ content: "basic" }),
  union: ["dialog-overlay", "dialog-content"],
};
