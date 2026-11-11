import type { MetadataJson } from "libphonenumber-js/core";

import {
  cleanPhoneInput,
  defaultMetadata,
  getCountries,
  hasInternationalPrefix,
  processInputWithDetection,
  requirePickerCountries,
  resolvePhoneFieldValues,
  resolveSelectedCountry,
} from "./phone-engine";
import type {
  InternationalReading,
  PhoneParse,
  PhoneCountryCode,
  PhoneFieldValues,
  PhoneNumberCountry,
  PhoneNumberFormat,
  ProcessedPhoneInput,
} from "./phone-engine";

/**
 * Reading text into snapshots: a number, the country it is read in and the values it shows and
 * submits, under one configuration of the field. It owns how props become a configuration (the
 * catalog by structural metadata and listed codes, the four flags), how a controlled value or
 * entry is read with or without detection, how a number keeps its international identity
 * through a catalog change, and how one parse of a `+` number serves its reads in any country.
 * It holds no state of its own; the editor keeps the snapshots.
 */

/** The props a configuration reads, as `PhoneNumberField` takes them. */
export type ConfigurationProps = {
  readonly metadata?: MetadataJson;
  readonly countries?: readonly PhoneCountryCode[];
  readonly autoDetectCountry?: boolean;
  readonly international?: boolean;
  readonly outputFormat?: PhoneNumberFormat;
  readonly formatOnType?: boolean;
};

/** A parsed number with the values it shows and submits. */
export type Snapshot = ProcessedPhoneInput & {
  readonly values: PhoneFieldValues;
};

/**
 * The props that decide how numbers parse and show. `countryCodes` is what the props said;
 * `countries` is the picker rows it resolves to.
 */
export type Configuration = {
  readonly metadata: MetadataJson;
  readonly countryCodes: readonly PhoneCountryCode[] | undefined;
  readonly countries: PhoneNumberCountry[];
  readonly autoDetectCountry: boolean;
  readonly international: boolean;
  readonly outputFormat: PhoneNumberFormat;
  readonly formatOnType: boolean;
};

function sameCodes(
  left: readonly PhoneCountryCode[] | undefined,
  right: readonly PhoneCountryCode[] | undefined
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return left.length === right.length && left.every((code, index) => code === right[index]);
}

/**
 * Whether two metadata documents are the same catalog: the same object, or a shallow copy of
 * it, which shares its version and its three tables. A parent that spreads its metadata into a
 * new object each render changes nothing; a replaced document, such as max metadata in place
 * of min, has other tables.
 */
function sameMetadata(left: MetadataJson, right: MetadataJson): boolean {
  return (
    left === right ||
    (left.version === right.version &&
      left.countries === right.countries &&
      left.country_calling_codes === right.country_calling_codes &&
      left.nonGeographic === right.nonGeographic)
  );
}

/**
 * The configuration for `props`, or `previous` itself when nothing in it changed: metadata by
 * {@link sameMetadata}, which keeps the previous object, country codes by value, and the four
 * flags. A list written inline in the parent's
 * render therefore keeps its rows. An empty list stays empty, and so throws, rather than
 * reading as no list.
 */
export function configure(props: ConfigurationProps, previous?: Configuration): Configuration {
  const given = props.metadata ?? defaultMetadata;
  const metadata = previous && sameMetadata(previous.metadata, given) ? previous.metadata : given;
  const countryCodes = props.countries;
  const autoDetectCountry = props.autoDetectCountry ?? true;
  const international = props.international ?? false;
  const outputFormat = props.outputFormat ?? "e164";
  const formatOnType = props.formatOnType ?? false;
  const sameCatalog = previous?.metadata === metadata && sameCodes(previous.countryCodes, countryCodes);
  if (
    previous !== undefined &&
    sameCatalog &&
    previous.autoDetectCountry === autoDetectCountry &&
    previous.international === international &&
    previous.outputFormat === outputFormat &&
    previous.formatOnType === formatOnType
  ) {
    return previous;
  }
  return {
    metadata,
    countryCodes: countryCodes && [...countryCodes],
    countries:
      previous !== undefined && sameCatalog
        ? previous.countries
        : requirePickerCountries(getCountries(metadata, countryCodes)),
    autoDetectCountry,
    international,
    outputFormat,
    formatOnType,
  };
}

function decodeFieldValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * A processed number with the values it shows and submits; `reading` spares a parse of its `+`
 * form, `parse` one of the same digits in the same country.
 */
export function snapshot(
  next: ProcessedPhoneInput,
  configuration: Configuration,
  reading?: InternationalReading,
  parse?: PhoneParse
): Snapshot {
  const values = resolvePhoneFieldValues({
    ...configuration,
    digits: next.digits,
    parsedNational: next.parsedNational,
    country: next.country.code,
    reading,
    parse,
  });
  return { ...next, values };
}

