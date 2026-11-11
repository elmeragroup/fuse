/**
 * Server-visible namespace for `DatePicker`.
 * Every part is a client module; this file has no directive, so a server component can read
 * each part instead of dotting into a client reference.
 */
import { DatePickerCalendar, DatePickerInput, DatePickerRoot, DatePickerTimeInput } from "./date-picker";
import {
  DatePickerGroup,
  DatePickerPopup,
  DatePickerPresetItem,
  DatePickerPresets,
  DatePickerTrigger,
} from "./picker-shell";

export const DatePicker = {
  Root: DatePickerRoot,
  Group: DatePickerGroup,
  Input: DatePickerInput,
  Trigger: DatePickerTrigger,
  Popup: DatePickerPopup,
  Calendar: DatePickerCalendar,
  TimeInput: DatePickerTimeInput,
  Presets: DatePickerPresets,
  PresetItem: DatePickerPresetItem,
};

export { DatePickerField } from "./date-picker-field";
