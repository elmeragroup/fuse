import type { CountryCode, MetadataJson } from "libphonenumber-js/core";

import type { CountryObservation } from "./phone-country-notices";
import { resolveSelectedCountry } from "./phone-engine";
import type {
  InternationalReading,
  PhoneCountryCode,
  PhoneNumberCountry,
  PhoneNumberFormat,
} from "./phone-engine";
import { pendingProposal, proposalFate } from "./phone-proposal";
import type { JudgedProps, PendingProposal } from "./phone-proposal";
import {
  carry,
  catalogReplaced,
  configure,
  hasOwnPrefix,
  moveInto,
  offeredCountry,
  readEntry as readEntryIn,
  readInternationalIn,
  readNamedIn,
  readValueIn,
  receiveValue,
  snapshot,
} from "./phone-snapshot";
import type { Configuration, Snapshot } from "./phone-snapshot";

/**
 * The phone editor: every change to the typed number, its country and the caret, as pure
 * transitions over an opaque {@link PhoneEditorState}. An edit, paste or country pick becomes a
 * proposal, which shows while the parent leaves `value` undefined or echoes the proposal's
 * output, and, when it moves the country, leaves `countryCode` undefined or echoes that country.
 * `reconcile` folds new props in; `view` reads what the field shows, `proposedValue` the output
 * a transition just proposed, `steeredValue` what a `countryCode` change proposed, and
 * `observeCountry` what `phone-country-notices` needs to decide what `onCountryChange` hears.
 */

/** The props the editor reads, as `PhoneNumberField` takes them. */
export type PhoneEditorProps = {
  /** Authoritative controlled value; URI-decoded when received. */
  readonly value?: string;
  /** Initial number of an uncontrolled field, and the target of its form reset. */
  readonly defaultValue?: string;
  /** Initial country, and the country a reset reads its default in. */
  readonly defaultCountryCode?: PhoneCountryCode;
  /**
   * Authoritative controlled country, in place of `defaultCountryCode`. A change acts like a
   * pick, except that a controlled `value` which names its own country keeps it.
   */
  readonly countryCode?: PhoneCountryCode;
  /** The catalog numbers parse with. */
  readonly metadata?: MetadataJson;
  /** The codes the picker offers, compared by value. */
  readonly countries?: readonly PhoneCountryCode[];
  /** Detect the country from a `+` or `00` prefix. */
  readonly autoDetectCountry?: boolean;
  /** Keep entered digits and international prefixes in the display. */
  readonly international?: boolean;
  /** The format of the output value. */
  readonly outputFormat?: PhoneNumberFormat;
  /** Format the display as the user types. */
  readonly formatOnType?: boolean;
  /** Keep the digits when the country changes. */
  readonly preserveOnCountryChange?: boolean;
};

/** A selection direction, as `HTMLInputElement.selectionDirection` reports it. */
export type PhoneSelectionDirection = "forward" | "backward" | "none";

/** One change to the input's text, read from the input after the browser applied it. */
export type PhoneEdit = {
  /** The input's value after the change. */
  readonly value: string;
  /** The input's `selectionStart` after the change. */
  readonly selectionStart: number | null;
  /** The input's `selectionEnd` after the change. */
  readonly selectionEnd: number | null;
  /** The input's `selectionDirection` after the change. */
  readonly selectionDirection: PhoneSelectionDirection | null;
  /** The `inputType` of the change's `InputEvent`, or null for any other event. */
  readonly inputType: string | null;
};

/** A selection as UTF-16 offsets into the display, as `setSelectionRange` takes them. */
export type PhoneSelection = {
  /** The offset of the selection's start. */
  readonly start: number;
  /** The offset of the selection's end. */
  readonly end: number;
  /** The selection's direction, when the edit reported one. */
  readonly direction: PhoneSelectionDirection | null;
};

/** What the field shows for a state. */
export type PhoneEditorView = {
  /** The text the number input shows. */
  readonly displayValue: string;
  /** The value the field emits and submits. */
  readonly outputValue: string;
  /** The country the picker shows. */
  readonly country: Readonly<PhoneNumberCountry>;
  /**
   * The picker countries, in catalog order. The same array until the catalog changes. Read-only,
   * since the editor keeps reading the configuration through it.
   */
  readonly countries: ReadonlyArray<Readonly<PhoneNumberCountry>>;
  /**
   * Where the latest edit left the caret, while the field shows the display it proposed, or
   * null to leave the caret alone. The same object for as long as that edit's caret lasts,
   * and a new one for each edit, even one that proposes the display already shown, so a
   * caller applies it once by its identity.
   */
  readonly selection: PhoneSelection | null;
};

