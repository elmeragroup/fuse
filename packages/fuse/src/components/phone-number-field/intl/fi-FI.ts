import type { Variables } from "@internationalized/string";

/** Default localized copy for phoneNumberField.* keys. */
export const fiFI = {
  selectCountry: "Valitse maa",
  searchCountries: "Hae maita",
  noCountries: "Maita ei löytynyt.",
  selectedCountry: (vars: Variables) => `Maa: ${String(vars?.country)} ${String(vars?.dialCode)}`,
};
