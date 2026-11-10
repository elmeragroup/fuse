// Source entry facade for `@elmeragroup/fuse/date-range-picker` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. No public recipe. The group, trigger, popup and preset parts are DatePicker's,
// whose prop and state types `@elmeragroup/fuse/date-picker` exports.
export { DateRangePicker, DateRangePickerField } from "./components/date-range-picker";
export type {
  DateRangePickerRootProps,
  DateRangePickerRootState,
  DateRangePickerValidationError,
  DateRangePickerValue,
  DateRangePickerValueChangeEventDetails,
  DateRangePickerValueChangeReason,
} from "./components/date-range-picker/date-range-picker";
export type { DateRangePickerFieldProps } from "./components/date-range-picker/date-range-picker-field";
export type {
  DateRangePickerCalendarProps,
  DateRangePickerDescriptionProps,
  DateRangePickerErrorProps,
  DateRangePickerInputProps,
  DateRangePickerLabelProps,
  DateRangePickerSeparatorProps,
} from "./components/date-range-picker/date-range-picker-parts";
