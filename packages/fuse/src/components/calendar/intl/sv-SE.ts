import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `calendar.*` rows: the month buttons' names and the parts a day
 * button's name adds to its date, copied from React Aria's `@react-aria/calendar` strings.
 */
export const svSE = {
  previous: "Föregående",
  next: "Nästa",
  todayDate: (vars: Variables) => `Idag, ${String(vars?.date)}`,
  todayDateSelected: (vars: Variables) => `Idag, ${String(vars?.date)} har valts`,
  dateSelected: (vars: Variables) => `${String(vars?.date)} har valts`,
  minimumDate: "Första tillgängliga datum",
  maximumDate: "Sista tillgängliga datum",
};
