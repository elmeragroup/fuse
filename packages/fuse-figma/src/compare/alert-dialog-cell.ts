/// <reference lib="dom" />
/**
 * The client renderers of the Alert dialog sets, each the docs demo's AlertDialog mounted open on the
 * compare page in a host as large as the viewport the definitions declare, its popup and scrim
 * portalled into that host, which is their containing block, as `viewport-host.ts` says.
 *
 * - `alertDialogContent`: the popup, measured alone, destructive, neutral or pending; the page hides
 *   the scrim.
 * - `alertDialogOpen`: the destructive popup over the scrim, measured together, the scrim as large as
 *   the viewport.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { AlertDialog } from "../../../fuse/dist/alert-dialog.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import { ALERT_DIALOG_VIEWPORT, alertDialogCopy } from "../components/alert-dialog-text.ts";
import type { Cell } from "../components/component-spec.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";
import { viewportHost } from "./viewport-host.ts";

/** The docs demo's AlertDialog, open, in a cell's variant: destructive, neutral, or destructive and pending. */
function openAlertDialog(cell: Cell) {
  const copy = alertDialogCopy(cell.variant);
  return viewportHost(ALERT_DIALOG_VIEWPORT, (host) =>
    createElement(LocaleProvider, {
      locale: "en-US",
      children: createElement(AlertDialog.Root, {
        defaultOpen: true,
        children: createElement(AlertDialog.Content, {
          container: host,
          variant: cell.variant === "neutral" ? "neutral" : "destructive",
          title: copy.title,
          actionLabel: copy.action,
          isPerformingAction: cell.variant === "pending",
          children: copy.description,
        }),
      }),
    })
  );
}

/** The open Alert dialog's popup. */
export const alertDialogContent: ClientCellRendering = {
  element: (cell: Cell) => openAlertDialog(cell),
};

/** The open Alert dialog, its scrim and its popup. */
export const alertDialogOpen: ClientCellRendering = {
  element: () => openAlertDialog({ variant: "destructive" }),
  union: ["dialog-overlay", "dialog-content"],
};
