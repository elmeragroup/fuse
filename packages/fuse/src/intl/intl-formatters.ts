/**
 * Cached Intl formatters for every module that formats on render. Building an Intl formatter costs
 * far more than formatting with one, and cells and chart labels format on each render. The keys are
 * bounded by the locales, zones and formats in app code, so the caches need no eviction.
 */

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
const pluralRuleSets = new Map<string, Intl.PluralRules>();

function cached<T>(
  cache: Map<string, T>,
  locale: string,
  options: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions | Intl.PluralRulesOptions,
  create: () => T
): T {
  const key = `${locale}\u0000${JSON.stringify(options)}`;
  let value = cache.get(key);
  if (value === undefined) {
    value = create();
    cache.set(key, value);
  }
  return value;
}

/**
 * The cached `Intl.NumberFormat` for a locale and options.
 *
 * @param locale - The BCP 47 locale.
 * @param options - The number format options.
 * @returns A formatter shared by every caller with the same locale and options.
 */
export function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  return cached(numberFormats, locale, options, () => new Intl.NumberFormat(locale, options));
}

/**
 * The cached `Intl.DateTimeFormat` for a locale and options.
 *
 * @param locale - The BCP 47 locale.
 * @param options - The date and time format options, including any `timeZone`.
 * @returns A formatter shared by every caller with the same locale and options.
 * @throws {RangeError} When `options.timeZone` is not an IANA zone.
 */
export function dateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return cached(dateTimeFormats, locale, options, () => new Intl.DateTimeFormat(locale, options));
}

/**
 * The cached `Intl.PluralRules` for a locale and options.
 *
 * @param locale - The BCP 47 locale.
 * @param options - The plural rule options, such as the fraction digits the number shows.
 * @returns Rules shared by every caller with the same locale and options.
 */
export function pluralRules(locale: string, options: Intl.PluralRulesOptions): Intl.PluralRules {
  return cached(pluralRuleSets, locale, options, () => new Intl.PluralRules(locale, options));
}
