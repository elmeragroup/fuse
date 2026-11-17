/**
 * Dialog, as two component sets on a page of their own: the popup the docs Basic and Footer close
 * demos open, and the Basic popup open over the scrim.
 *
 * - `Dialog content` is `Dialog.Content`'s popup, `<div data-slot="dialog-content">`, basic and with
 *   the footer close: 2 cells. It is fixed in Alert dialog's viewport (`DIALOG_VIEWPORT`). It holds:
 *   - the header, the title over the muted description;
 *   - the footer row: the Basic demo's outline Cancel, the `Dialog.Close` that carries the
 *     `dialog-close` slot, and the default Move reading; or the Footer close demo's default Cancel
 *     contract and the outline Close `showCloseButton` appends;
 *   - the corner close, `Dialog.Close` rendering the ghost `icon-sm` Icon button with X at the
 *     popup's top right.
 *   The copy differs by cell, so no TEXT property sets the title or the description.
 * - `Dialog (open)` is the Basic popup over the scrim, `Dialog.Backdrop`'s overlay, which fills the
 *   viewport the popup is fixed in.
 */
import type { InstanceManifest, SetManifest } from "../capture/manifest";
import { BUTTON_MANIFEST, ICON_BUTTON_MANIFEST } from "./button-kit";
import { dialogDescriptionManifest, dialogFooterManifest, dialogTitleManifest } from "./dialog-frame-kit";
import { BASIC_COPY, DIALOG_VIEWPORT, FOOTER_CLOSE_COPY, dialogCopy } from "./dialog-text";
import type { DialogCopy } from "./dialog-text";
import { always } from "./popup-facts";

const [CANCEL, MOVE] = BASIC_COPY.actions;
const [CANCEL_CONTRACT, CLOSE] = FOOTER_CLOSE_COPY.actions;

/**
 * One footer action of a demo, shown in that demo's cell. The Basic demo's `Dialog.Close` outline
 * Cancel carries the `dialog-close` slot, and every other action carries Button's own `button` slot.
 */
function footerActionManifest(
  content: "basic" | "footer-close",
  action: DialogCopy["actions"][number],
  slot: "dialog-close" | undefined
): InstanceManifest {
  const key = action.label.toLowerCase().replaceAll(" ", "-");
  const own: InstanceManifest = {
    kind: "instance",
    key: `${content}-${key}`,
    of: BUTTON_MANIFEST,
    cell: () => ({ variant: action.variant, size: "default", state: "rest", icon: "none" }),
    properties: () => ({ text: { Label: action.label } }),
    shownIn: (cell) => cell.content === content,
    exposed: true,
  };
  return slot === undefined ? own : { ...own, slot };
}

/** The popup's manifest, which the capture-backed build reads with `captures/dialog-content.json`. */
export const DIALOG_CONTENT_MANIFEST: SetManifest = {
  key: "dialog-content",
  name: "Dialog content",
  slot: "dialog-content",
  axes: [{ name: "content", values: ["basic", "footer-close"] }],
  columnAxis: "content",
  viewport: DIALOG_VIEWPORT,
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
        dialogTitleManifest((cell) => dialogCopy(cell.content).title),
        dialogDescriptionManifest((cell) => dialogCopy(cell.content).description),
      ],
    },
    dialogFooterManifest([
      footerActionManifest("basic", CANCEL, "dialog-close"),
      footerActionManifest("basic", MOVE, undefined),
      footerActionManifest("footer-close", CANCEL_CONTRACT, undefined),
      footerActionManifest("footer-close", CLOSE, undefined),
    ]),
    {
      kind: "instance",
      key: "close",
      of: ICON_BUTTON_MANIFEST,
      slot: "dialog-close",
      cell: () => ({ variant: "ghost", size: "icon-sm", state: "rest" }),
      properties: () => ({ swap: { Icon: "X" } }),
      shownIn: always,
      exposed: true,
    },
  ],
  swapProperties: [],
};

/**
 * The open Dialog's manifest, which the capture-backed build reads with `captures/dialog-open.json`:
 * the Backdrop and the popup over it, in the viewport the popup is fixed in.
 */
export const DIALOG_OPEN_MANIFEST: SetManifest = {
  key: "dialog-open",
  name: "Dialog (open)",
  slot: "dialog-open",
  axes: [{ name: "placement", values: ["centered"] }],
  columnAxis: "placement",
  viewport: DIALOG_VIEWPORT,
  union: ["dialog-overlay", "dialog-content"],
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "content",
      of: DIALOG_CONTENT_MANIFEST,
      cell: () => ({ content: "basic" }),
      shownIn: always,
    },
  ],
  swapProperties: [],
};
