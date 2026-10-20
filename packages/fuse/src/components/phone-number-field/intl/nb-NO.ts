import type { Variables } from "@internationalized/string";

/** Default localized copy for phoneNumberField.* keys. */
export const nbNO = {
  selectCountry: "Velg land",
  searchCountries: "Søk etter land",
  noCountries: "Ingen land funnet.",
  selectedCountry: (vars: Variables) => `Land: ${String(vars?.country)} ${String(vars?.dialCode)}`,
};
