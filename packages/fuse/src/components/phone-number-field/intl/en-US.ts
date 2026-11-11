import type { Variables } from "@internationalized/string";

/** Default localized copy for phoneNumberField.* keys. */
export const enUS = {
  selectCountry: "Select country",
  searchCountries: "Search countries",
  noCountries: "No countries found.",
  selectedCountry: (vars: Variables) => `${String(vars?.dialCode)} ${String(vars?.country)}`,
};