/** Which side of the separators between two digits a caret takes. */
type CaretSide =
  /** Right after the digit before it, as after typing or Backspace. */
  | "afterPrevious"
  /** Right before the digit after it, so a forward Delete reaches that digit. */
  | "beforeNext";

/**
 * The caret the latest edit left, placed in the display it proposed. One caret belongs to the
 * record, not to a snapshot: it lasts while the field shows `display`, and the first answer
 * that shows anything else drops it for good, so no later commit can show it again.
 */
type EditCaret = {
  readonly display: string;
  readonly selection: PhoneSelection;
};

type EditorRecord = {
  readonly configuration: Configuration;
  readonly value: string | undefined;
  readonly defaultValue: string | undefined;
  readonly defaultCountryCode: PhoneCountryCode | undefined;
  readonly countryCode: PhoneCountryCode | undefined;
  readonly preserveOnCountryChange: boolean;
  readonly accepted: Snapshot;
  readonly proposal: Snapshot | null;
  readonly caret: EditCaret | null;
  /** The output the latest `countryCode` change proposed, until a transition replaces it. */
  readonly steered: ValueNotice | null;
  /**
   * The value that holds the waiting proposal's number: the output the parent heard for it, or
   * the countryless form of its own the parent answered its number with. It outlives the
   * formatting changes that carry the proposal into a new output, so the parent's answer in the
   * form it heard still holds the number. Null without a waiting proposal.
   */
  readonly numberAnswer: string | null;
  /** The country the controlled value's own prefix detects, cached by value and metadata. */
  readonly detection: ValueDetection | null;
  /**
   * How many transitions led to this state: 0 for a new field, one more for each transition. A
   * caller that sees states out of order, as the hook's notices do, tells the older one by it.
   */
  readonly version: number;
};

/**
 * The parse of a value string's own `+` form, for the value and metadata it was made with: the
 * country its prefix detects, and a parse that serves the value in any country.
 */
type ValueDetection = {
  readonly value: string;
  readonly metadata: MetadataJson;
  readonly reading: InternationalReading | undefined;
};

/**
 * An output a props change proposed: the number a `countryCode` pick leaves, cleared or kept under
 * `preserveOnCountryChange`, or the number of an uncontrolled proposal the props show only now. A
 * new object for each, so the hook sends it once by its identity.
 */
export type ValueNotice = {
  /** The proposed output value. */
  readonly value: string;
};

const RECORD = Symbol("PhoneEditorState");

/** The editor's state. Read it through {@link view}; change it through the transitions. */
export type PhoneEditorState = { readonly [RECORD]: EditorRecord };

/** Edits that remove what follows the caret, so it waits before the next digit. */
const FORWARD_DELETIONS = new Set([
  "deleteContentForward",
  "deleteWordForward",
  "deleteSoftLineForward",
  "deleteHardLineForward",
  "deleteByCut",
]);

const SIGNIFICANT_REGEX = /[\d+]/;

/** `record` as the state that follows `stored`, one version on. */
function succeed(stored: EditorRecord, record: EditorRecord): PhoneEditorState {
  return wrap({ ...record, version: stored.version + 1 });
}

function wrap(record: EditorRecord): PhoneEditorState {
  return { [RECORD]: record };
}

/**
 * The controlled value when it can name a country: a controlled `countryCode` is set, detection
 * is on, and the value itself carries a `+` or `00` prefix. Else null.
 */
function namingValue({ value, countryCode, configuration }: EditorRecord): string | null {
  return value !== undefined &&
    countryCode !== undefined &&
    configuration.autoDetectCountry &&
    hasOwnPrefix(value)
    ? value
    : null;
}

/**
 * The record with the parse a read of its controlled value carries, at no cost: the accepted
 * number's, when it read the value as a whole. That parse of the number with its `+` prefix is
 * the same in every country, so its country is the one the prefix detects.
 */
