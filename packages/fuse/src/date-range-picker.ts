// Source entry facade for `@elmeragroup/fuse/date-range-picker`. It is a pure re-export file with
// explicit named re-exports only, and has no `export *`, local declarations or directives. The exports and
// barrel generators discover this file, so never hand-edit `package.json#exports` or `src/index.ts`.
// There is no public recipe. The group, trigger, popup and preset parts are DatePicker's, whose prop and
// state types `@elmeragroup/fuse/date-picker` exports.
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
  DateRangePickerTimeInputProps,
} from "./components/date-range-picker/date-range-picker-parts";
