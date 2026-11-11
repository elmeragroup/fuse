/**
 * Server-visible namespace for `DateRangePicker`.
 * Every part is a client module; this file has no directive, so a server component can read
 * each part instead of dotting into a client reference. The group, trigger, popup and preset parts
 * are DatePicker's, which read whichever picker Root encloses them.
 */
import {
  DatePickerGroup,
  DatePickerPopup,
  DatePickerPresetItem,
  DatePickerPresets,
  DatePickerTrigger,
} from "../date-picker/picker-shell";
import { DateRangePickerRoot } from "./date-range-picker";
import {
  DateRangePickerCalendar,
  DateRangePickerDescription,
  DateRangePickerEndInput,
  DateRangePickerEndTimeInput,
  DateRangePickerError,
  DateRangePickerLabel,
  DateRangePickerSeparator,
  DateRangePickerStartInput,
  DateRangePickerStartTimeInput,
} from "./date-range-picker-parts";

export const DateRangePicker = {
  Root: DateRangePickerRoot,
  Label: DateRangePickerLabel,
  Group: DatePickerGroup,
  StartInput: DateRangePickerStartInput,
  Separator: DateRangePickerSeparator,
  EndInput: DateRangePickerEndInput,
  Trigger: DatePickerTrigger,
  Error: DateRangePickerError,
  Description: DateRangePickerDescription,
  Popup: DatePickerPopup,
  Calendar: DateRangePickerCalendar,
  StartTimeInput: DateRangePickerStartTimeInput,
  EndTimeInput: DateRangePickerEndTimeInput,
  Presets: DatePickerPresets,
  PresetItem: DatePickerPresetItem,
};

export { DateRangePickerField } from "./date-range-picker-field";
