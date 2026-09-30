/**
 * Locale formatting for the default cells. TanStack types every registered cell on every column
 * regardless of its value type, so `<cell.NumberCell />` compiles on a string column. A registered
 * cell therefore parses `getValue()` into a {@link CellValue} first, and a cell handed a value of
 * another kind renders its raw text instead of throwing.
 */
import type { SupportedLocale } from "../../intl/locale-context";

/** Number format options a number cell accepts. `style` belongs to the cell kind. */
export type NumberFormatOptions = Omit<Intl.NumberFormatOptions, "style" | "currency">;

/** The time zone a date cell formats in. */
type TimeZoneOption = {
  /**
   * The IANA time zone, such as `"Europe/Oslo"`. Defaults to the runtime's local time zone. A
   * table that renders on the server and hydrates in the browser must pass it, or the server and
   * browser text can differ.
   */
  timeZone?: Intl.DateTimeFormatOptions["timeZone"];
};

/** Date format options a date cell accepts. */
export type DateFormatOptions = Pick<Intl.DateTimeFormatOptions, "dateStyle"> & TimeZoneOption;

/** Date-time format options a date-time cell accepts. */
export type DateTimeFormatOptions = Pick<Intl.DateTimeFormatOptions, "dateStyle" | "timeStyle"> &
  TimeZoneOption;

/** A cell value, parsed from TanStack's untyped `getValue()` into the kinds the cells format. */
export type CellValue =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "date"; readonly value: Date }
  | { readonly kind: "text"; readonly value: string };

/**
 * Formatters by locale and options. Building an `Intl` formatter costs far more than formatting
 * with one, and every cell formats on each table render. The keys are bounded by the cell
 * configurations in app code, so the maps need no eviction.
 */
const numberFormats = new Map<string, Intl.NumberFormat>();
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();

function cached<TFormat>(
  cache: Map<string, TFormat>,
  locale: SupportedLocale,
  options: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions,
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
 * The raw text of a parsed cell value.
 *
 * @param cell - The parsed value.
 * @returns A number or date as `String()` renders it, or the text itself.
 */
export function cellValueText(cell: CellValue): string {
  return cell.kind === "text" ? cell.value : String(cell.value);
}

/**
 * Format a number for the locale.
 *
 * @param locale - The active supported locale.
 * @param value - The number.
 * @param options - Digits, grouping and notation.
 * @returns The formatted number.
 */
export function formatNumberCell(
  locale: SupportedLocale,
  value: number,
  options: NumberFormatOptions
): string {
  return cached(numberFormats, locale, options, () => new Intl.NumberFormat(locale, options)).format(value);
}

/**
 * Format an amount in a currency for the locale.
 *
 * @param locale - The active supported locale.
 * @param value - The amount.
 * @param currency - The ISO 4217 code, such as `"NOK"`.
 * @param options - Digits, grouping and currency display.
 * @returns The formatted amount.
 */
export function formatCurrencyCell(
  locale: SupportedLocale,
  value: number,
  currency: string,
  options: NumberFormatOptions
): string {
  const currencyOptions: Intl.NumberFormatOptions = { ...options, style: "currency", currency };
  return cached(
    numberFormats,
    locale,
    currencyOptions,
    () => new Intl.NumberFormat(locale, currencyOptions)
  ).format(value);
}

/**
 * Format a date, or a date and time, for the locale.
 *
 * @param locale - The active supported locale.
 * @param value - The date. An invalid date renders as `"Invalid Date"`, which `Intl` would throw on.
 * @param options - Date and time styles and the time zone.
 * @returns The formatted date.
 */
export function formatDateCell(locale: SupportedLocale, value: Date, options: DateTimeFormatOptions): string {
  return Number.isNaN(value.getTime())
    ? String(value)
    : cached(dateTimeFormats, locale, options, () => new Intl.DateTimeFormat(locale, options)).format(value);
}
