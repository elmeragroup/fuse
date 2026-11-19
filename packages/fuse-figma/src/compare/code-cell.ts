/**
 * The renderer of the `code` set: the real Fuse `Code` holding the docs default demo's source, in a
 * host as wide as the kit's preview width.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Code } from "../../../fuse/dist/code.js";
import { CODE_PREVIEW_WIDTH, CODE_SAMPLE } from "../components/code-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The `code` cell: the default demo's block. */
export const code: CellRendering = {
  element: () =>
    createElement(
      "div",
      { style: { width: `${CODE_PREVIEW_WIDTH}px` } },
      createElement(Code, { code: CODE_SAMPLE })
    ),
};
