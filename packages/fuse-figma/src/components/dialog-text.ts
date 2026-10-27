/**
 * The docs Dialog demos' copy, free of imports for the client bundle, which `dialog-kit.ts` draws and
 * `compare/dialog-cell.ts` renders: the Basic demo's and the Footer close demo's.
 */

import { ALERT_DIALOG_VIEWPORT } from "./alert-dialog-text";

/** The copy of one Dialog cell: the title, the description and the footer's actions in order. */
export type DialogCopy = {
  readonly title: string;
  readonly description: string;
  readonly actions: readonly { readonly label: string; readonly variant: "outline" | "default" }[];
};

/** The Basic demo's copy: an outline Cancel, `Dialog.Close`, then the default action. */
export const BASIC_COPY: DialogCopy = {
  title: "Move the meter reading",
  description: "The reading is copied to the new address and the old contract is closed.",
  actions: [
    { label: "Cancel", variant: "outline" },
    { label: "Move reading", variant: "default" },
  ],
};

/** The Footer close demo's copy: the default action, then the outline Close `showCloseButton` adds. */
export const FOOTER_CLOSE_COPY: DialogCopy = {
  title: "Cancel the contract",
  description: "The contract ends on the last day of the current notice period.",
  actions: [
    { label: "Cancel contract", variant: "default" },
    { label: "Close", variant: "outline" },
  ],
};

/** The corner close's accessible name, the en-US dictionary's `overlay.close`. */
export const CORNER_CLOSE_LABEL = "Close";

/**
 * The viewport the Dialog popup and its open example sit in: Alert dialog's, since Dialog reads the
 * same `w-full max-w-(--overlay-width) max-h-[calc(100%-2rem)]` at the md size and the same `sm:` footer.
 */
export const DIALOG_VIEWPORT = ALERT_DIALOG_VIEWPORT;

/** The copy of a cell by its content. */
export function dialogCopy(content: string | undefined): DialogCopy {
  return content === "footer-close" ? FOOTER_CLOSE_COPY : BASIC_COPY;
}
