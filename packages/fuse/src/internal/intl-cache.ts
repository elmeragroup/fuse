/**
 * Intl formatters by locale and options. Building an `Intl` formatter costs far more than
 * formatting with one, and table cells, filter chips, option counts and chart labels format on
 * every render. The keys are bounded by the configurations in app code, so the maps need no
 * eviction.
 */

type FormatOptions =
  | Intl.NumberFormatOptions
  | Intl.DateTimeFormatOptions
  | Intl.ListFormatOptions
  | Intl.PluralRulesOptions;

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
const listFormats = new Map<string, Intl.ListFormat>();
const pluralRuleSets = new Map<string, Intl.PluralRules>();

function cached<TFormat>(
  cache: Map<string, TFormat>,
  locale: string,
  options: FormatOptions,
  create: () => TFormat
): TFormat {
  const key = `${locale}\u0000${JSON.stringify(options)}`;
  let format = cache.get(key);
  if (format === undefined) {
    format = create();
    cache.set(key, format);
  }
  return format;
}

/**
 * The shared `Intl.NumberFormat` for a locale and options.
 *
 * @param locale - The locale.
 * @param options - The format options.
 * @returns The formatter.
 */
export function numberFormat(locale: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  return cached(numberFormats, locale, options, () => new Intl.NumberFormat(locale, options));
}

/**
 * The shared `Intl.DateTimeFormat` for a locale and options.
 *
 * @param locale - The locale.
 * @param options - The format options.
 * @returns The formatter.
 */
export function dateTimeFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions = {}
): Intl.DateTimeFormat {
  return cached(dateTimeFormats, locale, options, () => new Intl.DateTimeFormat(locale, options));
}

/**
 * The shared `Intl.ListFormat` for a locale and options.
 *
 * @param locale - The locale.
 * @param options - The format options.
 * @returns The formatter.
 */
export function listFormat(locale: string, options: Intl.ListFormatOptions = {}): Intl.ListFormat {
  return cached(listFormats, locale, options, () => new Intl.ListFormat(locale, options));
}

/**
 * The shared `Intl.PluralRules` for a locale and options.
 *
 * @param locale - The locale.
 * @param options - The plural rule options, such as the fraction digits the number shows.
 * @returns The rules.
 */
export function pluralRules(locale: string, options: Intl.PluralRulesOptions = {}): Intl.PluralRules {
  return cached(pluralRuleSets, locale, options, () => new Intl.PluralRules(locale, options));
}
