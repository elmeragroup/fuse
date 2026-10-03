/**
 * What the New order form collects, modelled on the sales tool's private power order form
 * (`power-private`), and the parse that turns the form's raw values into a draft or field errors.
 */
import { parsePhoneNumberFromString } from "libphonenumber-js/core";
import metadata from "libphonenumber-js/metadata.min.json";

import { formatKwh } from "./dashboard-orders";
import type { Campaign, Product, StartupType } from "./dashboard-orders";

/** The form's values as its controls hold them. */
export type DraftFields = {
  readonly customer: string;
  readonly ssn: string;
  /** E.164 from the phone field: whatever has been typed, so `+47` while only the prefix is in. */
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly meterPointId: string;
  readonly product: Product;
  readonly campaign: Campaign | "none";
  readonly startup: StartupType;
  /** `yyyy-mm-dd` from the date input, or empty. */
  readonly startDate: string;
  /** Estimated kWh a year; `NaN` while the field is empty. */
  readonly annualKwh: number;
  readonly powerOfAttorney: boolean;
  readonly note: string;
};

/** A parsed draft: every field present and well-formed. */
export type DraftInput = {
  readonly customer: string;
  readonly ssn: string;
  /** A complete number for its country, E.164. */
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly meterPointId: string;
  readonly product: Product;
  readonly campaign: Campaign | undefined;
  readonly startup: StartupType;
  readonly startDate: string;
  readonly annualKwh: number;
  /** Empty when the seller left no note. */
  readonly note: string;
};

/** A form field that can carry an error. */
export type DraftField =
  | "customer"
  | "ssn"
  | "phone"
  | "email"
  | "address"
  | "meterPointId"
  | "startDate"
  | "annualKwh"
  | "powerOfAttorney";

/** The outcome of a submit: a draft, or a message for each field that needs another look. */
export type DraftParse =
  | { readonly _tag: "Draft"; readonly draft: DraftInput }
  | { readonly _tag: "Invalid"; readonly errors: ReadonlyMap<DraftField, string> };

const SSN = /^\d{11}$/u;
const METER_POINT = /^7070\d{14}$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

/** The consumption range a private household plausibly has, kWh a year. */
export const ANNUAL_KWH_RANGE = { min: 500, max: 100_000 } as const;

const digits = (value: string) => value.replaceAll(/\s/gu, "");

/**
 * Parses the form's values. The start date must fall on `today` or later.
 *
 * @param fields - The form's values.
 * @param today - The demo's date, `yyyy-mm-dd`.
 * @returns The draft, or the message each invalid field shows.
 */
export function parseDraft(fields: DraftFields, today: string): DraftParse {
  const customer = fields.customer.trim();
  const ssn = digits(fields.ssn);
  const email = fields.email.trim();
  const address = fields.address.trim();
  const meterPointId = digits(fields.meterPointId);
  // Parsed with the library and metadata the phone field formats with, so a number counts as
  // complete exactly when its country's numbering plan says so.
  const phone = parsePhoneNumberFromString(fields.phone, metadata);
  const e164 = phone?.isValid() === true ? phone.number : undefined;
  const checks: readonly (readonly [DraftField, boolean, string])[] = [
    ["customer", customer !== "", "Enter the customer's name."],
    ["ssn", SSN.test(ssn), "Enter all 11 digits."],
    ["phone", e164 !== undefined, "Enter the full phone number, including the country code."],
    ["email", EMAIL.test(email), "Enter an email address, such as navn@eksempel.no."],
    ["address", address !== "", "Enter the facility's address."],
    [
      "meterPointId",
      METER_POINT.test(meterPointId),
      "A Norwegian metering point ID has 18 digits and starts with 7070.",
    ],
    [
      "startDate",
      ISO_DATE.test(fields.startDate) && fields.startDate >= today,
      "Pick a start date from today on.",
    ],
    [
      "annualKwh",
      fields.annualKwh >= ANNUAL_KWH_RANGE.min && fields.annualKwh <= ANNUAL_KWH_RANGE.max,
      `Enter an estimate between ${formatKwh(ANNUAL_KWH_RANGE.min)} and ${formatKwh(ANNUAL_KWH_RANGE.max)}.`,
    ],
    ["powerOfAttorney", fields.powerOfAttorney, "The customer must give power of attorney first."],
  ];
  const errors = new Map(checks.filter(([, ok]) => !ok).map(([field, , message]) => [field, message]));
  if (errors.size > 0 || e164 === undefined) {
    return { _tag: "Invalid", errors };
  }
  return {
    _tag: "Draft",
    draft: {
      customer,
      ssn,
      phone: e164,
      email,
      address,
      meterPointId,
      product: fields.product,
      campaign: fields.campaign === "none" ? undefined : fields.campaign,
      startup: fields.startup,
      startDate: fields.startDate,
      annualKwh: fields.annualKwh,
      note: fields.note.trim(),
    },
  };
}