function seeded(record: EditorRecord): EditorRecord {
  const { value, configuration, accepted } = record;
  if (value === undefined || !hasOwnPrefix(value)) {
    return record;
  }
  return {
    ...record,
    detection: { value, metadata: configuration.metadata, reading: accepted.values.reading },
  };
}

/** The detection the record holds for its current value under its metadata, or null. */
function currentDetection({ value, configuration, detection }: EditorRecord): ValueDetection | null {
  return detection !== null && detection.value === value && detection.metadata === configuration.metadata
    ? detection
    : null;
}

/**
 * The record with the parse of its controlled value, when the value can name a country: the
 * one it holds, the accepted number's parse of the same text, or one parse of the value as it
 * stands. Every later read of the value, in any country, reuses it, so detection and the reads
 * that follow share one parse.
 */
function detected(record: EditorRecord): EditorRecord {
  const value = namingValue(record);
  const controlled = controlledCountry(record);
  if (value === null || controlled === null || currentDetection(record) !== null) return record;
  const { configuration, accepted } = record;
  // The accepted number's reading serves when it read the very text the value holds, as an
  // adopted raw echo of a paste did; the engine reuses a reading of that input only.
  const { reading } = readValueIn(value, controlled, configuration, accepted.values.reading).values;
  return { ...record, detection: { value, metadata: configuration.metadata, reading } };
}

/** A controlled value and the offered country its own prefix names. */
type NamedValue = {
  readonly value: string;
  readonly country: PhoneNumberCountry;
};

/**
 * The controlled value read in the country it names, as {@link receiveValue} reads it there,
 * from the parse the record holds: its national number unless `international` keeps the digits
 * as written. No parse when the record holds the value's parse.
 */
function readNamed(record: EditorRecord, { value, country }: NamedValue): Snapshot {
  return readNamedIn(value, country, record.configuration, currentDetection(record)?.reading);
}

/**
 * The country the record's controlled value names, from the detection it holds only, so it
 * parses nothing; null without one.
 */
function cachedValueCountry(record: EditorRecord): NamedValue | null {
  const value = namingValue(record);
  const country = offeredCountry(record.configuration, currentDetection(record)?.reading?.country);
  return value !== null && country !== undefined ? { value, country } : null;
}

/**
 * The country a controlled `value` names under a controlled `countryCode`: the offered country
 * the value's own prefix detects. Read from the value string as a whole, never from a snapshot
 * of a national entry, whose parse would lend a partial number the picker's country. A value
 * without a prefix, as `raw` or `national` output usually is, names none, whatever country its
 * digits were shown in. Without a controlled country the shown country follows the proposal
 * and picker as before, so a value names none.
 */
function valueCountry(record: EditorRecord): NamedValue | null {
  return cachedValueCountry(detected(record));
}

/** The country a controlled `countryCode` resolves to in the record's catalog. */
function controlledCountry({
  countryCode,
  configuration,
}: Pick<EditorRecord, "countryCode" | "configuration">): PhoneNumberCountry | null {
  return countryCode === undefined ? null : resolveSelectedCountry(configuration.countries, countryCode);
}

/**
 * The country the field shows, in one precedence order, for the record's props:
 *
 * 1. the country the controlled `value` names, under a controlled `countryCode`;
 * 2. else the country of `held`, a proposal whose output the parent holds, when the parent
 *    leaves `countryCode` undefined or sets it to that country;
 * 3. else the country `countryCode` resolves to in the current catalog;
 * 4. else the country of `number`, the snapshot the field shows otherwise.
 *
 * Acceptance, steering, catalog changes and notifications all follow from it.
 */
function shownCountry(record: EditorRecord, held: Snapshot | null, number: Snapshot): PhoneNumberCountry {
  const controlled = controlledCountry(record);
  const heldCountry =
    held && (controlled === null || held.country.code === controlled.code) ? held.country : null;
  return valueCountry(record)?.country ?? heldCountry ?? controlled ?? number.country;
}

/**
 * Whether the record shows `proposal`: the parent leaves `value` undefined or holds the
 * proposal's output, and the shown country, with the proposal held, is the proposal's own.
 * A proposal it does not show is out of view from the transition that makes it: the parent's
 * answer arrives as new props, and an answer that repeats the old props rejects it.
 */
function shows(record: EditorRecord, proposal: Snapshot): boolean {
  const { value, accepted } = record;
  return (
    (value === undefined || proposal.values.outputValue === value) &&
    shownCountry(record, proposal, accepted).code === proposal.country.code
  );
}

