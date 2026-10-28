/**
 * Dialog, as two component sets on a page of their own: the popup the docs Basic and Footer close
 * demos open, and the Basic popup open over the scrim.
 *
 * - `Dialog content` is `Dialog.Content`'s popup, `<div data-slot="dialog-content">` with
 *   `dialogContentVariants({ size: "md" })`, basic and with the footer close: 2 cells. It is fixed in
 *   Alert dialog's viewport (`DIALOG_VIEWPORT`), 448px wide, padded `surface-pad-lg`, rounded
 *   `radius-xl` on the `dialog` fill with the modal edge, its rows 24px apart. It holds:
 *   - the header, the title, 20px Medium on a 28px line, over the muted description, 8px apart;
 *   - the footer row, `sm:flex-row sm:justify-end gap-2`: the Basic demo's outline Cancel, the
 *     `Dialog.Close` that carries the `dialog-close` slot, and the default Move reading; or the Footer
 *     close demo's default Cancel contract and the outline Close `showCloseButton` appends;
 *   - the corner close, `Dialog.Close` rendering the ghost `icon-sm` Icon button with X at
 *     `absolute top-4 right-4`, 16px from the popup's end and 16px below its top, which MAX across
 *     and MIN down keep (U10, W5-P12), also in the open composite's popup instance and through a
 *     density switch, since the Icon button's main is auto layout (W5-P14, W5-P14b). Its
 *     `hit-area-1` grows its hit target with an invisible `::before`, which draws nothing.
 *   The copy differs by cell, so no TEXT property sets the title or the description.
 * - `Dialog (open)` is the Basic popup over the scrim, `Dialog.Backdrop`'s `fixed inset-0` overlay,
 *   which fills the viewport with `black/10` and blurs what lies behind it, centring the popup's
 *   instance where Base UI's fixed centring puts it.
 */
import { cn, dialogVariants, overlayCornerCloseClass } from "@elmeragroup/fuse/recipe-catalog";

import { BUTTON, ICON_BUTTON } from "./button-kit";
import type { ComponentDefinition, InstanceDefinition, PartDefinition } from "./component-spec";
import { DIALOG_CONTENT_SET, dialogDescription, dialogFooter, dialogTitle } from "./dialog-frame-kit";
import {
  BASIC_COPY,
  CORNER_CLOSE_LABEL,
  DIALOG_VIEWPORT,
  FOOTER_CLOSE_COPY,
  dialogCopy,
} from "./dialog-text";
import type { DialogCopy } from "./dialog-text";
import { OPEN_FACTS, always } from "./popup-facts";

const dialog = dialogVariants();

/** The header, the title over the description. */
const HEADER: PartDefinition = {
  key: "header",
  slot: "dialog-header",
  shownIn: always,
  classesFor: () => dialog.header(),
  label: undefined,
  iconsFor: () => [],
  parts: [
    dialogTitle((cell) => dialogCopy(cell.content).title),
    dialogDescription((cell) => dialogCopy(cell.content).description),
  ],
};
/**
 * One footer action of a demo, shown in that demo's cell: the Basic demo's `Dialog.Close` outline
 * Cancel carries the `dialog-close` slot, and every other action Button's own `button` slot.
 */
function footerAction(
  content: "basic" | "footer-close",
  action: DialogCopy["actions"][number],
  slot: "dialog-close" | undefined
): InstanceDefinition {
  const key = action.label.toLowerCase().replaceAll(" ", "-");
  const own: InstanceDefinition = {
    kind: "instance",
    key: `${content}-${key}`,
    of: BUTTON,
    cell: () => ({ variant: action.variant, size: "default", state: "rest", icon: "none" }),
    properties: () => ({ text: { Label: action.label } }),
    shownIn: (cell) => cell.content === content,
    exposed: true,
  };
  return slot === undefined ? own : { ...own, slot };
}

const [CANCEL, MOVE] = BASIC_COPY.actions;
const [CANCEL_CONTRACT, CLOSE] = FOOTER_CLOSE_COPY.actions;

/** The footer row of the demo's actions. */
const FOOTER = dialogFooter([
  footerAction("basic", CANCEL, "dialog-close"),
  footerAction("basic", MOVE, undefined),
  footerAction("footer-close", CANCEL_CONTRACT, undefined),
  footerAction("footer-close", CLOSE, undefined),
]);

/** The corner close, the ghost `icon-sm` Icon button with X, `Dialog.Close` at the popup's top right. */
const CORNER_CLOSE: InstanceDefinition = {
  kind: "instance",
  key: "close",
  of: ICON_BUTTON,
  slot: "dialog-close",
  element: { tag: "button", attributes: { "aria-label": CORNER_CLOSE_LABEL } },
  cell: () => ({ variant: "ghost", size: "icon-sm", state: "rest" }),
  classesFor: () => cn("hit-area-1", overlayCornerCloseClass),
  properties: () => ({ swap: { Icon: "X" } }),
  shownIn: always,
  exposed: true,
};

/** The open popup, as `<Dialog.Content>` in the docs Basic and Footer close demos. */
export const DIALOG_CONTENT: ComponentDefinition = {
  ...DIALOG_CONTENT_SET,
  key: "dialog-content",
  name: "Dialog content",
  axes: [{ name: "content", values: ["basic", "footer-close"] }],
  columnAxis: "content",
  // Its width and height cap read the viewport it is fixed in.
  viewport: DIALOG_VIEWPORT,
  parts: [HEADER, FOOTER, CORNER_CLOSE],
};

/**
 * The open Dialog: the Basic popup over the scrim. The composite is the scrim, fixed over the
 * viewport, and centres the popup's instance where Base UI's fixed centring puts it.
 */
export const DIALOG_OPEN: ComponentDefinition = {
  key: "dialog-open",
  name: "Dialog (open)",
  slot: "dialog-open",
  axes: [{ name: "placement", values: ["centered"] }],
  columnAxis: "placement",
  classesFor: () => cn(dialog.overlay(), "flex items-center justify-center"),
  viewport: DIALOG_VIEWPORT,
  states: {},
  facts: OPEN_FACTS,
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "content",
      of: DIALOG_CONTENT,
      cell: () => ({ content: "basic" }),
      shownIn: always,
    },
  ],
  swapProperties: [],
};
