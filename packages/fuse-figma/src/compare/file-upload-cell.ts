/**
 * The renderer of the `file-upload-dropzone` set: each cell as the docs Compact demo, the real Fuse
 * `<FileUpload.Root multiple>` filling a host as wide as the kit's preview width, around its dropzone
 * with the small Button trigger and the description.
 *
 * - A disabled cell sets the Root's `disabled`, which marks the zone `data-disabled` and disables the
 *   trigger.
 * - A drop-target cell passes `data-drop-target` to the zone, the attribute the zone writes while a
 *   file drag that could drop is over it, which static markup cannot hold.
 * - The page forces hover on the zone and focus on the trigger, which the zone reads.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ComponentProps } from "react";

import { Button } from "../../../fuse/dist/button.js";
import { FileUpload } from "../../../fuse/dist/file-upload.js";
import { Plus } from "../../../fuse/dist/icons.js";
import type { Cell } from "../components/component-spec.ts";
import {
  FILE_UPLOAD_DESCRIPTION,
  FILE_UPLOAD_PREVIEW_WIDTH,
  FILE_UPLOAD_TRIGGER,
} from "../components/file-upload-kit.ts";
import { markedIcon } from "./cell-renderers.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A `file-upload-dropzone` cell: the Compact demo's zone at rest, hovered, focused, as a drop target or disabled. */
export const fileUploadDropzone: CellRendering = {
  element: (cell: Cell) => {
    const zone: ComponentProps<typeof FileUpload.Dropzone> & { "data-drop-target"?: "" } = {
      children: [
        createElement(FileUpload.Trigger, {
          key: "trigger",
          render: createElement(Button, { size: "sm" }),
          children: [markedIcon(Plus, "inline-start"), FILE_UPLOAD_TRIGGER],
        }),
        createElement(FileUpload.Description, { key: "description", children: FILE_UPLOAD_DESCRIPTION }),
      ],
    };
    // The attribute the zone writes while a file drag that could drop is over it.
    if (cell.state === "drop-target") {
      zone["data-drop-target"] = "";
    }
    return createElement(
      "div",
      { style: { width: `${FILE_UPLOAD_PREVIEW_WIDTH}px` } },
      createElement(FileUpload.Root, {
        multiple: true,
        disabled: cell.state === "disabled",
        className: "max-w-lg w-full",
        children: createElement(FileUpload.Dropzone, zone),
      })
    );
  },
};
