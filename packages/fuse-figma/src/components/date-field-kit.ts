/**
 * Date field, as one component set on a page of its own: `DateField` with the docs default demo's
 * label and description, empty or holding the Error demo's date, in the field box's five states: 10
 * cells. The root is the `Field.Root`, Base UI's `<div data-slot="field">`.
 *
 * - The heading row is FieldFrame's label row holding a `Label` instance.
 * - The field box is DateInput's `<div data-slot="field-group">`, a row of the en-US segments in
 *   source order: month, `/`, day, `/`, year. Each segment is a `<span data-slot="date-input-segment">`
 *   that the box holds as a flex item. An empty field shows each segment's placeholder, `mm`, `dd`
 *   and `yyyy`; a filled one the date's numbers.
 * - The focus cell focuses the month segment, which DateInput highlights. The box does not ring,
 *   since no segment marks itself as the box's focus-ring control (#778), so the set draws none.
 * - The visually hidden `<input>` that submits the ISO value draws nothing, so the set leaves it out.
 * - The label, the error and the description, and the states Base UI stamps on them, come from
 *   `field-frame-kit.ts`, with the default demo's copy and the Error demo's message.
 */
import type { LabelManifest, PartManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { FIELD_BOX_AXES, showsPlaceholder } from "./field-box-kit";
import { frameLabelRowManifest, frameMessagesManifest } from "./field-frame-kit";
import { FIELD_BOX_PREVIEW_WIDTH } from "./kit-lengths";
import { always } from "./popup-facts";

/** The label: the docs default demo's. */
export const DATE_FIELD_LABEL = "Moving date";

/** The description: the docs default demo's. */
export const DATE_FIELD_DESCRIPTION = "The day the keys change hands.";

/** The error the invalid cells show: the docs Error demo's message. */
export const DATE_FIELD_ERROR = "Choose a date after the lease ends.";

/** The date a filled cell holds, as an ISO date: the docs Error demo's, and the pickers' default demos'. */
export const DATE_FIELD_VALUE = "2026-10-05";

/** One segment of the en-US date: its key, its placeholder and the text it shows for the date. */
type Segment = { readonly key: string; readonly placeholder: string; readonly value: string };

/**
 * The en-US date's segments in source order, as DateInput renders an ISO date at the day's
 * granularity: the month and the day in two digits, as the capture holds them, and the year.
 *
 * @param iso - The date the filled segments show, as `2026-10-05`.
 * @returns The month, `/`, the day, `/` and the year.
 */
function segmentsOf(iso: string): readonly Segment[] {
  const [year = "", month = "", day = ""] = iso.split("-");
  return [
    { key: "month", placeholder: "mm", value: month },
    { key: "month-separator", placeholder: "/", value: "/" },
    { key: "day", placeholder: "dd", value: day },
    { key: "day-separator", placeholder: "/", value: "/" },
    { key: "year", placeholder: "yyyy", value: year },
  ];
}

/** A segment's text: its placeholder in an empty field, the date's numbers in a filled one. */
function segmentLabel(segment: Segment): LabelManifest {
  return {
    key: "text",
    name: "text",
    shownIn: always,
    charactersFor: (cell: Cell) => (showsPlaceholder(cell) ? segment.placeholder : segment.value),
  };
}

/**
 * The en-US date's segments as a manifest names them, each by its place below the element that holds
 * them, `field-group` in a Date field and `date-picker-input` in a picker.
 *
 * @param holder - The `data-slot` of the element whose children the segments are.
 * @param iso - The date the filled segments show, {@link DATE_FIELD_VALUE} unless a range's end
 *   shows another.
 * @returns The five segments, in source order.
 */
export function dateSegmentParts(holder: string, iso: string = DATE_FIELD_VALUE): readonly PartManifest[] {
  return segmentsOf(iso).map((segment, index): PartManifest => ({
    key: segment.key,
    slot: undefined,
    place: `${holder}/${String(index)}`,
    shownIn: always,
    label: segmentLabel(segment),
    iconsFor: () => [],
  }));
}

/** The field box: DateInput's group, the row of segments. */
const GROUP_MANIFEST: PartManifest = {
  key: "group",
  slot: "field-group",
  shownIn: always,
  label: undefined,
  iconsFor: () => [],
  parts: dateSegmentParts("field-group"),
};

/**
 * The Date field's manifest, which the capture-backed build reads with `captures/date-field.json`, as
 * `<DateField label description defaultValue?>` renders it, read-only, disabled, or invalid with an
 * error message: the label row, the field box, then the error and the description. The month segment
 * takes the states.
 */
export const DATE_FIELD_MANIFEST: SetManifest = {
  key: "date-field",
  name: "Date field",
  api: { page: "date-field", parts: ["DateField"] },
  slot: "field",
  statePart: "date-input-segment",
  previewWidth: FIELD_BOX_PREVIEW_WIDTH,
  axes: FIELD_BOX_AXES,
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
  parts: [
    frameLabelRowManifest(DATE_FIELD_LABEL, "field/0"),
    GROUP_MANIFEST,
    ...frameMessagesManifest(DATE_FIELD_ERROR, DATE_FIELD_DESCRIPTION),
  ],
};
