/**
 * Toast, as one component set on a page of its own: the toast the docs default demo raises, `Draft
 * saved` over `You can finish it later.`, at rest, in each status a toast's `type` sets, 6 cells. The
 * root is `Toast.Root`, `<div data-slot="toast-root">`, 384px wide in the demo's `max-w-sm` stack. It
 * holds `Toast.Content`, around the row that `BuiltInToast` renders:
 *
 * - the status icon, which every status but neutral shows before the text;
 * - the text column, around `Toast.Title` and `Toast.Description`, which the `Title` and `Description`
 *   properties set.
 *
 * The column carries no `data-slot`, and the icon before it moves it from the row's first child to
 * its second, so the manifest names it at each place, in the cells that put it there. Fuse gives it
 * no `data-slot`, which would be consumer API for a layout `<div>` inside `BuiltInToast`.
 *
 * The close, `Toast.Close` at `absolute top-2 right-2`, stays out (#820): its containing block is the
 * root, which pads the content that holds it, so no placement rule draws it where CSS puts it.
 */
import type { IconManifest, LabelManifest, PartManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";
import {
  TOAST_DESCRIPTION,
  TOAST_PREVIEW_WIDTH,
  TOAST_STATUSES,
  TOAST_TITLE,
  toastStatus,
} from "./toast-text";
import type { ToastStatus } from "./toast-text";

/** The Fuse icon each status draws, as `STATUS_ICONS` in `toast.tsx` maps them; neutral draws none. */
const STATUS_ICONS = {
  neutral: undefined,
  info: "Info",
  success: "CheckCircle",
  warning: "Warning",
  error: "WarningOctagon",
  loading: "SpinnerGap",
} as const satisfies Readonly<Record<ToastStatus, string | undefined>>;

/** The status icon a cell shows before the text column, none for neutral. */
function statusIcon(cell: Cell): readonly IconManifest[] {
  const icon = STATUS_ICONS[toastStatus(cell.status)];
  return icon === undefined
    ? []
    : [
        {
          key: "icon",
          name: "Icon",
          side: "start",
          direct: true,
          dataIcon: undefined,
          icon,
          swapProperty: undefined,
        },
      ];
}

/** A text part of the column, its words set by a TEXT property. */
function textPart(key: string, slot: string, characters: string, textProperty: string): PartManifest {
  const label: LabelManifest = { key: "text", name: "text", characters, textProperty, shownIn: always };
  return { key, slot, shownIn: always, label, iconsFor: () => [] };
}

/**
 * The text column at its place in the row: the row's first child where no icon comes before it, and
 * its second beside the status icon.
 */
function textColumn(place: "toast-content/0/0" | "toast-content/0/1"): PartManifest {
  const besideIcon = place === "toast-content/0/1";
  return {
    key: "text",
    slot: undefined,
    place,
    // The column follows the status icon in the row, which a part draws after the box's own icons.
    after: "label",
    shownIn: (cell) => statusIcon(cell).length > 0 === besideIcon,
    label: undefined,
    iconsFor: () => [],
    parts: [
      textPart("title", "toast-title", TOAST_TITLE, "Title"),
      textPart("description", "toast-description", TOAST_DESCRIPTION, "Description"),
    ],
  };
}

/** The toast's manifest, which the capture-backed build reads with `captures/toast.json`. */
export const TOAST_MANIFEST: SetManifest = {
  key: "toast",
  name: "Toast",
  api: { page: "toast", parts: ["Toast.Root"] },
  slot: "toast-root",
  axes: [{ name: "status", values: TOAST_STATUSES }],
  columnAxis: "status",
  previewWidth: TOAST_PREVIEW_WIDTH,
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
  parts: [
    {
      key: "content",
      slot: "toast-content",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "row",
          slot: undefined,
          place: "toast-content/0",
          shownIn: always,
          label: undefined,
          iconsFor: statusIcon,
          parts: [textColumn("toast-content/0/0"), textColumn("toast-content/0/1")],
        },
      ],
    },
  ],
};
