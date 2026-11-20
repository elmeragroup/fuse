/**
 * Attachment, as one component set on the Attachment page: the docs default demo's row at each
 * `size`, at rest and waiting to upload, 6 cells, with columns by `size`.
 *
 * - The root is a `<div data-slot="attachment">`, a horizontal row. Its sample renders in a 448px
 *   host, which the row fills, as a block-level root fills the docs demo stage.
 * - The media holds the docs FileArrowUp, which the `Icon` swap property picks.
 * - The content holds the title and the description, each a `<span>` with its own text, which the
 *   `Title` and `Description` properties set.
 * - The actions hold one `Attachment.Action`, an instance of the ghost `icon-xs` Icon button with X.
 *   The actions' `z-index` stacks them over the rest of the row, and the kit draws them as the root's
 *   last layer.
 *
 * The set draws no vertical tile, no `error`, `uploading` or `processing` state, no
 * `Attachment.Trigger`, no image media and no `Attachment.Group`.
 */
import type { IconManifest, InstanceManifest, SetManifest } from "../capture/manifest";
import { ICON_BUTTON_MANIFEST } from "./button-kit";
import { swapProperties } from "./component-spec";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";

/** The width of the host the attachment renders in. */
export const ATTACHMENT_PREVIEW_WIDTH = 448;

/** The title, the default of its `Title` property: the docs default demo's. */
export const ATTACHMENT_TITLE_TEXT = "meter-readings.pdf";

/** The description, the default of its `Description` property: the docs default demo's. */
export const ATTACHMENT_DESCRIPTION_TEXT = "PDF · 240 KB";

/** The action's name, the docs default demo's. */
export const ATTACHMENT_ACTION_LABEL = "Remove meter-readings.pdf";

/** The sizes `Attachment.Root` takes, its default first. */
const SIZES = ["default", "sm", "xs"] as const;

/** The states the set draws, as `Attachment.Root` takes its `state`, its default first. */
const STATES = ["done", "idle"] as const;

/** A cell's size and state, as `Attachment.Root` takes them. */
export type AttachmentLook = {
  readonly size: (typeof SIZES)[number];
  readonly state: (typeof STATES)[number];
};

/**
 * A cell's size and state.
 *
 * @param cell - An `attachment` cell.
 * @returns The size and state it names.
 * @throws When the cell names a value the set does not declare, a defect in the caller's cell.
 */
export function attachmentLook(cell: Cell): AttachmentLook {
  const size = SIZES.find((candidate) => candidate === cell.size);
  const state = STATES.find((candidate) => candidate === cell.state);
  if (size === undefined || state === undefined) {
    throw new Error(`Attachment has no cell ${cell.size ?? ""} ${cell.state ?? ""}`);
  }
  return { size, state };
}

/** The docs FileArrowUp in the media, which the `Icon` swap property picks. */
const FILE_ICON: IconManifest = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "FileArrowUp",
  swapProperty: "Icon",
};

/** The remove action, `Attachment.Action` rendering the ghost `icon-xs` Icon button with X. */
const ACTION: InstanceManifest = {
  kind: "instance",
  key: "action",
  of: ICON_BUTTON_MANIFEST,
  slot: "attachment-action",
  cell: () => ({ variant: "ghost", size: "icon-xs", state: "rest" }),
  properties: () => ({ swap: { Icon: "X" } }),
  shownIn: always,
  exposed: true,
};

/** The Attachment's manifest, which the capture-backed build reads with `captures/attachment.json`. */
export const ATTACHMENT_MANIFEST: SetManifest = {
  key: "attachment",
  name: "Attachment",
  api: { page: "attachment", parts: ["Attachment.Root"] },
  slot: "attachment",
  axes: [
    { name: "size", values: SIZES },
    { name: "state", values: STATES },
  ],
  columnAxis: "size",
  previewWidth: ATTACHMENT_PREVIEW_WIDTH,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "media",
      slot: "attachment-media",
      shownIn: always,
      label: undefined,
      iconsFor: () => [FILE_ICON],
    },
    {
      key: "content",
      slot: "attachment-content",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        {
          key: "title",
          slot: "attachment-title",
          shownIn: always,
          label: {
            key: "text",
            name: "text",
            characters: ATTACHMENT_TITLE_TEXT,
            textProperty: "Title",
            shownIn: always,
          },
          iconsFor: () => [],
        },
        {
          key: "description",
          slot: "attachment-description",
          shownIn: always,
          label: {
            key: "text",
            name: "text",
            characters: ATTACHMENT_DESCRIPTION_TEXT,
            textProperty: "Description",
            shownIn: always,
          },
          iconsFor: () => [],
        },
      ],
    },
    {
      key: "actions",
      slot: "attachment-actions",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [ACTION],
    },
  ],
  swapProperties: swapProperties([FILE_ICON]),
};
