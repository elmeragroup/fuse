/**
 * An independent decoder of the numbers the phone editor's trace suites generate, with its own
 * calling-code table, so a suite can say what a value or display means without asking the
 * engine under test. It knows the four countries the traces use and no others.
 */

/** A country the generated traces use. SJ shares +47 with NO: a +47 number in 79 is SJ's. */
export type TraceCode = "FI" | "NO" | "SE" | "SJ";

/** The trace countries in libphonenumber's catalog order, which a fallback past NO follows. */
export const TRACE_CODES: readonly TraceCode[] = ["FI", "NO", "SE", "SJ"];

/** Each trace country's calling code, without its `+`. */
export const CALLING_CODES = { FI: "358", NO: "47", SE: "46", SJ: "47" } as const satisfies Record<
  TraceCode,
  string
>;

/** A value string as calling code and national digits; `cc` is null for countryless digits. */
export type DecodedNumber = {
  /** The calling code without its `+`, or null for digits written without a prefix. */
  readonly cc: string | null;
  /** The digits after the calling code, or all of them without one. */
  readonly nsn: string;
};

/** The catalog and detection a field reads a value under. */
export type DecodingProps = {
  /** The controlled value, if any. */
  readonly value?: string;
  /** Whether detection is on. */
  readonly autoDetectCountry: boolean;
  /** The countries the picker offers. */
  readonly countries: readonly TraceCode[];
};

/**
 * The country a calling code and national number belong to.
 *
 * @param cc - The calling code, without its `+`.
 * @param nsn - The national digits.
 * @returns The trace country, or undefined for a calling code outside the table.
 */
export function countryOfNumber(cc: string, nsn: string): TraceCode | undefined {
  if (cc === CALLING_CODES.NO) return nsn.startsWith("79") ? "SJ" : "NO";
  return TRACE_CODES.find((code) => CALLING_CODES[code] === cc);
}

/**
 * Decode a value as the traces write it. A bracketed trunk zero, "(0)", is no part of the number;
 * separators and brackets go; a `00` international prefix reads as `+`. A prefix outside the
 * table, as a preserved draft's `00` shown raw in a country without that trunk, names no calling
 * code: its digits after the `+` or `00` are the national digits.
 *
 * @param value - A generated value or output.
 * @returns Its calling code, or null, and national digits.
 */
export function decodeNumber(value: string): DecodedNumber {
  const written = value.replace(/\(0\)/g, "").replace(/[\s\-()]/g, "");
  const text = written.startsWith("00") ? `+${written.slice(2)}` : written;
  if (!text.startsWith("+")) return { cc: null, nsn: text };
  const cc = Object.values(CALLING_CODES).find((candidate) => text.startsWith(`+${candidate}`));
  if (!cc) return { cc: null, nsn: text.slice(1) };
  return { cc, nsn: text.slice(cc.length + 1) };
}

/**
 * The country a code resolves to in a catalog: itself when offered, else NO, else the first
 * offered country in catalog order.
 *
 * @param countries - The offered countries.
 * @param code - The requested country.
 * @returns The resolved country.
 * @throws When the catalog is empty, which no generator makes.
 */
export function resolveCode(countries: readonly TraceCode[], code: TraceCode): TraceCode {
  if (countries.includes(code)) return code;
  if (countries.includes("NO")) return "NO";
  const first = TRACE_CODES.find((candidate) => countries.includes(candidate));
  if (!first) throw new Error("the generators never empty the catalog");
  return first;
}

/**
 * The offered country a controlled value's own prefix names. A prefix names its country once a
 * national digit follows it, after libphonenumber strips one trunk zero: "+467" and "+4600" name
 * SE, "+46" and "+460" nothing. "+477" names nothing either: it may still become SJ's 79 as well
 * as a number of NO's.
 *
 * @param props - The value, detection and catalog.
 * @returns The named country, or null.
 */
export function namedCountry({ value, autoDetectCountry, countries }: DecodingProps): TraceCode | null {
  if (value === undefined || !autoDetectCountry) return null;
  const { cc, nsn } = decodeNumber(value);
  if (cc === null) return null;
  const national = cc === CALLING_CODES.SE || cc === CALLING_CODES.FI ? nsn.replace(/^0/, "") : nsn;
  if (national === "" || (cc === CALLING_CODES.NO && national === "7")) return null;
  const code = countryOfNumber(cc, nsn);
  return code && countries.includes(code) ? code : null;
}

/**
 * Whether a value writes a trunk zero after its SE or FI calling code, bracketed or not, as
 * "+460701234567", "+4600701234567" or "+46 (0)70…". libphonenumber strips one trunk prefix per
 * parse, so the value as written and the national number behind its calling code read
 * differently, and reading it in a country takes a parse of each.
 *
 * @param value - A generated value.
 * @returns Whether a trunk zero follows its SE or FI calling code.
 */
export function writesTrunkPrefix(value: string): boolean {
  const written = value.replace(/[\s\-()]/g, "");
  const text = written.startsWith("00") ? `+${written.slice(2)}` : written;
  return text.startsWith(`+${CALLING_CODES.SE}0`) || text.startsWith(`+${CALLING_CODES.FI}0`);
}

/**
 * Digits without the trunk zeros before them. libphonenumber strips one trunk prefix per parse,
 * and a value its own prefix names is parsed twice, as written and then as its national number
 * behind the calling code, so "+4600701234567" shows "701234567".
 *
 * @param digits - National digits.
 * @returns The digits without leading zeros.
 */
export function significantDigits(digits: string): string {
  return digits.replace(/^0+/, "");
}

/**
 * The digits a display shows, as the national significant number.
 *
 * @param display - The input's text.
 * @returns Its national significant digits.
 */
export function projectDisplay(display: string): string {
  let digits = display.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    digits = digits.slice(1);
    const cc = Object.values(CALLING_CODES).find((candidate) => digits.startsWith(candidate));
    if (cc) digits = digits.slice(cc.length);
  }
  return significantDigits(digits);
}
