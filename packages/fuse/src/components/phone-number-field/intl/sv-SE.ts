import type { Variables } from "@internationalized/string";

/** Default localized copy for phoneNumberField.* keys. */
export const svSE = {
  selectCountry: "Välj land",
  searchCountries: "Sök efter länder",
  noCountries: "Inga länder hittades.",
  selectedCountry: (vars: Variables) => `Land: ${String(vars?.country)} ${String(vars?.dialCode)}`,
};
