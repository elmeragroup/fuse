/**
 * The renderers of Field's four text sets: each cell as the real Fuse part inside the Field part
 * around it, as the docs Field demos place it.
 *
 * - A `field-description` cell renders `<Field.Description>` in a `Field.Root`, and a `field-error`
 *   cell `<Field.Error>` in an invalid `Field.Root`, which stamps the error `data-invalid`.
 * - A `field-legend` cell renders `<Field.Legend variant>` in a `Field.Set`.
 * - The description, the error and the legend are block boxes that fill their Field, so each cell
 *   sits in a host as wide as the kit's preview width. The compare page's slot has no width of its
 *   own.
 * - A `field-title` cell renders `<Field.Title>` in a `Field.Root`, which `disabled` disables. The
 *   title hugs its text, so the cell needs no host width.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { Field } from "../../../fuse/dist/field.js";
import type { Cell } from "../components/component-spec.ts";
import {
  FIELD_DESCRIPTION_TEXT,
  FIELD_ERROR_TEXT,
  FIELD_LEGEND_TEXT,
  FIELD_TITLE_TEXT,
  legendVariantFor,
} from "../components/field-text-kit.ts";
import { FIELD_BOX_PREVIEW_WIDTH } from "../components/kit-lengths.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A Field part in a host as wide as the Field the kit draws. */
function inFieldWidth(part: ReactElement): ReactElement {
  return createElement("div", { style: { width: `${FIELD_BOX_PREVIEW_WIDTH}px` } }, part);
}

/** The `field-description` cell: the docs Basic demo's description. */
export const fieldDescription: CellRendering = {
  element: () =>
    inFieldWidth(
      createElement(Field.Root, null, createElement(Field.Description, null, FIELD_DESCRIPTION_TEXT))
    ),
};

/** The `field-error` cell: the docs Error message demo's error, in an invalid Field. */
export const fieldError: CellRendering = {
  element: () =>
    inFieldWidth(
      createElement(Field.Root, { invalid: true }, createElement(Field.Error, null, FIELD_ERROR_TEXT))
    ),
};

/** A `field-legend` cell: the docs Field set demo's legend, in the cell's variant. */
export const fieldLegend: CellRendering = {
  element: (cell: Cell) =>
    inFieldWidth(
      createElement(
        Field.Set,
        null,
        createElement(Field.Legend, { variant: legendVariantFor(cell) }, FIELD_LEGEND_TEXT)
      )
    ),
};

/** A `field-title` cell: the docs Choice card demo's title, at rest or in a disabled Field. */
export const fieldTitle: CellRendering = {
  element: (cell: Cell) =>
    createElement(
      Field.Root,
      { disabled: cell.state === "disabled" },
      createElement(Field.Title, null, FIELD_TITLE_TEXT)
    ),
};
