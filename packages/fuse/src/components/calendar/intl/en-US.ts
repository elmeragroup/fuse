import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `calendar.*` rows: the month buttons' names and the parts a day
 * button's name adds to its date. The rows copy React Aria's `@react-aria/calendar` strings, so a
 * screen reader hears the same names on the interim tier and on this one.
 */
export const enUS = {
  previous: "Previous",
  next: "Next",
  todayDate: (vars: Variables) => `Today, ${String(vars?.date)}`,
  todayDateSelected: (vars: Variables) => `Today, ${String(vars?.date)} selected`,
  dateSelected: (vars: Variables) => `${String(vars?.date)} selected`,
  minimumDate: "First available date",
  maximumDate: "Last available date",
};
