/**
 * File upload, as one component set on a page of its own: the docs Compact demo's dropzone at rest,
 * hovered, focused, as a drop target and disabled, 5 cells. The root is `FileUpload.Dropzone`'s `<div
 * data-slot="file-upload-dropzone">`.
 *
 * - In the Compact demo the dropzone fills `FileUpload.Root`'s `max-w-lg`, 512px, the width its
 *   sample renders in.
 * - The trigger is `FileUpload.Trigger` rendering a small default `Button`, an exposed `Button`
 *   instance with the Plus start icon and `Add files`, which Base UI stamps `file-upload-trigger`.
 * - The description is `FileUpload.Description`'s `<p>`, holding the demo's copy, which a TEXT
 *   property sets.
 * - A pointer hovers the zone itself, and a keyboard focuses its trigger. A disabled Root disables
 *   the trigger too.
 */
import type { LabelManifest, SetManifest } from "../capture/manifest";
import { BUTTON_MANIFEST } from "./button-kit";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";

/** The trigger's label: the docs Compact demo's. */
export const FILE_UPLOAD_TRIGGER = "Add files";

/** The description: the docs Compact demo's. */
export const FILE_UPLOAD_DESCRIPTION = "Drop files here or click to browse (max 3 files)";

/** The Compact demo's `max-w-lg`, the width the dropzone fills. */
export const FILE_UPLOAD_PREVIEW_WIDTH = 512;

/** The trigger's Button cell: small and default, with Plus at its start, focused or disabled with the zone. */
function triggerCell(outer: Cell): Cell {
  return {
    variant: "default",
    size: "sm",
    state: outer.state === "focus" || outer.state === "disabled" ? outer.state : "rest",
    icon: "start",
  };
}

/** The description's text, which the `Description` property sets. */
const DESCRIPTION_TEXT: LabelManifest = {
  key: "text",
  name: "text",
  characters: FILE_UPLOAD_DESCRIPTION,
  textProperty: "Description",
  shownIn: always,
};

/**
 * The dropzone's manifest, which the capture-backed build reads with
 * `captures/file-upload-dropzone.json`: a dropzone, as the Compact demo's `<FileUpload.Dropzone>` in
 * a `FileUpload.Root`, disabled or not.
 */
export const FILE_UPLOAD_DROPZONE_MANIFEST: SetManifest = {
  key: "file-upload-dropzone",
  name: "File upload dropzone",
  slot: "file-upload-dropzone",
  focusPart: "file-upload-trigger",
  previewWidth: FILE_UPLOAD_PREVIEW_WIDTH,
  axes: [{ name: "state", values: ["rest", "hover", "focus", "drop-target", "disabled"] }],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "trigger",
      of: BUTTON_MANIFEST,
      slot: "file-upload-trigger",
      cell: triggerCell,
      properties: () => ({ text: { Label: FILE_UPLOAD_TRIGGER } }),
      shownIn: always,
      exposed: true,
    },
    {
      key: "description",
      slot: "file-upload-description",
      shownIn: always,
      label: DESCRIPTION_TEXT,
      iconsFor: () => [],
    },
  ],
  swapProperties: [],
};