function visibleSnapshot(record: EditorRecord): Snapshot {
  const { proposal, accepted } = record;
  return proposal && shows(record, proposal) ? proposal : accepted;
}

/** The caret the field shows, or null when it shows a display other than the caret's. */
function shownCaret(record: EditorRecord): EditCaret | null {
  const { caret } = record;
  return caret && visibleSnapshot(record).values.displayValue === caret.display ? caret : null;
}

function significantOffsets(text: string): number[] {
  const offsets: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (SIGNIFICANT_REGEX.test(text.charAt(index))) offsets.push(index);
  }
  return offsets;
}

/** How many digits and `+` signs follow `offset` in `text`. */
function significantAfter(text: string, offset: number): number {
  return significantOffsets(text).filter((index) => index >= offset).length;
}

/**
 * The offset in `text` with `after` digits or `+` signs after it, on the given side. Offsets
 * are UTF-16 indices, as `setSelectionRange` takes them.
 */
function caretOffset(text: string, after: number, side: CaretSide): number {
  const offsets = significantOffsets(text);
  const before = offsets.length - after;
  if (side === "beforeNext") {
    return offsets[Math.max(0, before)] ?? text.length;
  }
  const previous = before > 0 ? offsets[Math.min(before, offsets.length) - 1] : undefined;
  return previous === undefined ? 0 : previous + 1;
}

/**
 * A proposal over the visible state, which becomes the accepted one behind it. The proposal's
 * caret replaces the record's, so an earlier edit's caret can never show again.
 */
function propose(stored: EditorRecord, proposal: Snapshot, caret: EditCaret | null): PhoneEditorState {
  return succeed(stored, {
    ...stored,
    accepted: visibleSnapshot(stored),
    proposal,
    caret,
    steered: null,
    numberAnswer: proposal.values.outputValue,
  });
}

/**
 * The output of the record's proposal when it differs from the value the parent holds: the
 * `value` prop, or without one the accepted output, which a proposal made over the visible
 * state holds as the output shown before it. An uncontrolled number reports only what the
 * field shows, so a proposal it does not show yet reports nothing; the props that show it
 * report it through `steered`.
 */
function proposalOutput(record: EditorRecord): string | null {
  const { proposal, value, accepted } = record;
  if (!proposal || (value === undefined && !shows(record, proposal))) return null;
  const held = value ?? accepted.values.outputValue;
  return proposal.values.outputValue === held ? null : proposal.values.outputValue;
}

/** The snapshot for text entered over the visible state, read from its country. */
function readEntry(stored: EditorRecord, entry: string): Snapshot {
  return readEntryIn(entry, visibleSnapshot(stored).country, stored.configuration);
}

/** The props that shape later resets and picks only, never what the field shows now. */
type Settings = Pick<EditorRecord, "defaultValue" | "defaultCountryCode" | "preserveOnCountryChange">;

/** The settings the props give, with `preserveOnCountryChange` defaulted. */
function readSettings(props: PhoneEditorProps): Settings {
  return {
    defaultValue: props.defaultValue,
    defaultCountryCode: props.defaultCountryCode,
    preserveOnCountryChange: props.preserveOnCountryChange ?? false,
  };
}

function sameSettings(left: Settings, right: Settings): boolean {
  return (
    left.defaultValue === right.defaultValue &&
    left.defaultCountryCode === right.defaultCountryCode &&
    left.preserveOnCountryChange === right.preserveOnCountryChange
  );
}

/**
 * The number a field reads from its first props or a reset: the controlled value, with
 * detection, in the controlled country, else the default one; an uncontrolled default under a
 * controlled country in that country without detection, since only a controlled value names a
 * country over `countryCode`; else the default in the default country.
 */
function readInitial(
  record: Pick<EditorRecord, "configuration" | "value" | "countryCode">,
  input: string,
  fallback: PhoneNumberCountry
): Snapshot {
  const { configuration, value } = record;
  const controlled = controlledCountry(record);
  if (value === undefined && controlled) return readValueIn(input, controlled, configuration);
  return receiveValue(input, controlled ?? fallback, configuration);
}

/**
 * The state for a field's first props, read as {@link readInitial} says.
 *
 * @param props - The field's props.
 * @returns The initial state.
 * @throws When the props leave no picker country, a configuration defect.
 */
