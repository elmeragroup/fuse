/**
 * Date range picker, as one component set on a page of its own: `DateRangePickerField` closed, with
 * the docs default demo's label, description and range, empty or holding the range, in the field
 * box's five states: 10 cells. The root is the picker's `<div data-slot="date-range-picker">`, a
 * column. The calendar popup is left out, since the kit draws the calendar only in part.
 *
 * - The label is a `Label` instance, `DateRangePicker.Label`'s `<span>`.
 * - The field box, `data-slot="field-group"`, wraps its row, which the capture measures on one line
 *   in every mode, so it draws as a row that does not wrap. It holds each input in a `display:
 *   contents` wrapper, which draws no layer, the separator, and the trigger, whose `ms-auto` ends the
 *   row, so a frame packs the inputs and the separator at the row's start.
 * - Each input, `data-slot="date-picker-input"`, holds the en-US segments as Date field's does, the
 *   start's the demo's start and the end's its end.
 * - The trigger is Date picker's: Button's ghost `icon-sm` icon button with CalendarBlank, an `Icon
 *   button` instance, disabled where the picker is disabled or read-only, as the picker disables it.
 * - The focus cell focuses the start's month segment.
 * - Each input's visually hidden `<input>` and the root's hidden `<input>` draw nothing, so the set
 *   leaves them out.
 * - The error and the description come from `field-frame-kit.ts`, with the default demo's copy and
 *   the Error demo's message.
 */
import type { InstanceManifest, PartManifest, SetManifest } from "../capture/manifest";
import { DATE_FIELD_VALUE, dateSegmentParts } from "./date-field-kit";
import { DATE_PICKER_TRIGGER } from "./date-picker-kit";
import { FIELD_BOX_AXES } from "./field-box-kit";
import { frameMessagesManifest } from "./field-frame-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import { LABEL_MANIFEST } from "./label-kit";
import { always } from "./popup-facts";

/** The label: the docs default demo's. */
export const DATE_RANGE_PICKER_LABEL = "Stay";

/** The description: the docs default demo's. */
export const DATE_RANGE_PICKER_DESCRIPTION = "Check-in and check-out.";

/** The error the invalid cells show: the docs Error demo's message. */
export const DATE_RANGE_PICKER_ERROR = "The cabin is booked on these nights.";

/** The range's end, as an ISO date: the docs default demo's. Its start is Date field's value. */
export const DATE_RANGE_PICKER_END = "2026-10-09";

const LABEL_PART: InstanceManifest = {
  kind: "instance",
  key: "label",
  of: LABEL_MANIFEST,
  cell: (outer) => ({ state: outer.state === "disabled" ? "disabled" : "rest" }),
  properties: () => ({ text: { Label: DATE_RANGE_PICKER_LABEL } }),
  shownIn: always,
  exposed: true,
};

function end(key: string, place: string, iso: string): PartManifest {
  return {
    key,
    slot: undefined,
    place,
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
        parts: dateSegmentParts("date-picker-input", iso),
      },
    ],
  };
}

const GROUP_MANIFEST: PartManifest = {
  key: "group",
  slot: "field-group",
  shownIn: always,
  label: undefined,
  iconsFor: () => [],
  parts: [
    end("start", "field-group/0", DATE_FIELD_VALUE),
    {
      key: "separator",
      slot: "date-range-picker-separator",
      shownIn: always,
      label: { key: "text", name: "text", shownIn: always, charactersFor: () => "–" },
      iconsFor: () => [],
    },
    end("end", "field-group/2", DATE_RANGE_PICKER_END),
    DATE_PICKER_TRIGGER,
  ],
};

/**
 * The Date range picker's manifest, which the capture-backed build reads with
 * `captures/date-range-picker.json`, as `<DateRangePickerField label description defaultValue?>`
 * renders it closed, read-only, disabled, or invalid with an error message: the label, the field
 * box, then the error and the description. The start's month segment takes the states.
 */
export const DATE_RANGE_PICKER_MANIFEST: SetManifest = {
  key: "date-range-picker",
  name: "Date range picker",
  api: { page: "date-range-picker", parts: ["DateRangePickerField"] },
  slot: "date-range-picker",
  statePart: "date-input-segment",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: FIELD_BOX_AXES,
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
  parts: [
    LABEL_PART,
    GROUP_MANIFEST,
    ...frameMessagesManifest(DATE_RANGE_PICKER_ERROR, DATE_RANGE_PICKER_DESCRIPTION),
  ],
};
