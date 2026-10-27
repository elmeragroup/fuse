/**
 * The docs Alert dialog demos' copy, free of imports for the client bundle, which
 * `alert-dialog-kit.ts` draws and `compare/alert-dialog-cell.ts` renders: the Destructive demo's for
 * the destructive and pending cells, since that demo goes pending while it deletes, and the Neutral
 * demo's for the neutral cell.
 */

/** The copy of one Alert dialog cell. */
export type AlertDialogCopy = {
  readonly title: string;
  readonly description: string;
  readonly action: string;
};

/** The Destructive demo's copy. */
export const DESTRUCTIVE_COPY: AlertDialogCopy = {
  title: "Delete order?",
  description: "This permanently removes the order and cannot be undone.",
  action: "Delete",
};

/** The Neutral demo's copy. */
export const NEUTRAL_COPY: AlertDialogCopy = {
  title: "Archive this meter?",
  description: "Readings stay in history. The meter leaves the active list.",
  action: "Archive",
};

/** The cancel button's label, the en-US dictionary's `alertDialog.cancel`. */
export const CANCEL_LABEL = "Cancel";

/**
 * The viewport the open example and the popup sit in: 640px wide, the narrowest where the popup reaches
 * its full `--overlay-width`, `min(28rem, 90%)`, 448px once 90% of the width is 448px or more, and
 * where the footer's `sm:` row holds, from 640px. 448px tall, the tallest the compare page's 464px
 * slots hold with their 8px crop padding, which leaves the popup's `max-h-[calc(100%-2rem)]`, 416px,
 * far above the popup's 160 to 180px.
 */
export const ALERT_DIALOG_VIEWPORT = { width: 640, height: 448 } as const;

/** The copy of a cell by its variant. */
export function alertDialogCopy(variant: string | undefined): AlertDialogCopy {
  return variant === "neutral" ? NEUTRAL_COPY : DESTRUCTIVE_COPY;
}
