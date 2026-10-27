/**
 * The renderer of the `radio-group` set: each cell as the real Fuse `<RadioGroup>` with the docs
 * Basic demo's legend and `Contract` options, `Fixed` selected, and the Pending demo's description,
 * in a host as wide as the kit's preview width, which the Field root's `w-full` takes.
 *
 * - `orientation` sets the group's `orientation`.
 * - `disabled` sets `isDisabled`, which disables the Field and every radio. `invalid` sets
 *   `isInvalid` and the Pending demo's `errorMessage`, which Base UI renders as the Field's error.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Radio, RadioGroup } from "../../../fuse/dist/radio-group.js";
import type { RadioGroupProps } from "../../../fuse/dist/radio-group.js";
import type { Cell } from "../components/component-spec.ts";
import { FIELD_BOX_PREVIEW_WIDTH } from "../components/kit-lengths.ts";
import {
  orientationFor,
  RADIO_GROUP_DESCRIPTION,
  RADIO_GROUP_ERROR,
  RADIO_GROUP_LEGEND,
  RADIO_GROUP_OPTIONS,
} from "../components/radio-group-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A `radio-group` cell: the labelled group in its orientation, disabled or invalid. */
export const radioGroup: CellRendering = {
  element: (cell: Cell) => {
    const props: RadioGroupProps = {
      label: RADIO_GROUP_LEGEND,
      description: RADIO_GROUP_DESCRIPTION,
      orientation: orientationFor(cell),
      defaultValue: RADIO_GROUP_OPTIONS[0],
      isDisabled: cell.state === "disabled",
      isInvalid: cell.state === "invalid",
    };
    if (cell.state === "invalid") {
      props.errorMessage = RADIO_GROUP_ERROR;
    }
    return createElement(
      "div",
      { style: { width: `${FIELD_BOX_PREVIEW_WIDTH}px` } },
      createElement(
        RadioGroup,
        props,
        ...RADIO_GROUP_OPTIONS.map((option) => createElement(Radio, { key: option, value: option }, option))
      )
    );
  },
};
