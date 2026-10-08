import type { CountryCode } from "libphonenumber-js/core";

type LocaleCountryNames = {
  displayNames: Intl.DisplayNames;
  names: Map<string, string>;
  /** Built on the first sort, which runs only once a picker opens. */
  collator?: Intl.Collator;
};

const localeCountryNames = new Map<string, LocaleCountryNames>();

function resolveDisplayNames(locale: string): Intl.DisplayNames {
  try {
    return new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    return new Intl.DisplayNames(["en-US"], { type: "region" });
  }
}

function localeEntry(locale: string): LocaleCountryNames {
  const cached = localeCountryNames.get(locale);
  if (cached) {
    return cached;
  }
  const entry: LocaleCountryNames = {
    displayNames: resolveDisplayNames(locale),
    names: new Map(),
  };
  localeCountryNames.set(locale, entry);
  return entry;
}

/**
 * Per-locale country display names, filled on first lookup and shared across
 * PhoneNumberField instances. Creating the resolver does not construct
 * `Intl.DisplayNames` or call `.of`.
 */
export function countryNameResolver(locale: string): (countryCode: CountryCode) => string {
  return (countryCode: CountryCode): string => {
    const entry = localeEntry(locale);
    const cached = entry.names.get(countryCode);
    if (cached !== undefined) {
      return cached;
    }
    const name = entry.displayNames.of(countryCode) ?? countryCode;
    entry.names.set(countryCode, name);
    return name;
  };
}

function resolveCollator(locale: string): Intl.Collator {
  try {
    return new Intl.Collator([locale]);
  } catch {
    return new Intl.Collator(["en-US"]);
  }
}

/**
 * A copy of `countries` in the alphabetical order of their display names in `locale`, by
 * that locale's collation, so "Åland" follows "Sydafrika" in Swedish. Resolves every name,
 * so the picker calls it only once it has opened.
 */
export function sortByCountryName<Country extends { code: CountryCode }>(
  countries: readonly Country[],
  locale: string
): Country[] {
  const nameOf = countryNameResolver(locale);
  const entry = localeEntry(locale);
  entry.collator ??= resolveCollator(locale);
  const { collator } = entry;
  return countries
    .map((country) => ({ country, name: nameOf(country.code) }))
    .sort((left, right) => collator.compare(left.name, right.name))
    .map(({ country }) => country);
}

/** Drops cached locale formatters so a later mount is a cold start. */
export function resetCountryNameCache(): void {
  localeCountryNames.clear();
}
