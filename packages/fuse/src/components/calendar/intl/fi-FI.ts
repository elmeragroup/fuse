import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `calendar.*` rows: the month buttons' names and the parts a day
 * button's name adds to its date, copied from React Aria's `@react-aria/calendar` strings.
 */
export const fiFI = {
  previous: "Edellinen",
  next: "Seuraava",
  todayDate: (vars: Variables) => `Tänään, ${String(vars?.date)}`,
  todayDateSelected: (vars: Variables) => `Tänään, ${String(vars?.date)} valittu`,
  dateSelected: (vars: Variables) => `${String(vars?.date)} valittu`,
  minimumDate: "Ensimmäinen varattavissa oleva päivämäärä",
  maximumDate: "Viimeinen varattavissa oleva päivämäärä",
};