export function create(props: PhoneEditorProps): PhoneEditorState {
  const configuration = configure(props);
  const { value, countryCode } = props;
  const accepted = readInitial(
    { configuration, value, countryCode },
    value ?? props.defaultValue ?? "",
    resolveSelectedCountry(configuration.countries, props.defaultCountryCode)
  );
  // A controlled value read as a whole carries its own detection.
  return wrap(
    seeded({
      ...readSettings(props),
      configuration,
      value,
      countryCode,
      accepted,
      proposal: null,
      caret: null,
      steered: null,
      numberAnswer: null,
      detection: null,
      version: 0,
    })
  );
}

/**
 * The proposal the new props show, which becomes the accepted number, or null. Releasing
 * `countryCode` judges it as if the parent had set the country shown before, so the field keeps
 * showing it; releasing `value` accepts nothing, and drops a proposal the parent held its value
 * against, as releasing `countryCode` keeps the shown country.
 */
function adoptedProposal(stored: EditorRecord, next: EditorRecord, before: Snapshot): Snapshot | null {
  const { proposal } = stored;
  if (proposal === null || (stored.value !== undefined && next.value === undefined)) return null;
  const judge =
    stored.countryCode !== undefined && next.countryCode === undefined
      ? { ...next, countryCode: before.country.code }
      : next;
  return shows(judge, proposal) ? proposal : null;
}

/** The record as {@link proposalFate} judges it: its props and the countries they name. */
function judged(record: EditorRecord): JudgedProps {
  const { value, countryCode, configuration } = record;
  const controlled = controlledCountry(record);
  const named = cachedValueCountry(record)?.country ?? null;
  return { value, countryCode, configuration, controlled, named };
}

/**
 * The country new props pick, or null; the one place the props pick a country, which clears the
 * number unless `preserveOnCountryChange` keeps it. A clearing pick is a move of the controlled
 * country itself: a new code, or a catalog that resolves the same code to another country; a
 * catalog, detection or metadata change that leaves it in place keeps the number, and a country
 * answer to a pending proposal is no pick of its own. A value that names its country shows there
 * instead, so no pick moves it. Call it only for props that neither show the proposal nor bring a
 * new value.
 */
function pickedCountry(
  stored: EditorRecord,
  next: EditorRecord,
  before: Snapshot,
  pending: PendingProposal | null
): PhoneNumberCountry | null {
  const controlled = controlledCountry(next);
  return controlled !== null &&
    pending?.country !== "answered" &&
    valueCountry(next) === null &&
    controlledCountry(stored)?.code !== controlled.code &&
    before.country.code !== controlled.code
    ? controlled
    : null;
}

/**
 * The accepted number for new props that pick no country: the proposal they show, else a new
 * controlled value, read in the controlled country, else the shown one, else the number shown
 * before. Under a controlled country the props alone decide where that number goes: the country
 * the value names, else the controlled one. When it moves there, or a replaced catalog reads it
 * again, deciding that first reads the number once, there, rather than carrying it into the
 * configuration and reading it again; no snapshot is built only to be replaced.
 */
function placeNumber(
  stored: EditorRecord,
  next: EditorRecord,
  before: Snapshot,
  adopted: Snapshot | null,
  newValue: string | null
): Snapshot {
  const { configuration, value } = next;
  const controlled = controlledCountry(next);
  if (adopted) return carry(stored.configuration, configuration, adopted, value);
  if (newValue !== null) {
    const country = controlled ?? resolveSelectedCountry(configuration.countries, before.country.code);
    return receiveValue(newValue, country, configuration, currentDetection(next)?.reading);
  }
  const named = controlled === null ? null : valueCountry(next);
  const target = named?.country ?? controlled;
  if (
    target === null ||
    (target.code === resolveSelectedCountry(configuration.countries, before.country.code).code &&
      !catalogReplaced(stored.configuration, configuration, before.country))
  ) {
    return carry(stored.configuration, configuration, before, value);
  }
  if (named !== null) return readNamed(next, named);
  if (value !== undefined) return realign(next, before, target);
  return moveInto(stored.configuration, configuration, before, target);
}

/**
 * The record with its accepted number in the country {@link shownCountry} requires of it: read
 * in the country the value names, else read again as it stands, so it keeps its international
 * identity beside that country.
 */
