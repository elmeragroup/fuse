/**
 * Alert dialog, as two component sets on a page of their own: the popup the docs demos open, and that
 * popup open over the scrim.
 *
 * - `Alert dialog content` is the popup, `AlertDialog.Content`'s Dialog popup, `<div role="alertdialog"
 *   data-slot="dialog-content">` with `dialogContentVariants({ size: "md" })`, destructive, neutral and
 *   pending: 3 cells. It is fixed in the viewport (`ALERT_DIALOG_VIEWPORT`), as wide as
 *   `min(28rem, 90%)` of it, 448px, padded `surface-pad-lg`, rounded `radius-xl`, on the `dialog`
 *   fill with the modal edge, its rows `gap-6` apart. It holds:
 *   - the header row, `justify-between items-start gap-4`: the title, 20px Medium on a 28px line, and
 *     the title line, a box one title line tall, 28px (`--text-xl` × `--text-xl--line-height`, theme
 *     constants, one length in every mode), holding the 20px icon centred: WarningOctagon in `error`
 *     for a destructive dialog, Info for a neutral one;
 *   - the description, muted 14px copy;
 *   - the footer row, `sm:flex-row sm:justify-end gap-2`, holding the ghost small Cancel and the small
 *     action Button, destructive or default, pending in the pending cell.
 *   The copy is the docs demos', which differs by cell, so no TEXT property sets it (one property
 *   holds one default); the action's label is the Button instance's own. The icon differs by cell too,
 *   so no swap property picks it.
 * - `Alert dialog (open)` is the destructive popup over the scrim, `Dialog.Backdrop`'s
 *   `fixed inset-0` overlay, which fills the viewport with `black/10` and blurs what lies behind it.
 *   Base UI centres the fixed popup in the viewport (`top-1/2 left-1/2` and the translates), so the
 *   composite is the scrim, centring the popup's instance.
 */
import {
  alertDialogVariants,
  cn,
  dialogContentVariants,
  dialogVariants,
} from "@elmeragroup/fuse/recipe-catalog";

import { CANCEL_LABEL, ALERT_DIALOG_VIEWPORT, alertDialogCopy } from "./alert-dialog-text";
import { BUTTON } from "./button-kit";
import type {
  Cell,
  ComponentDefinition,
  IconSlot,
  InstanceDefinition,
  PartDefinition,
} from "./component-spec";
import { userAgentDisplay } from "./element-defaults";
import { always, never } from "./popup-facts";

const dialog = dialogVariants();

/** The alert dialog's look for a cell: the pending cell is a destructive dialog whose action is pending. */
const alertSlots = (cell: Cell) =>
  alertDialogVariants({ variant: cell.variant === "neutral" ? "neutral" : "destructive" });

/** The fallback icon a cell's title line holds: WarningOctagon for a destructive dialog, Info for a neutral one. */
function titleIcon(cell: Cell): IconSlot {
  return {
    key: "icon",
    name: "Icon",
    side: "start",
    direct: true,
    dataIcon: undefined,
    icon: cell.variant === "neutral" ? "Info" : "WarningOctagon",
    swapProperty: undefined,
    classes: alertSlots(cell).icon(),
  };
}

/** The title, Base UI's `<h2>`. */
const TITLE: PartDefinition = {
  key: "title",
  slot: "dialog-title",
  shownIn: always,
  classesFor: (cell) => cn(dialog.title(), alertSlots(cell).title()),
  elementDefaults: userAgentDisplay("h2"),
  label: {
    key: "text",
    name: "text",
    charactersFor: (cell) => alertDialogCopy(cell.variant).title,
    shownIn: always,
  },
  iconsFor: () => [],
};

/** The title line beside the title, one title line tall, around the icon. */
const TITLE_LINE: PartDefinition = {
  key: "title-line",
  slot: undefined,
  element: { tag: "div", attributes: { class: alertDialogVariants().titleLine() } },
  shownIn: always,
  classesFor: (cell) => alertSlots(cell).titleLine(),
  // It holds the icon, so `empty:hidden` never hides it.
  facts: new Map([["empty", never]]),
  label: undefined,
  iconsFor: (cell) => [titleIcon(cell)],
};

