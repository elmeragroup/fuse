import type { CountryCode, MetadataJson } from "libphonenumber-js/core";

import {
  cleanPhoneInput,
  createPhoneParser,
  defaultMetadata,
  getCountries,
  hasInternationalPrefix,
  internationalNumber,
  processInputWithDetection,
  requirePickerCountries,
  resolvePhoneFieldValues,
  resolveSelectedCountry,
  toE164Digits,
  valuesRead,
} from "./phone-engine";
import type {
  PhoneCountryCode,
  PhoneFieldValues,
  PhoneNumberCountry,
  PhoneNumberFormat,
  ParsePins,
  ParseRead,
  PhoneParser,
  ProcessedPhoneInput,
} from "./phone-engine";

/**
 * Reading text into snapshots: a number, the country it is read in and the values it shows and
 * submits, under one configuration of the field. It decides how props become a configuration, from the
 * catalog by structural metadata and listed codes and from the four flags, how a controlled value or
 * entry is read with or without detection, and how a number keeps its international identity through
 * a catalog change. Every read parses through the configuration's {@link PhoneParser}, so a read of
 * an input that another read parsed recently costs no parse. The module keeps no state of its own.
 * Each configuration's parser keeps the memo, and the editor keeps the snapshots.
 */

/** The props a configuration reads, as `PhoneNumberField` takes them. */
type ConfigurationProps = {
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
 * `countries` is the picker rows it resolves to; `parser` parses with `metadata`.
 */
export type Configuration = {
  readonly metadata: MetadataJson;
  readonly parser: PhoneParser;
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
 * {@link sameMetadata}, in which case it keeps the previous object and its parser with the parses
 * that parser made, country codes by value, and the four flags. A list written inline in the
 * parent's render therefore keeps its rows. An empty list stays empty, and so throws, rather than
 * reading as no list. Without `previous`, `configure` creates a new parser, so no two editors share
 * one.
 */
export function configure(props: ConfigurationProps, previous?: Configuration): Configuration {
  const given = props.metadata ?? defaultMetadata;
  const keepsMetadata = previous !== undefined && sameMetadata(previous.metadata, given);
  const metadata = keepsMetadata ? previous.metadata : given;
  const parser = keepsMetadata ? previous.parser : createPhoneParser(metadata);
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
    parser,
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

/**
 * The picker row for `code` in a configuration's catalog.
 *
 * @param configuration - The configuration whose catalog to search.
 * @param code - A country code, or `undefined`.
 * @returns The offered row, or `undefined` when the catalog does not offer `code`.
 */
export function offeredCountry(
  configuration: Pick<Configuration, "countries">,
  code: string | undefined
): PhoneNumberCountry | undefined {
  return configuration.countries.find((row) => row.code === code);
}

function decodeFieldValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** A processed number with the values it shows and submits. */
export function snapshot(next: ProcessedPhoneInput, configuration: Configuration): Snapshot {
  const values = resolvePhoneFieldValues({
    ...configuration,
    digits: next.digits,
    parsedNational: next.parsedNational,
    country: next.country.code,
  });
  return { ...next, values };
}

/**
 * The country that a field value's own `+` or `00` prefix detects. It comes from the parse of the
 * value's `+` form, which is the same in every country.
 *
 * @param value - The value, as the `value` or `defaultValue` prop gives it.
 * @param configuration - The field's configuration.
 * @returns The detected country, or `undefined` without a prefix or when the parse identifies no
 * country, such as for `"+10"`.
 */
export function prefixCountry(value: string, configuration: Configuration): CountryCode | undefined {
  return internationalNumber(cleanPhoneInput(decodeFieldValue(value)), configuration.parser)?.country;
}

/**
 * A field value read from `country`, with detection when `autoDetectCountry` is on. With detection
 * on, it reads a value whose own prefix names an offered country in that country, as its national
 * number unless `international` keeps the digits as written. With detection off or no offered
 * country detected, it reads the value in `country` as it stands. The parse that detects the country is the parse of the value's `+` form, which is the
 * same in every country and is the one {@link prefixCountry} also reads.
 *
 * @param value - The value, as the `value` or `defaultValue` prop gives it.
 * @param country - The country to read it from.
 * @param configuration - The field's configuration.
 * @returns The snapshot of the value.
 */
export function receiveValue(
  value: string,
  country: PhoneNumberCountry,
  configuration: Configuration
): Snapshot {
  return readEntry(decodeFieldValue(value), country, configuration);
}

/** A field value processed in `country` as it stands, with no detection, so it parses nothing. */
function valueEntry(
  value: string,
  country: PhoneNumberCountry,
  configuration: Configuration
): ProcessedPhoneInput {
  return processInputWithDetection({
    ...configuration,
    autoDetectCountry: false,
    input: cleanPhoneInput(decodeFieldValue(value)),
    currentCountry: country,
  });
}

/**
 * A controlled value read in `country` as it stands, with no detection. Use it for a value that
 * names no offered country, where detection could select none. It parses at most once and parses
 * nothing when the configuration's parser already keeps that read.
 */
export function readValueIn(
  value: string,
  country: PhoneNumberCountry,
  configuration: Configuration
): Snapshot {
  return snapshot(valueEntry(value, country, configuration), configuration);
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
  return from.metadata !== to.metadata || offeredCountry(to, country.code) === undefined;
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
    // The metadata is the same, so both configurations use one parser, and reading the digits
    // again reuses the parse it already made of them.
    return snapshot({ digits: previous.digits, country, parsedNational: previous.parsedNational }, to);
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
  const kept = reformat(previous, country, from, to, catalogReplaced(from, to, previous.country));
  return carryValue(from, to, previous, kept, value);
}

/**
 * `previous` carried into a new configuration as {@link carry} carries it with `value`, from
 * `kept`, the carry without a controlled value. A caller that keeps `kept` carries again into the
 * same configuration without reading `previous` again.
 *
 * @param from - The configuration `previous` was read in.
 * @param to - The new configuration.
 * @param previous - The number carried.
 * @param kept - `carry(from, to, previous, undefined)`.
 * @param value - The controlled value, if any.
 * @returns The number read in `to`.
 */
export function carryValue(
  from: Configuration,
  to: Configuration,
  previous: Snapshot,
  kept: Snapshot,
  value: string | undefined
): Snapshot {
  if (value === undefined || from === to || !catalogReplaced(from, to, previous.country)) return kept;
  // A controlled value the parent kept: its number reads again by its international form, which
  // keeps the number's identity, unless the field was submitting `value` and that would change
  // it. A `raw` value carries no country, so it then reads again as itself in the country that
  // remains.
  return kept.values.outputValue === value || previous.values.outputValue !== value
    ? kept
    : receiveValue(value, resolveSelectedCountry(to.countries, previous.country.code), to);
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
  if (!catalogReplaced(from, to, previous.country)) return readValueIn(input, country, to);
  // Detection reads the input in `country` only when its prefix names `country` itself.
  return to.autoDetectCountry && prefixCountry(input, to) === country.code
    ? receiveValue(input, country, to)
    : readValueIn(input, country, to);
}

/** The read {@link snapshot} parses for `entry`. */
function entryRead(
  { digits, parsedNational, country }: ProcessedPhoneInput,
  { parser }: Configuration
): ParseRead {
  return valuesRead(digits, parsedNational, country.code, parser.metadata);
}

/**
 * The parses a field's state needs, for the state to keep as its pins. They are each number's own
 * parse and, with a controlled value, the value's parse as {@link readValueIn} reads it in the
 * first number's country. For a value with its own prefix, that is also the parse that names its
 * country. It parses nothing.
 *
 * @param configuration - The state's configuration.
 * @param value - The controlled value, if any.
 * @param numbers - The state's numbers, the accepted one first.
 * @returns The parses the configuration's parser keeps of those reads.
 */
export function pinReads(
  configuration: Configuration,
  value: string | undefined,
  numbers: readonly [Snapshot, ...Snapshot[]]
): ParsePins {
  const entries: readonly ProcessedPhoneInput[] =
    value === undefined ? numbers : [...numbers, valueEntry(value, numbers[0].country, configuration)];
  return configuration.parser.pin(entries.map((entry) => entryRead(entry, configuration)));
}

/**
 * Whether a value written as a field value carries its own `+` or `00` prefix.
 *
 * @param value - The value, as `value` or `defaultValue` holds it.
 * @returns `true` when the cleaned value starts with an international prefix.
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
 * A value read in `country` as it stands, when it is the number `number` holds: their
 * international forms, `+` and digits, agree. So a parent's own form of a number, such as the
 * national digits it stores, matches the number whatever the output format spells. The read is
 * the number in `country` under `configuration`, for the caller to keep rather than read again.
 *
 * @param value - The value to read.
 * @param country - The country to read it in.
 * @param number - The snapshot whose number to compare with.
 * @param configuration - The field's configuration.
 * @returns The read when both are the same complete or partial number, else `null`.
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
 * metadata it was entered with, so its own trunk prefix and local-dialing rules apply. A draft
 * that makes no number yet, such as a lone trunk 0, reads as empty, as it submits. It parses
 * nothing.
 *
 * @param number - The snapshot.
 * @returns Its international entry, or `""`.
 */
function entryForm({ digits, country, parsedNational, values }: Snapshot): string {
  if (!digits) return "";
  if (digits.startsWith("+")) return digits;
  if (parsedNational) return country.dialCode + digits;
  return values.number ?? "";
}

/**
 * A snapshot's number identity: its {@link entryForm} as `+` and digits alone, for comparing
 * numbers whatever spacing they were written with. It parses nothing.
 *
 * @param number - The snapshot.
 * @returns Its international form, or `""`.
 */
function internationalForm(number: Snapshot): string {
  return toE164Digits(entryForm(number));
}