export function receiveValue(
  input: string,
  country: PhoneNumberCountry,
  configuration: Configuration,
  known?: InternationalReading
): Snapshot {
  // One parse reads the value as it stands, none with `known`, a parse of its `+` form already
  // made; that parse is the same in every country, so it also detects the country, and the read
  // there reuses it.
  const read = readValueIn(input, country, configuration, known);
  const { reading } = read.values;
  if (!configuration.autoDetectCountry || reading === undefined) return read;
  const detected = configuration.countries.find((row) => row.code === reading.country);
  return detected ? readNamedIn(input, detected, configuration, reading) : read;
}

/**
 * A controlled value read in `country` as it stands, with no detection: for a value that names
 * no offered country, so detection could select none. At most one parse, none when `reading`
 * already parsed its `+` form.
 */
export function readValueIn(
  value: string,
  country: PhoneNumberCountry,
  configuration: Configuration,
  reading?: InternationalReading
): Snapshot {
  return snapshot(
    processInputWithDetection({
      ...configuration,
      autoDetectCountry: false,
      input: cleanPhoneInput(decodeFieldValue(value)),
      currentCountry: country,
    }),
    configuration,
    reading
  );
}

/**
 * Whether a number shown in `country` must be read again for a new configuration: its
 * metadata was replaced, or the picker no longer offers its country. A list that only gains
 * or loses other countries keeps the number as entered.
 */
export function catalogReplaced(
  from: Configuration,
  to: Configuration,
  country: PhoneNumberCountry
): boolean {
  return from.metadata !== to.metadata || !to.countries.some((row) => row.code === country.code);
}

/** Whether two configurations read and show a number alike, whatever catalog they list. */
function sameReading(from: Configuration, to: Configuration): boolean {
  return (
    from.metadata === to.metadata &&
    from.outputFormat === to.outputFormat &&
    from.international === to.international &&
    from.formatOnType === to.formatOnType
  );
}

function reformat(
  previous: Snapshot,
  country: PhoneNumberCountry,
  from: Configuration,
  to: Configuration,
  replaced: boolean
): Snapshot {
  if (!replaced) {
    // What a snapshot shows and submits depends on its digits and country and on the metadata,
    // output format and the two display flags, never on which other countries the catalog lists:
    // a catalog change alone keeps it as it is, without a parse.
    if (sameReading(from, to)) return previous.country === country ? previous : { ...previous, country };
    // The metadata is the same, so the digits read again from the parse already made of them:
    // in any country for a number written with its `+`, in the same one for a national draft.
    return snapshot(
      { digits: previous.digits, country, parsedNational: previous.parsedNational },
      to,
      previous.values.reading,
      previous.values.parse
    );
  }
  // Catalog replacement keeps the existing number's international identity. An
  // unsupported prefix remains visible instead of being reinterpreted in the new country.
  return receiveValue(entryForm(previous), country, to);
}

/**
 * `previous`, the number the field showed or the proposal the props accept, carried into a new
 * configuration: a formatting-only change re-derives values from the existing digits; a
 * catalog replacement, of the metadata or of the picker countries, preserves the number's
 * international identity.
 */
export function carry(
  from: Configuration,
  to: Configuration,
  previous: Snapshot,
  value: string | undefined
): Snapshot {
  if (from === to) return previous;
  const country = resolveSelectedCountry(to.countries, previous.country.code);
  const replaced = catalogReplaced(from, to, previous.country);
  if (value !== undefined && replaced) {
    // A controlled value the parent kept: its number reads again by its international form,
    // which keeps the number's identity, unless the field was submitting `value` and that
    // would change it. A `raw` value carries no country, so it then reads again as itself in
    // the country that remains, through the reading of its international form just made when
    // the value is written that way.
    const kept = reformat(previous, country, from, to, true);
    return kept.values.outputValue === value || previous.values.outputValue !== value
      ? kept
      : receiveValue(value, country, to, kept.values.reading);
  }
  return reformat(previous, country, from, to, replaced);
}

/**
 * `previous`, an uncontrolled number shown before new props, read once in `country`, the country
 * a controlled code requires, under the new configuration: its international entry as it stands
 * there, which keeps its identity. A catalog replacement reads it there as {@link carry} would,
 * with detection confirming `country` only, so it is never read first in a country it then
 * leaves.
 */
export function moveInto(
  from: Configuration,
  to: Configuration,
  previous: Snapshot,
  country: PhoneNumberCountry
): Snapshot {
  const input = entryForm(previous);
  const read = readValueIn(input, country, to);
  if (!catalogReplaced(from, to, previous.country)) return read;
  const { reading } = read.values;
  return to.autoDetectCountry && reading?.country === country.code
    ? readNamedIn(input, country, to, reading)
    : read;
}

