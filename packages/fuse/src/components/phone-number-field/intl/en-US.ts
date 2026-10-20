import type { Variables } from "@internationalized/string";

/** Default localized copy for phoneNumberField.* keys. */
export const enUS = {
  selectCountry: "Select country",
  searchCountries: "Search countries",
  noCountries: "No countries found.",
  selectedCountry: (vars: Variables) => `Country: ${String(vars?.country)} ${String(vars?.dialCode)}`,
};