function alignToPrecedence(record: EditorRecord): EditorRecord {
  const { accepted } = record;
  const named = valueCountry(record);
  const country = named?.country ?? controlledCountry(record) ?? accepted.country;
  if (accepted.country.code === country.code) return record;
  return { ...record, accepted: named ? readNamed(record, named) : realign(record, accepted, country) };
}

/**
 * The record for new props, from one rule: the accepted number comes from a proposal the new
 * props show, else a new controlled value, else the number shown before; then its country is
 * the one {@link shownCountry} derives. When that country moved for the shown number, by a new
 * `countryCode` or a catalog that resolves it elsewhere, the move is a pick of it, from the
 * number shown before, so the catalog's own move of the number never stands in for the pick.
 * A waiting proposal's fate is {@link proposalFate}'s. Notifications come from the same
 * transition: a pick's output, or an uncontrolled proposal that showed only now.
 */
function settle(stored: EditorRecord, given: EditorRecord): EditorRecord {
  const before = visibleSnapshot(stored);
  const { value } = given;
  // A new value that echoes no proposal is read as a whole, which carries its detection, so
  // only a value the field already holds, or one a proposal proposed, takes a detection parse.
  const echoes = stored.proposal !== null && stored.proposal.values.outputValue === value;
  const next = value === stored.value || echoes ? detected(given) : given;
  const adopted = adoptedProposal(stored, next, before);
  const newValue = adopted === null && value !== undefined && value !== stored.value ? value : null;
  const pending = adopted === null ? pendingProposal(stored, next) : null;
  // The pick is decided before any snapshot is built, so the number is read once, in the country
  // picked, never carried first into the catalog it then leaves.
  const picked = adopted === null && newValue === null ? pickedCountry(stored, next, before, pending) : null;
  if (picked !== null) return pick(next, before, picked);
  const accepted = placeNumber(stored, next, before, adopted, newValue);
  const waiting = pending && proposalFate(stored, judged(next), pending);
  const placed: EditorRecord = {
    ...next,
    accepted,
    proposal: waiting?.proposal ?? null,
    numberAnswer: waiting?.numberAnswer ?? null,
  };
  const aligned = alignToPrecedence(newValue === null ? placed : seeded(placed));
  if (adopted && value === undefined && !shows(stored, adopted)) {
    // An uncontrolled proposal shows only now, so `onChange` hears it only now.
    const output = aligned.accepted.values.outputValue;
    return output === before.values.outputValue ? aligned : { ...aligned, steered: { value: output } };
  }
  return aligned;
}

/**
 * `accepted` read again in `country` without detection: a controlled value as it stands, else
 * the number's international form. At most one parse, and never a pick: the output keeps the
 * number.
 */
function realign(record: EditorRecord, accepted: Snapshot, country: PhoneNumberCountry): Snapshot {
  const { value, configuration } = record;
  if (value !== undefined)
    return readValueIn(value, country, configuration, currentDetection(record)?.reading);
  return readInternationalIn(accepted, country, configuration);
}

/**
 * `current` picked into `country`: its digits kept when `preserveOnCountryChange` says so, else
 * cleared. A preserved national draft keeps its digits as typed.
 */
function pickedSnapshot(
  { configuration, preserveOnCountryChange }: Pick<EditorRecord, "configuration" | "preserveOnCountryChange">,
  current: Snapshot,
  country: PhoneNumberCountry
): Snapshot {
  return snapshot(
    preserveOnCountryChange
      ? { digits: current.digits, country, parsedNational: current.parsedNational }
      : { digits: "", country },
    configuration
  );
}

/**
 * A pick of `country` by the props, over `before`, the number shown before them: the digits
 * clear unless `preserveOnCountryChange` keeps them. An uncontrolled number takes the pick at
 * once. A controlled value, which names no offered country here, is read as it stands in
 * `country`, and the pick is proposed over it, to show once the parent echoes its output. The
 * pick's output, when it differs from the value the parent holds, waits in `steered` for
 * `onChange`. At most one parse: the digits read in `country`, which a cleared pick does not need.
 */