/**
 * Whether a value written as a field value carries its own `+` or `00` prefix.
 *
 * @param value - The value, as `value` or `defaultValue` holds it.
 * @returns True when the cleaned value starts with an international prefix.
 */
export function hasOwnPrefix(value: string): boolean {
  return hasInternationalPrefix(cleanPhoneInput(decodeFieldValue(value)));
}

/**
 * Text the user entered, read from `country` with detection.
 *
 * @param entry - The input's text.
 * @param country - The country the field showed.
 * @param configuration - The field's configuration.
 * @returns The snapshot of the entry.
 */
export function readEntry(
  entry: string,
  country: PhoneNumberCountry,
  configuration: Configuration
): Snapshot {
  return snapshot(
    processInputWithDetection({ ...configuration, input: cleanPhoneInput(entry), currentCountry: country }),
    configuration
  );
}

/**
 * A number read again in `country` by its international form, without detection, so it keeps
 * its identity beside that country.
 *
 * @param number - The snapshot to read again.
 * @param country - The country to read it in.
 * @param configuration - The field's configuration.
 * @returns The snapshot in `country`.
 */
export function readInternationalIn(
  number: Snapshot,
  country: PhoneNumberCountry,
  configuration: Configuration
): Snapshot {
  return readValueIn(entryForm(number), country, configuration);
}

/**
 * A value read in `country`, the country it names, as {@link receiveValue} reads it there, from
 * a parse of its `+` form: its national number unless `international` keeps the digits as
 * written. No parse when `reading` is that parse.
 *
 * @param value - The controlled value.
 * @param country - The country the value names.
 * @param configuration - The field's configuration.
 * @param reading - The parse of the value's `+` form, if one is known.
 * @returns The snapshot in `country`.
 */
export function readNamedIn(
  value: string,
  country: PhoneNumberCountry,
  configuration: Configuration,
  reading: InternationalReading | undefined
): Snapshot {
  if (reading === undefined) return receiveValue(value, country, configuration);
  if (configuration.international || reading.nationalNumber === undefined) {
    return readValueIn(value, country, configuration, reading);
  }
  // The national number is read again behind the calling code. When that is the value's own input,
  // the reading serves; otherwise it is another input, which libphonenumber can read differently
  // ("+4600…" keeps a trunk 0 that "+460…" loses), and takes a parse of its own. Either way the
  // snapshot keeps the value's reading, the parse that named its country, so the value goes on
  // naming it.
  const national = snapshot(
    { digits: reading.nationalNumber, country, parsedNational: true },
    configuration,
    reading
  );
  return { ...national, values: { ...national.values, reading } };
}

/**
 * A value read in `country` as it stands, when it is the number `number` holds: their
 * international forms, `+` and digits, agree. So a parent's own form of a number, such as the
 * national digits it stores, matches the number whatever the output format spells. The read is
 * the number in `country` under `configuration`, for the caller to keep rather than read again.
 *
 * @param value - The value to read.
 * @param country - The country to read it in.
 * @param number - The snapshot whose number to compare with.
 * @param configuration - The field's configuration.
 * @returns The read when both are the same complete or partial number, else null.
 */
export function readAsNumber(
  value: string,
  country: PhoneNumberCountry,
  number: Snapshot,
  configuration: Configuration
): Snapshot | null {
  const read = readValueIn(value, country, configuration);
  // The canonical E.164 number when both make one, so a number written with an international
  // trunk zero ("+44 (0)20…") matches its national form ("020…"); the written digits otherwise,
  // as for a partial number.
  if (read.values.number !== undefined && number.values.number !== undefined) {
    return read.values.number === number.values.number ? read : null;
  }
  const written = internationalForm(read);
  return written !== "" && written === internationalForm(number) ? read : null;
}

/**
 * A snapshot's number as an international entry, from what its parse already found, to read it
 * again under a new catalog: digits that keep their own prefix as typed, spacing and dashes
 * included, so the entry shows and submits as written; detected digits, already a national
 * number, behind their calling code; a national draft as the number its parse made, under the
 * metadata it was entered with, so its own trunk prefix and local-dialling rules apply. A draft
 * that makes no number yet, such as a lone trunk 0, reads as empty, as it submits. No parse.
 *
 * @param number - The snapshot.
 * @returns Its international entry, or empty.
 */
export function entryForm({ digits, country, parsedNational, values }: Snapshot): string {
  if (!digits) return "";
  if (digits.startsWith("+")) return digits;
  if (parsedNational) return country.dialCode + digits;
  return values.number ?? "";
}

/**
 * A snapshot's number identity: its {@link entryForm} as `+` and digits alone, for comparing
 * numbers whatever spacing they were written with. No parse.
 *
 * @param number - The snapshot.
 * @returns Its international form, or empty.
 */
export function internationalForm(number: Snapshot): string {
  return entryForm(number).replace(/[^\d+]/g, "");
}
