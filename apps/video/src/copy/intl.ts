/** Formatters built so far, by locale and options. */
const numberFormats = new Map<string, Intl.NumberFormat>();
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * The cached formatter for a key, built on first use. Frame-driven components ask for the same
 * formatter on every frame, so each is built once.
 *
 * @returns The formatter.
 */
function cached<Format>(cache: Map<string, Format>, key: string, build: () => Format): Format {
  let format = cache.get(key);
  if (format === undefined) {
    format = build();
    cache.set(key, format);
  }
  return format;
}

/**
 * A number formatter for the video's locale, built once per locale and options.
 *
 * @param locale - The video's locale.
 * @param options - The format's options.
 * @returns The formatter.
 */
export function numberFormat(locale: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  return cached(
    numberFormats,
    `${locale} ${JSON.stringify(options)}`,
    () => new Intl.NumberFormat(locale, options)
  );
}

/**
 * A date and time formatter for the video's locale, built once per locale and options.
 *
 * @param locale - The video's locale.
 * @param options - The format's options.
 * @returns The formatter.
 */
export function dateTimeFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions = {}
): Intl.DateTimeFormat {
  return cached(
    dateTimeFormats,
    `${locale} ${JSON.stringify(options)}`,
    () => new Intl.DateTimeFormat(locale, options)
  );
}
