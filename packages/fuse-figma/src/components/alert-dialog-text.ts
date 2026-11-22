/**
 * The docs Alert dialog demos' copy, free of imports for the client bundle, which
 * `alert-dialog-kit.ts` draws and `compare/alert-dialog-cell.ts` renders: the Destructive demo's for
 * the destructive cells and the Neutral demo's for the neutral ones.
 */

/** The copy of one Alert dialog cell. */
type AlertDialogCopy = {
  readonly title: string;
  readonly description: string;
  readonly action: string;
};

/** The Destructive demo's copy. */
const DESTRUCTIVE_COPY: AlertDialogCopy = {
  title: "Delete order?",
  description: "This permanently removes the order and cannot be undone.",
  action: "Delete",
};

/** The Neutral demo's copy. */
const NEUTRAL_COPY: AlertDialogCopy = {
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

/**
 * The popup sizes the Dialog and Alert dialog content sets draw, `md` first, the size
 * `Dialog.Content` takes by default and `AlertDialog.Content` passes on. Each sets `--overlay-width`
 * to `min(<container>, 90%)`, so in the 640px viewport `sm` draws 384px, `md` 448px, `lg` 512px and
 * `xl` 576px. Every size from `2xl` up reaches the 576px cap there too, so the sets leave them out.
 */
export const DIALOG_SIZES = ["md", "sm", "lg", "xl"] as const;

/** A popup size the content sets draw, as `Dialog.Content`'s and `AlertDialog.Content`'s `size` take it. */
export type DialogSize = (typeof DIALOG_SIZES)[number];

/**
 * A cell's popup size.
 *
 * @param cell - A `dialog-content` or `alert-dialog-content` cell.
 * @returns The size its `size` axis names.
 * @throws When the cell names no size the sets draw, a defect in the caller's cell.
 */
export function dialogSize(cell: { readonly size?: string | undefined }): DialogSize {
  const size = DIALOG_SIZES.find((each) => each === cell.size);
  if (size === undefined) {
    throw new Error(`Dialog content has no size ${cell.size ?? ""}`);
  }
  return size;
}

/** The copy of a cell by its variant. */
export function alertDialogCopy(variant: string | undefined): AlertDialogCopy {
  return variant === "neutral" ? NEUTRAL_COPY : DESTRUCTIVE_COPY;
}
