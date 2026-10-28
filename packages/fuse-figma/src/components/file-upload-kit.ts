/**
 * File upload, as one component set on a page of its own: the docs Compact demo's dropzone at rest,
 * hovered, focused, as a drop target and disabled, 5 cells. The root is `FileUpload.Dropzone`'s `<div
 * data-slot="file-upload-dropzone">` with the `dropzone` slot of `fileUploadVariants`.
 *
 * - The dropzone is Item's default shell, rounded `radius-md`, padded `surface-pad-md`, with a dashed
 *   1px `border` stroke, its trigger and description `surface-gap-sm` apart and centred across. In the
 *   Compact demo it fills `FileUpload.Root`'s `max-w-lg`, 512px, the width the set draws.
 * - The trigger is `FileUpload.Trigger` rendering a small default `Button`, an exposed `Button`
 *   instance with the Plus start icon and `Add files`, which Base UI stamps `file-upload-trigger`.
 * - The description is `FileUpload.Description`'s `<p>` in the label type pair in
 *   `muted-foreground`, holding the demo's copy, which a TEXT property sets.
 * - Hover and keyboard focus inside the zone strengthen its border to `muted-foreground/50`; a focused
 *   cell also rings the trigger. A drop target turns the border solid `primary` on a `primary-soft`
 *   fill. A disabled Root marks the zone `data-disabled`, which dims it to 50%, and disables the
 *   trigger.
 */
import { fileUploadVariants } from "@elmeragroup/fuse/recipe-catalog";

import { BUTTON } from "./button-kit";
import type { Cell, ComponentDefinition, InstanceDefinition, PartDefinition } from "./component-spec";
import { userAgentDisplay } from "./element-defaults";
import { always } from "./popup-facts";

/** The trigger's label: the docs Compact demo's. */
export const FILE_UPLOAD_TRIGGER = "Add files";

/** The description: the docs Compact demo's. */
export const FILE_UPLOAD_DESCRIPTION = "Drop files here or click to browse (max 3 files)";

/** The Compact demo's `max-w-lg`, the width the dropzone fills. */
export const FILE_UPLOAD_PREVIEW_WIDTH = 512;

const slots = fileUploadVariants();

/** The trigger, a small default `Button` with Plus at its start, focused with the zone or disabled with it. */
const TRIGGER: InstanceDefinition = {
  kind: "instance",
  key: "trigger",
  of: BUTTON,
  slot: "file-upload-trigger",
  cell: (outer) => ({
    variant: "default",
    size: "sm",
    state: outer.state === "focus" || outer.state === "disabled" ? outer.state : "rest",
    icon: "start",
  }),
  properties: () => ({ text: { Label: FILE_UPLOAD_TRIGGER } }),
  shownIn: always,
  exposed: true,
};

/** The description, `FileUpload.Description`'s `<p>`. */
const DESCRIPTION: PartDefinition = {
  key: "description",
  slot: "file-upload-description",
  shownIn: always,
  classesFor: () => slots.description(),
  elementDefaults: userAgentDisplay("p"),
  label: {
    key: "text",
    name: "text",
    characters: FILE_UPLOAD_DESCRIPTION,
    textProperty: "Description",
    shownIn: always,
  },
  iconsFor: () => [],
};

/** Whether a cell is the drop target, where a file drag that could drop is over the zone. */
function isDropTarget(cell: Cell): boolean {
  return cell.state === "drop-target";
}

/**
 * A dropzone, as the Compact demo's `<FileUpload.Dropzone>` in a `FileUpload.Root`, disabled or not.
 * Its hover and focus strokes are dashed and bound to the `muted-foreground/50` tint; in Figma a dashed
 * stroke bound to an alpha tint keeps its `[3, 2]` pattern and takes the variable's alpha, in either
 * write order (W5-P9).
 */
export const FILE_UPLOAD_DROPZONE: ComponentDefinition = {
  key: "file-upload-dropzone",
  name: "File upload dropzone",
  slot: "file-upload-dropzone",
  // Nothing stamps the zone but Base UI's `data-disabled`, which the states name.
  rootKind: "plain-element",
  // A pointer hovers the zone itself, and a keyboard focuses its trigger, which the zone reads.
  focusPart: "file-upload-trigger",
  previewWidth: FILE_UPLOAD_PREVIEW_WIDTH,
  axes: [{ name: "state", values: ["rest", "hover", "focus", "drop-target", "disabled"] }],
  columnAxis: "state",
  classesFor: () => slots.dropzone(),
  states: {
    // A focused trigger inside the zone, which the zone reads through `has-focus-visible:`.
    focus: ["has-focus-visible"],
    disabled: ["data-disabled"],
  },
  facts: new Map([["data-drop-target", isDropTarget]]),
  // The zone is a `<div>` Base UI marks `data-disabled`, never `aria-disabled`.
  omittedStates: new Set(["aria-disabled"]),
  label: undefined,
  iconsFor: () => [],
  parts: [TRIGGER, DESCRIPTION],
  swapProperties: [],
};
