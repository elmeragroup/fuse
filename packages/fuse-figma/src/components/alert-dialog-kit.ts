/**
 * Alert dialog, as two component sets on a page of their own: the popup the docs demos open, and that
 * popup open over the scrim.
 *
 * - `Alert dialog content` is the popup, `AlertDialog.Content`'s Dialog popup, `<div role="alertdialog"
 *   data-slot="dialog-content">`, destructive, neutral and pending: 3 cells. It is fixed in the
 *   viewport (`ALERT_DIALOG_VIEWPORT`). It holds:
 *   - the header row: the title, and the title line, a box one title line tall holding the icon:
 *     WarningOctagon for a destructive dialog, Info for a neutral one;
 *   - the description, muted copy;
 *   - the footer row, holding the ghost small Cancel and the small action Button, destructive or
 *     default, pending in the pending cell.
 *   The copy is the docs demos', which differs by cell, so no TEXT property sets it (one property
 *   holds one default); the action's label is the Button instance's own. The icon differs by cell too,
 *   so no swap property picks it.
 * - `Alert dialog (open)` is the destructive popup over the scrim, `Dialog.Backdrop`'s overlay, which
 *   fills the viewport the popup is fixed in.
 */
import type { IconManifest, InstanceManifest, SetManifest } from "../capture/manifest";
import { CANCEL_LABEL, ALERT_DIALOG_VIEWPORT, alertDialogCopy } from "./alert-dialog-text";
import { BUTTON_MANIFEST } from "./button-kit";
import type { Cell } from "./component-spec";
import { dialogDescriptionManifest, dialogFooterManifest, dialogTitleManifest } from "./dialog-frame-kit";
import { always } from "./popup-facts";

/** The fallback icon a cell's title line holds: WarningOctagon for a destructive dialog, Info for a neutral one. */
function titleIcon(cell: Cell): IconManifest {
  return {
    key: "icon",
    name: "Icon",
    side: "start",
    direct: true,
    dataIcon: undefined,
    icon: cell.variant === "neutral" ? "Info" : "WarningOctagon",
    swapProperty: undefined,
  };
}

/** The ghost small Cancel, `AlertDialog.Close` rendering a Button. */
const CANCEL_MANIFEST: InstanceManifest = {
  kind: "instance",
  key: "cancel",
  of: BUTTON_MANIFEST,
  cell: () => ({ variant: "ghost", size: "sm", state: "rest", icon: "none" }),
  properties: () => ({ text: { Label: CANCEL_LABEL } }),
  shownIn: always,
  exposed: true,
};

/** The small action Button: destructive or default, pending in the pending cell. */
const ACTION_MANIFEST: InstanceManifest = {
  kind: "instance",
  key: "action",
  of: BUTTON_MANIFEST,
  cell: (outer) => ({
    variant: outer.variant === "neutral" ? "default" : "destructive",
    size: "sm",
    state: outer.variant === "pending" ? "pending" : "rest",
    icon: "none",
  }),
  properties: (outer) => ({ text: { Label: alertDialogCopy(outer.variant).action } }),
  shownIn: always,
  exposed: true,
};

/** The popup's manifest, which the capture-backed build reads with `captures/alert-dialog-content.json`. */
export const ALERT_DIALOG_CONTENT_MANIFEST: SetManifest = {
  key: "alert-dialog-content",
  name: "Alert dialog content",
  slot: "dialog-content",
  axes: [{ name: "variant", values: ["destructive", "neutral", "pending"] }],
  columnAxis: "variant",
  viewport: ALERT_DIALOG_VIEWPORT,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "header",
      slot: "dialog-header",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        dialogTitleManifest((cell) => alertDialogCopy(cell.variant).title),
        {
          key: "title-line",
          slot: undefined,
          place: "dialog-header/1",
          shownIn: always,
          label: undefined,
          iconsFor: (cell) => [titleIcon(cell)],
        },
      ],
    },
    dialogDescriptionManifest((cell) => alertDialogCopy(cell.variant).description),
    dialogFooterManifest([CANCEL_MANIFEST, ACTION_MANIFEST]),
  ],
  swapProperties: [],
};

/**
 * The open Alert dialog's manifest, which the capture-backed build reads with
 * `captures/alert-dialog-open.json`: the Backdrop and the popup over it, in the viewport the popup is
 * fixed in.
 */
export const ALERT_DIALOG_OPEN_MANIFEST: SetManifest = {
  key: "alert-dialog-open",
  name: "Alert dialog (open)",
  slot: "alert-dialog-open",
  axes: [{ name: "placement", values: ["centered"] }],
  columnAxis: "placement",
  viewport: ALERT_DIALOG_VIEWPORT,
  union: ["dialog-overlay", "dialog-content"],
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "content",
      of: ALERT_DIALOG_CONTENT_MANIFEST,
      cell: () => ({ variant: "destructive" }),
      shownIn: always,
    },
  ],
  swapProperties: [],
};
