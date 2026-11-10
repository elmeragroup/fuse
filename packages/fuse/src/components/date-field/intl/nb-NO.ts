import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `dateField.*` rows, copied from React Aria's strings; see
 * `en-US.ts` for the two messages React Aria leaves to the browser.
 */
export const nbNO = {
  year: "år",
  month: "måned",
  day: "dag",
  hour: "time",
  minute: "minutt",
  second: "sekund",
  dayPeriod: "a.m./p.m.",
  timeZoneName: "tidssone",
  empty: "Tom",
  selectedDateDescription: (vars: Variables) => `Valgt dato: ${String(vars?.date)}`,
  rangeUnderflow: (vars: Variables) => `Verdien må være ${String(vars?.minValue)} eller senere.`,
  rangeOverflow: (vars: Variables) => `Verdien må være ${String(vars?.maxValue)} eller tidligere.`,
  unavailableDate: "Valgt dato utilgjengelig.",
  valueMissing: "Fyll ut dette feltet.",
  incomplete: "Angi en gyldig verdi. Feltet er ufullstendig eller har en ugyldig dato.",
};
