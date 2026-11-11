import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `dateField.*` rows, copied from React Aria's strings; see
 * `en-US.ts` for the two messages React Aria leaves to the browser.
 */
export const svSE = {
  year: "år",
  month: "månad",
  day: "dag",
  hour: "timme",
  minute: "minut",
  second: "sekund",
  dayPeriod: "fm/em",
  timeZoneName: "tidszon",
  empty: "Tomt",
  selectedDateDescription: (vars: Variables) => `Valt datum: ${String(vars?.date)}`,
  selectedTimeDescription: (vars: Variables) => `Vald tid: ${String(vars?.time)}`,
  rangeUnderflow: (vars: Variables) => `Värdet måste vara ${String(vars?.minValue)} eller senare.`,
  rangeOverflow: (vars: Variables) => `Värdet måste vara ${String(vars?.maxValue)} eller tidigare.`,
  unavailableDate: "Det valda datumet är inte tillgängligt.",
  valueMissing: "Fyll i det här fältet.",
  incomplete: "Ange ett giltigt värde. Fältet är ofullständigt eller har ett ogiltigt datum.",
};
