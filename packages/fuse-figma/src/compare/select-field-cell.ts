/**
 * The renderer of the `select-field` set: each cell as the real Fuse `<SelectField>` with the docs
 * Basic demo's label, description, placeholder and plans, in a host as wide as the kit's preview
 * width, which the Field root's `w-full` takes.
 *
 * - `content=value` selects the Form demo's `pro`, whose label the trigger shows. A placeholder cell
 *   selects nothing, so Base UI marks the trigger `data-placeholder`.
 * - `disabled` sets `isDisabled`, which disables the Field root and the Select. `invalid` sets
 *   `isInvalid` and the States demo's `errorMessage`, which Base UI renders as the Field's error.
 * - The options popup portals in an effect, so static markup holds none of it.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ComponentProps } from "react";

import { SelectField } from "../../../fuse/dist/select-field.js";
import { Select } from "../../../fuse/dist/select.js";
import type { Cell } from "../components/component-spec.ts";
import { showsPlaceholder } from "../components/field-box-kit.ts";
import { FIELD_BOX_PREVIEW_WIDTH } from "../components/kit-lengths.ts";
import {
  SELECT_FIELD_DESCRIPTION,
  SELECT_FIELD_ERROR,
  SELECT_FIELD_LABEL,
  SELECT_FIELD_PLACEHOLDER,
  SELECT_FIELD_VALUE,
} from "../components/select-field-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The docs demos' plans, the selected one labelled as the kit draws it. */
const PLANS = { basic: "Basic", plus: "Plus", pro: SELECT_FIELD_VALUE } as const;

/** A `select-field` cell: the labelled select holding the placeholder or a plan, disabled or invalid. */
export const selectField: CellRendering = {
  element: (cell: Cell) => {
    const props: ComponentProps<typeof SelectField> = {
      label: SELECT_FIELD_LABEL,
      description: SELECT_FIELD_DESCRIPTION,
      placeholder: SELECT_FIELD_PLACEHOLDER,
      items: PLANS,
      isDisabled: cell.state === "disabled",
      isInvalid: cell.state === "invalid",
    };
    if (!showsPlaceholder(cell)) {
      props.defaultValue = "pro";
    }
    if (cell.state === "invalid") {
      props.errorMessage = SELECT_FIELD_ERROR;
    }
    return createElement(
      "div",
      { style: { width: `${FIELD_BOX_PREVIEW_WIDTH}px` } },
      createElement(
        SelectField,
        props,
        ...Object.entries(PLANS).map(([value, label]) =>
          createElement(Select.Item, { key: value, value }, label)
        )
      )
    );
  },
};
