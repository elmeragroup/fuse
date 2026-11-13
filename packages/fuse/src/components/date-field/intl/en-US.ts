import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `dateField.*` rows. The segment names, "Empty", the value
 * description and the bound and unavailable messages copy React Aria's `@react-aria/datepicker`,
 * `@react-aria/spinbutton` and `@react-stately/datepicker` strings, so a screen reader and a form
 * read the words React Aria's fields use. The segment names back up
 * `Intl.DisplayNames`, which writes the same words where the engine has it. React Aria leaves a
 * missing or incomplete value to the browser's own constraint message, so `valueMissing` and
 * `incomplete` take Chromium's English words for a required field and an incomplete date input.
 */
export const enUS = {
  year: "year",
  month: "month",
  day: "day",
  hour: "hour",
  minute: "minute",
  second: "second",
  dayPeriod: "AM/PM",
  timeZoneName: "time zone",
  empty: "Empty",
  selectedDateDescription: (vars: Variables) => `Selected Date: ${String(vars?.date)}`,
  selectedTimeDescription: (vars: Variables) => `Selected Time: ${String(vars?.time)}`,
  rangeUnderflow: (vars: Variables) => `Value must be ${String(vars?.minValue)} or later.`,
  rangeOverflow: (vars: Variables) => `Value must be ${String(vars?.maxValue)} or earlier.`,
  unavailableDate: "Selected date unavailable.",
  valueMissing: "Please fill out this field.",
  incomplete: "Please enter a valid value. The field is incomplete or has an invalid date.",
};
