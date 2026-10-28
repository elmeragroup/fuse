/**
 * The renderers of the `number-field-stepper` and `number-field` sets, each cell as the real Fuse
 * `<NumberField>` in `LocaleProvider`, which it reads its stepper labels from, holding the docs States
 * demo's value.
 *
 * - A stepper cell renders the field with no label and measures its increase stepper. The disabled cell
 *   sets `maxValue` to the value, so Base UI disables the stepper at its bound while the field stays
 *   enabled. The read-only cell sets `isReadOnly`. The page forces hover on the stepper. The cell's host
 *   hides the decrease stepper beside it, keeping its room, and clears the group's border, fill and
 *   shadow, so the crop holds the stepper alone, as the stepper variant draws it.
 * - A field cell renders the docs Basic demo's label and description in a host as wide as the kit's
 *   preview width. Read-only sets `isReadOnly`, disabled `isDisabled`, and invalid `isInvalid` with the
 *   Error demo's `errorMessage`. With the `Denomination` property on, the field takes the Denomination
 *   demo's `kWh`. The page forces focus on the input.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ComponentProps, ReactElement } from "react";

import { NumberField } from "../../../fuse/dist/number-field.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import type { Cell } from "../components/component-spec.ts";
import {
  NUMBER_FIELD_DENOMINATION,
  NUMBER_FIELD_DENOMINATION_PROPERTY,
  NUMBER_FIELD_DESCRIPTION,
  NUMBER_FIELD_ERROR,
  NUMBER_FIELD_LABEL,
  NUMBER_FIELD_VALUE,
} from "../components/number-field-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";
import { inFieldWidth } from "./field-text-cell.ts";

/** A field in the locale the kit draws. */
function inLocale(field: ReactElement): ReactElement {
  return createElement(LocaleProvider, { locale: "en-US", children: field });
}

/**
 * Clears what surrounds the measured stepper in the crop, which the kit's stepper variant draws
 * alone: the decrease stepper beside it, hidden in place, and the group's border, fill and shadow
 * around it. The stepper's own classes read nothing of either. The group's are important, so they beat
 * the field box's own fill, border and shadow, which Fuse's stylesheet writes later.
 */
const STEPPER_ALONE = [
  "[&_button[aria-label=Decrease]]:invisible",
  "[&_[role=group]]:border-transparent!",
  "[&_[role=group]]:bg-transparent!",
  "[&_[role=group]]:shadow-none!",
] as const;

/** A `number-field-stepper` cell: the field's increase stepper at rest, hovered, disabled at its bound or read-only. */
export const numberFieldStepper: CellRendering = {
  hostClasses: STEPPER_ALONE,
  element: (cell: Cell) => {
    const props: ComponentProps<typeof NumberField> = {
      "aria-label": NUMBER_FIELD_LABEL,
      defaultValue: NUMBER_FIELD_VALUE,
    };
    if (cell.state === "disabled") {
      props.maxValue = NUMBER_FIELD_VALUE;
    }
    if (cell.state === "readonly") {
      props.isReadOnly = true;
    }
    return createElement(
      "div",
      { className: STEPPER_ALONE.join(" ") },
      inLocale(createElement(NumberField, props))
    );
  },
};

/** A `number-field` cell: the labelled field, read-only, disabled or invalid, with or without its denomination. */
export const numberField: CellRendering = {
  element: (cell: Cell, turnedOn: ReadonlySet<string>) => {
    const props: ComponentProps<typeof NumberField> = {
      label: NUMBER_FIELD_LABEL,
      description: NUMBER_FIELD_DESCRIPTION,
      defaultValue: NUMBER_FIELD_VALUE,
      isReadOnly: cell.state === "readonly",
      isDisabled: cell.state === "disabled",
      isInvalid: cell.state === "invalid",
    };
    if (cell.state === "invalid") {
      props.errorMessage = NUMBER_FIELD_ERROR;
    }
    if (turnedOn.has(NUMBER_FIELD_DENOMINATION_PROPERTY)) {
      props.denomination = NUMBER_FIELD_DENOMINATION;
    }
    return inFieldWidth(inLocale(createElement(NumberField, props)));
  },
};