/** The header row: the title, then the title line at its end. */
const HEADER: PartDefinition = {
  key: "header",
  slot: "dialog-header",
  shownIn: always,
  classesFor: (cell) => cn(dialog.header(), alertSlots(cell).header()),
  label: undefined,
  iconsFor: () => [],
  parts: [TITLE, TITLE_LINE],
};

/** The description, Base UI's `<p>`. */
const DESCRIPTION: PartDefinition = {
  key: "description",
  slot: "dialog-description",
  shownIn: always,
  classesFor: () => dialog.description(),
  elementDefaults: userAgentDisplay("p"),
  label: {
    key: "text",
    name: "text",
    charactersFor: (cell) => alertDialogCopy(cell.variant).description,
    shownIn: always,
  },
  iconsFor: () => [],
};

/** The ghost small Cancel, `AlertDialog.Close` rendering a Button. */
const CANCEL: InstanceDefinition = {
  kind: "instance",
  key: "cancel",
  of: BUTTON,
  element: { tag: "button", attributes: { "data-dialog-action-type": "secondary" } },
  cell: () => ({ variant: "ghost", size: "sm", state: "rest", icon: "none" }),
  properties: () => ({ text: { Label: CANCEL_LABEL } }),
  shownIn: always,
  exposed: true,
};

/** The small action Button: destructive or default, pending in the pending cell. */
const ACTION: InstanceDefinition = {
  kind: "instance",
  key: "action",
  of: BUTTON,
  element: { tag: "button", attributes: { "data-dialog-action-type": "primary" } },
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

/** The footer row: Cancel, then the action. */
const FOOTER: PartDefinition = {
  key: "footer",
  slot: "dialog-footer",
  shownIn: always,
  classesFor: () => dialog.footer(),
  label: undefined,
  iconsFor: () => [],
  parts: [CANCEL, ACTION],
};

/** The open popup, as `<AlertDialog.Content>` in the docs Destructive and Neutral demos, and pending. */
export const ALERT_DIALOG_CONTENT: ComponentDefinition = {
  key: "alert-dialog-content",
  name: "Alert dialog content",
  slot: "dialog-content",
  axes: [{ name: "variant", values: ["destructive", "neutral", "pending"] }],
  columnAxis: "variant",
  classesFor: () => dialogContentVariants({ size: "md" }),
  // Its width and height cap read the viewport it is fixed in.
  viewport: ALERT_DIALOG_VIEWPORT,
  states: {},
  // Base UI stamps an open popup `data-open`.
  facts: new Map([
    ["data-open", always],
    ["data-closed", never],
  ]),
  // The popup takes focus only while a keyboard user lands on it, and the kit draws it at rest.
  omittedStates: new Set(["focus-visible"]),
  omittedCompositions: new Map([
    ["*", "`*:[a]:` underlines and darkens a link inside the description, and the demos' copy holds none"],
  ]),
  label: undefined,
  iconsFor: () => [],
  parts: [HEADER, DESCRIPTION, FOOTER],
  swapProperties: [],
};

/**
 * The open Alert dialog: the destructive popup over the scrim. The composite is the scrim, fixed over
 * the viewport, and centres the popup's instance where Base UI's fixed centring puts it.
 */
export const ALERT_DIALOG_OPEN: ComponentDefinition = {
  key: "alert-dialog-open",
  name: "Alert dialog (open)",
  slot: "alert-dialog-open",
  axes: [{ name: "placement", values: ["centered"] }],
  columnAxis: "placement",
  classesFor: () => cn(dialog.overlay(), "flex items-center justify-center"),
  viewport: ALERT_DIALOG_VIEWPORT,
  states: {},
  facts: new Map([
    ["data-open", always],
    ["data-closed", never],
  ]),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "content",
      of: ALERT_DIALOG_CONTENT,
      cell: () => ({ variant: "destructive" }),
      shownIn: always,
    },
  ],
  swapProperties: [],
};
