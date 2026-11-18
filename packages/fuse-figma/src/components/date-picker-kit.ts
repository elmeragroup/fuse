/**
 * Date picker, as one component set on a page of its own: `DatePickerField` closed, with the docs
 * default demo's label and description, empty or holding the demo's date, in the field box's five
 * states: 10 cells. The root is the `Field.Root`, Base UI's `<div data-slot="field">`. The calendar
 * popup is left out, since the kit draws the calendar only in part.
 *
 * - The heading row is FieldFrame's label row holding a `Label` instance.
 * - The picker's `<div data-slot="date-picker">` holds the field box, `data-slot="field-group"`, a
 *   row of the segment row and the trigger. The segment row, `data-slot="date-picker-input"`, holds
 *   the en-US segments as Date field's does, and fills the box beside the trigger.
 * - The trigger is Button's ghost `icon-sm` icon button with CalendarBlank, an `Icon button`
 *   instance, disabled where the field is disabled or read-only, as the picker disables it.
 * - The focus cell focuses the month segment.
 * - The visually hidden `<input>` and the hidden selected-date text draw nothing, so the set leaves
 *   them out.
 * - The label, the error and the description come from `field-frame-kit.ts`, with the default demo's
 *   copy and the Error demo's message.
 */
import type { InstanceManifest, PartManifest, SetManifest } from "../capture/manifest";
import { ICON_BUTTON_MANIFEST } from "./button-kit";
import { dateSegmentParts } from "./date-field-kit";
import { FIELD_BOX_AXES } from "./field-box-kit";
import { frameLabelRowManifest, frameMessagesManifest } from "./field-frame-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import { always } from "./popup-facts";

/** The label: the docs default demo's. */
export const DATE_PICKER_LABEL = "Moving date";

/** The description: the docs default demo's. */
export const DATE_PICKER_DESCRIPTION = "Type it or pick it from the calendar.";

/** The error the invalid cells show: the docs Error demo's message. */
export const DATE_PICKER_ERROR = "Choose a date after the lease ends.";

/**
 * The calendar trigger, an `Icon button` instance: ghost, `icon-sm`, with CalendarBlank, disabled
 * where the picker disables it.
 */
const DATE_PICKER_TRIGGER: InstanceManifest = {
  kind: "instance",
  key: "trigger",
  of: ICON_BUTTON_MANIFEST,
  slot: "date-picker-trigger",
  cell: (outer) => ({
    variant: "ghost",
    size: "icon-sm",
    state: outer.state === "disabled" || outer.state === "readonly" ? "disabled" : "rest",
  }),
  properties: () => ({ swap: { Icon: "CalendarBlank" } }),
  shownIn: always,
};

/** The field box: the segment row, filling the box, then the trigger. */
const GROUP_MANIFEST: PartManifest = {
  key: "group",
  slot: "field-group",
  shownIn: always,
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "input",
      slot: "date-picker-input",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: dateSegmentParts("date-picker-input"),
    },
    DATE_PICKER_TRIGGER,
  ],
};

/**
 * The Date picker's manifest, which the capture-backed build reads with `captures/date-picker.json`,
 * as `<DatePickerField label description defaultValue?>` renders it closed, read-only, disabled, or
 * invalid with an error message: the label row, the picker around the field box, then the error and
 * the description. The month segment takes the states.
 */
export const DATE_PICKER_MANIFEST: SetManifest = {
  key: "date-picker",
  name: "Date picker",
  api: { page: "date-picker", parts: ["DatePickerField"] },
  slot: "field",
  statePart: "date-input-segment",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: FIELD_BOX_AXES,
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
  parts: [
    frameLabelRowManifest(DATE_PICKER_LABEL, "field/0"),
    {
      key: "picker",
      slot: "date-picker",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [GROUP_MANIFEST],
    },
    ...frameMessagesManifest(DATE_PICKER_ERROR, DATE_PICKER_DESCRIPTION),
  ],
};
