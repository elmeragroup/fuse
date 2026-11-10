import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `dateField.*` rows, copied from React Aria's strings; see
 * `en-US.ts` for the two messages React Aria leaves to the browser.
 */
export const fiFI = {
  year: "vuosi",
  month: "kuukausi",
  day: "päivä",
  hour: "tunti",
  minute: "minuutti",
  second: "sekunti",
  dayPeriod: "vuorokaudenaika",
  timeZoneName: "aikavyöhyke",
  empty: "Tyhjä",
  selectedDateDescription: (vars: Variables) => `Valittu päivämäärä: ${String(vars?.date)}`,
  rangeUnderflow: (vars: Variables) => `Arvon on oltava ${String(vars?.minValue)} tai sitä myöhäisempi.`,
  rangeOverflow: (vars: Variables) => `Arvon on oltava ${String(vars?.maxValue)} tai sitä aikaisempi.`,
  unavailableDate: "Valittu päivämäärä ei ole käytettävissä.",
  valueMissing: "Täytä tämä kenttä.",
  incomplete: "Anna kelvollinen arvo. Kenttä on puutteellinen tai päivämäärä on virheellinen.",
};