function pick(record: EditorRecord, before: Snapshot, country: PhoneNumberCountry): EditorRecord {
  const { configuration, value, preserveOnCountryChange } = record;
  if (value === undefined) {
    const picked = pickedSnapshot(record, before, country);
    const output = picked.values.outputValue;
    return {
      ...record,
      accepted: picked,
      proposal: null,
      numberAnswer: null,
      steered: output === before.values.outputValue ? record.steered : { value: output },
    };
  }
  const read = readValueIn(value, country, configuration, currentDetection(record)?.reading);
  const picked = preserveOnCountryChange ? read : snapshot({ digits: "", country }, configuration);
  const output = picked.values.outputValue;
  return {
    ...record,
    accepted: read,
    proposal: picked === read ? null : picked,
    numberAnswer: picked === read ? null : output,
    // As a pick through the picker: nothing for `onChange` only when the output is the value the
    // parent holds. A parent that stores another form of the number hears it.
    steered: output === value ? record.steered : { value: output },
  };
}

/**
 * Fold new props into the state, as {@link settle} says. A proposal the parent echoes becomes
 * the accepted state, one it rejects stays out of view, and a new value, configuration or
 * catalog is read as described on {@link PhoneEditorProps}. Props that keep the value, the
 * configuration and `countryCode` show what they showed: a waiting proposal stays, unless it can
 * never show. The latest edit's caret lasts while the field shows the display the edit proposed,
 * whatever value the parent stored, and is dropped for good by the first props that show another
 * display.
 *
 * @param state - The current state.
 * @param props - The field's props now.
 * @returns `state` itself when nothing changed, else the next state.
 * @throws When the props leave no picker country, a configuration defect.
 */
export function reconcile(state: PhoneEditorState, props: PhoneEditorProps): PhoneEditorState {
  const stored = state[RECORD];
  const configuration = configure(props, stored.configuration);
  const settings = readSettings(props);
  const changesReading =
    configuration !== stored.configuration ||
    props.value !== stored.value ||
    props.countryCode !== stored.countryCode;
  const record = changesReading
    ? settle(stored, {
        ...stored,
        ...settings,
        configuration,
        value: props.value,
        countryCode: props.countryCode,
      })
    : kept(stored, settings);
  const caret = shownCaret(record);
  return record === stored && caret === stored.caret ? state : succeed(stored, { ...record, caret });
}

/**
 * The record for props that change only settings, or nothing: `stored` itself unless a setting
 * changed or the waiting proposal ended.
 */
function kept(stored: EditorRecord, settings: Settings): EditorRecord {
  const pending = pendingProposal(stored, stored);
  const ends =
    stored.proposal !== null && (pending === null || proposalFate(stored, judged(stored), pending) === null);
  if (!ends && sameSettings(stored, settings)) return stored;
  return ends ? { ...stored, ...settings, proposal: null, numberAnswer: null } : { ...stored, ...settings };
}

/**
 * Propose what the user typed. The caret is kept as the digits after each end of the
 * selection: a forward deletion leaves it before the next digit, any other edit after the
 * previous one. No caret is kept when the display is what was typed.
 *
 * @param state - The current state.
 * @param change - The input's value and selection after the change.
 * @returns The state with the edit proposed.
 */
export function edit(
  state: PhoneEditorState,
  { value, selectionStart, selectionEnd, selectionDirection, inputType }: PhoneEdit
): PhoneEditorState {
  const side: CaretSide =
    inputType !== null && FORWARD_DELETIONS.has(inputType) ? "beforeNext" : "afterPrevious";
  const stored = state[RECORD];
  const next = readEntry(stored, value);
  const display = next.values.displayValue;
  // The caret is kept as the digits after each end, which the new display keeps even where
  // its separators or prefix change.
  const caret: EditCaret | null =
    display !== value && selectionStart !== null && selectionEnd !== null
      ? {
          display,
          selection: {
            start: caretOffset(display, significantAfter(value, selectionStart), side),
            end: caretOffset(display, significantAfter(value, selectionEnd), side),
            direction: selectionDirection,
          },
        }
      : null;
  return propose(stored, next, caret);
}

/**
 * Propose pasted text in place of the number, with no caret to restore.
 *
 * @param state - The current state.
 * @param text - The clipboard text.
 * @returns The state with the paste proposed.
 */
export function paste(state: PhoneEditorState, text: string): PhoneEditorState {
  const stored = state[RECORD];
  return propose(stored, readEntry(stored, text), null);
}

