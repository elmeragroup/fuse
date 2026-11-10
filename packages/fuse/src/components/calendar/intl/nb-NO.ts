import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `calendar.*` rows: the month buttons' names and the parts a day
 * button's name adds to its date, copied from React Aria's `@react-aria/calendar` strings.
 */
export const nbNO = {
  previous: "Forrige",
  next: "Neste",
  todayDate: (vars: Variables) => `I dag, ${String(vars?.date)}`,
  todayDateSelected: (vars: Variables) => `I dag, ${String(vars?.date)} valgt`,
  dateSelected: (vars: Variables) => `${String(vars?.date)} valgt`,
  minimumDate: "Første tilgjengelige dato",
  maximumDate: "Siste tilgjengelige dato",
};
