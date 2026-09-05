import type { CountryCode } from "libphonenumber-js/core";

type LocaleCountryNames = {
  displayNames: Intl.DisplayNames;
  names: Map<string, string>;
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

/** Drops cached locale formatters so a later mount is a cold start. */
export function resetCountryNameCache(): void {
  localeCountryNames.clear();
}