/**
 * Propose a picked country. The digits clear unless `preserveOnCountryChange` keeps them.
 *
 * @param state - The current state.
 * @param code - The picked country's code.
 * @returns `state` itself for the shown country, no country or one the picker lacks, else
 * the state with the pick proposed.
 */
export function selectCountry(state: PhoneEditorState, code: CountryCode | undefined): PhoneEditorState {
  const stored = state[RECORD];
  const current = visibleSnapshot(stored);
  if (!code || code === current.country.code) return state;
  const country = offeredCountry(stored.configuration, code);
  if (!country) return state;
  return propose(stored, pickedSnapshot(stored, current, country), null);
}

/**
 * Native form reset for an uncontrolled field, with no proposal. A default number, `""`
 * included, is read again as on mount ({@link readInitial}), under the current configuration, so
 * a later formatting or catalog change shows in it.
 * Without one, the digits empty in the controlled country, else the visible one.
 *
 * @param state - The current state.
 * @returns The reset state.
 */
export function reset(state: PhoneEditorState): PhoneEditorState {
  const stored = state[RECORD];
  const { configuration, defaultValue } = stored;
  return succeed(stored, {
    ...stored,
    accepted:
      defaultValue !== undefined
        ? readInitial(
            stored,
            defaultValue,
            resolveSelectedCountry(configuration.countries, stored.defaultCountryCode)
          )
        : snapshot(
            { digits: "", country: controlledCountry(stored) ?? visibleSnapshot(stored).country },
            configuration
          ),
    proposal: null,
    caret: null,
    steered: null,
    numberAnswer: null,
  });
}

/**
 * What the field shows for a state.
 *
 * @param state - The state to read.
 * @returns The display, output, country, picker rows and the caret to restore.
 */
export function view(state: PhoneEditorState): PhoneEditorView {
  const stored = state[RECORD];
  const shown = visibleSnapshot(stored);
  const { displayValue, outputValue } = shown.values;
  return {
    displayValue,
    outputValue,
    country: shown.country,
    countries: stored.configuration.countries,
    selection: shownCaret(stored)?.selection ?? null,
  };
}

/**
 * The output a state from {@link edit}, {@link paste} or {@link selectCountry} sends `onChange`,
 * never read on a {@link reconcile} state: its proposal's output value, when it differs from the
 * value the parent holds, the `value` prop of a controlled field, compared as given, or the output
 * an uncontrolled field showed before the proposal. A controlled field shows that proposal only
 * once the parent echoes it. An uncontrolled number's proposal that moves the
 * country against a controlled `countryCode` reports nothing here: it shows, and reports through
 * {@link steeredValue}, once the parent sets that country.
 *
 * One rule covers every proposal, edit, paste, country pick and the hydration edit alike,
 * because it is a rule about the output: a call that repeats the parent's value tells it
 * nothing. Deleting a separator re-formats the display and proposes the same number, so it
 * calls nothing, and its caret still shows from the state. A parent that stores another form of
 * the number, such as national digits under `outputFormat="e164"`, holds a value that differs
 * from every proposal and so hears each one.
 *
 * @param state - The state a proposing transition returned.
 * @returns The proposal's output, or null when the state holds no proposal or its output is the
 * value the parent holds.
 */
export function proposedValue(state: PhoneEditorState): string | null {
  return proposalOutput(state[RECORD]);
}

/**
 * The output the latest `countryCode` change proposed, for `onChange`: the pick's output when
 * it differs from the value the parent holds, or the output of an uncontrolled number's
 * proposal that the change revealed. Later props that propose nothing carry it forward; an
 * edit, paste, picker pick or reset clears it. A new object for each change, so a caller sends
 * it once by its identity.
 *
 * @param state - The current state.
 * @returns The latest steered output, or null when none was proposed since the last user
 * transition or reset.
 */
export function steeredValue(state: PhoneEditorState): ValueNotice | null {
  return state[RECORD].steered;
}

/**
 * The state as the country notices observe it: its version, the controlled code, the country it
 * shows and the country of a proposal waiting for the parent.
 *
 * @param state - The state to observe.
 * @returns The observation for `phone-country-notices`.
 */
export function observeCountry(state: PhoneEditorState): CountryObservation {
  const { version, countryCode, proposal } = state[RECORD];
  return { version, countryCode, shown: view(state).country, proposed: proposal?.country ?? null };
}
