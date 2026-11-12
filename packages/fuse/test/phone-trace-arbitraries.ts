import fc from "fast-check";

import { CALLING_CODES, TRACE_CODES } from "./phone-number-oracle";
import type { TraceCode } from "./phone-number-oracle";

/**
 * Generators the phone editor's trace suites share: the countries, catalogs, output formats and
 * user actions a trace draws from. Each suite keeps its own number pool and props, which differ
 * on purpose.
 */

/** An output format a trace draws. */
export type TraceFormat = "e164" | "raw" | "international" | "national";

/** A valid national number of each trace country, without a trunk prefix. */
export const NATIONAL_NUMBERS = {
  FI: "401234567",
  NO: "41234567",
  SE: "701234567",
  SJ: "79123456",
} as const satisfies Record<TraceCode, string>;

/**
 * How a paste writes its number: plainly with its `+`; with its trunk zero in brackets,
 * "+46 (0)70…", where the country has one; or as national digits with no prefix, "070…", which
 * no detection reads.
 */
export type PasteForm = "plain" | "trunk" | "national";

/** A user action a trace performs. */
export type TraceUserAction =
  | { readonly kind: "pick"; readonly country: TraceCode }
  | { readonly kind: "paste"; readonly country: TraceCode; readonly form: PasteForm }
  | { readonly kind: "edit"; readonly digits: string };

/**
 * A country's number in one paste form. SE and FI write a trunk zero before national numbers;
 * NO and SJ write none.
 *
 * @param country - The number's country.
 * @param form - How the paste writes it.
 * @returns The pasted text.
 */
export function pasteText(country: TraceCode, form: PasteForm): string {
  const trunked = country === "SE" || country === "FI";
  const national = NATIONAL_NUMBERS[country];
  if (form === "national") return trunked ? `0${national}` : national;
  return form === "trunk" && trunked
    ? `+${CALLING_CODES[country]} (0)${national}`
    : `+${CALLING_CODES[country]}${national}`;
}

/** Any trace country. */
export const traceCode: fc.Arbitrary<TraceCode> = fc.constantFrom(...TRACE_CODES);

/** A non-empty catalog of trace countries, in catalog order. */
export const traceCatalog: fc.Arbitrary<TraceCode[]> = fc.subarray([...TRACE_CODES], { minLength: 1 });

/** Any output format. */
export const traceFormat: fc.Arbitrary<TraceFormat> = fc.constantFrom(
  "e164",
  "raw",
  "international",
  "national"
);

/** A pick, a paste in any form, or an edit to empty or to a national number. */
export const traceUserAction: fc.Arbitrary<TraceUserAction> = fc.oneof(
  traceCode.map((country) => ({ kind: "pick" as const, country })),
  fc
    .tuple(traceCode, fc.constantFrom<PasteForm>("plain", "trunk", "national"))
    .map(([country, form]) => ({ kind: "paste" as const, country, form })),
  fc.constantFrom("", ...Object.values(NATIONAL_NUMBERS)).map((digits) => ({ kind: "edit" as const, digits }))
);
