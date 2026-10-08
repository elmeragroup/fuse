import type { CountryCode, MetadataJson } from "libphonenumber-js/core";

import {
  cleanPhoneInput,
  defaultMetadata,
  getCountries,
  processInputWithDetection,
  requirePickerCountries,
  resolvePhoneFieldValues,
  resolveSelectedCountry,
  toInternationalInput,
} from "./phone-engine";
import type {
  PhoneCountryCode,
  PhoneFieldValues,
  PhoneNumberCountry,
  PhoneNumberFormat,
  ProcessedPhoneInput,
} from "./phone-engine";

/**
 * The phone editor: every change to the typed number, its country and the caret, as pure
 * transitions over an opaque {@link PhoneEditorState}. An edit, paste or country pick becomes a
 * proposal, which stays visible while the parent leaves `value` undefined or echoes the
 * proposal's output. `reconcile` folds new props in; `view` reads what the field shows.
 */

/** The props the editor reads, as `PhoneNumberField` takes them. */
export type PhoneEditorProps = {
  /** Authoritative controlled value; URI-decoded when received. */
  readonly value?: string;
  /** Initial number of an uncontrolled field, and the target of its form reset. */
  readonly defaultValue?: string;
  /** Initial country, and the country a reset reads its default in. */
  readonly defaultCountryCode?: PhoneCountryCode;
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
  /** Where the edit that proposed the shown display left the caret, or null to leave it alone. */
  readonly selection: PhoneSelection | null;
  /**
   * Identifies the edit `selection` belongs to, so a caller can apply it once: a new edit
   * gets a new key even when it proposes the display already shown. Null with no selection.
   */
  readonly proposalKey: object | null;
};

/** Which side of the separators between two digits a caret takes. */
type CaretSide =
  /** Right after the digit before it, as after typing or Backspace. */
  | "afterPrevious"
  /** Right before the digit after it, so a forward Delete reaches that digit. */
  | "beforeNext";

/**
 * A selection kept as the number of digits (and `+`) after each end. Separators change, and a
 * display can gain or lose a prefix, such as the calling code an international display adds in
 * front of the first typed digit, but what follows the caret keeps its digits.
 */
type Caret = {
  readonly start: number;
  readonly end: number;
  readonly side: CaretSide;
  readonly direction: PhoneSelectionDirection | null;
};

/** A parsed number with the values it shows and submits, and the caret its edit left. */
type Snapshot = ProcessedPhoneInput & {
  readonly values: PhoneFieldValues;
  readonly caret: Caret | null;
};

/**
 * The props that decide how numbers parse and show. `countryCodes` is what the props said;
 * `countries` is the picker rows it resolves to.
 */
type Configuration = {
  readonly metadata: MetadataJson;
  readonly countryCodes: readonly PhoneCountryCode[] | undefined;
  readonly countries: PhoneNumberCountry[];
  readonly autoDetectCountry: boolean;
  readonly international: boolean;
  readonly outputFormat: PhoneNumberFormat;
  readonly formatOnType: boolean;
};

type EditorRecord = {
  readonly configuration: Configuration;
  readonly value: string | undefined;
  readonly defaultValue: string | undefined;
  readonly defaultCountryCode: PhoneCountryCode | undefined;
  readonly preserveOnCountryChange: boolean;
  readonly accepted: Snapshot;
  readonly proposal: Snapshot | null;
  /**
   * The proposal came from the latest transition, and no props have answered it yet. It shows
   * until they do, so a caller can read what it proposes from `view`.
   */
  readonly unanswered: boolean;
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

function wrap(record: EditorRecord): PhoneEditorState {
  return { [RECORD]: record };
}

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
 * The configuration for `props`, or `previous` itself when nothing in it changed: metadata by
 * identity, country codes by value, and the four flags. A list written inline in the parent's
 * render therefore keeps its rows. An empty list stays empty, and so throws, rather than
 * reading as no list.
 */
function configure(props: PhoneEditorProps, previous?: Configuration): Configuration {
  const metadata = props.metadata ?? defaultMetadata;
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

function snapshot(
  next: ProcessedPhoneInput,
  configuration: Configuration,
  caret: (values: PhoneFieldValues) => Caret | null = () => null
): Snapshot {
  const values = resolvePhoneFieldValues({
    ...configuration,
    digits: next.digits,
    parsedNational: next.parsedNational,
    country: next.country.code,
  });
  return { ...next, values, caret: caret(values) };
}

function receiveValue(input: string, country: PhoneNumberCountry, configuration: Configuration): Snapshot {
  return snapshot(
    processInputWithDetection({
      ...configuration,
      input: cleanPhoneInput(decodeFieldValue(input)),
      currentCountry: country,
    }),
    configuration
  );
}

/**
 * A proposal stays visible only while the parent has not rejected its output, and until props
 * answer it.
 */
function visibleSnapshot({ value, accepted, proposal, unanswered }: EditorRecord): Snapshot {
  return proposal && (unanswered || value === undefined || proposal.values.outputValue === value)
    ? proposal
    : accepted;
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

/** A proposal over the visible state, which becomes the accepted one behind it. */
function propose(stored: EditorRecord, proposal: Snapshot): PhoneEditorState {
  return wrap({ ...stored, accepted: visibleSnapshot(stored), proposal, unanswered: true });
}

function proposeEntry(
  stored: EditorRecord,
  entry: string,
  caret: (values: PhoneFieldValues) => Caret | null
): PhoneEditorState {
  const next = processInputWithDetection({
    ...stored.configuration,
    input: cleanPhoneInput(entry),
    currentCountry: visibleSnapshot(stored).country,
  });
  return propose(stored, snapshot(next, stored.configuration, caret));
}

/**
 * Whether a number shown in `country` must be read again for a new configuration: its
 * metadata was replaced, or the picker no longer offers its country. A list that only gains
 * or loses other countries keeps the number as entered.
 */
function catalogReplaced(from: Configuration, to: Configuration, country: PhoneNumberCountry): boolean {
  return from.metadata !== to.metadata || !to.countries.some((row) => row.code === country.code);
}

function reformat(
  previous: Snapshot,
  country: PhoneNumberCountry,
  from: Configuration,
  to: Configuration,
  replaced: boolean
): Snapshot {
  if (!replaced) {
    return snapshot({ digits: previous.digits, country, parsedNational: previous.parsedNational }, to);
  }
  // Catalog replacement keeps the existing number's international identity. An
  // unsupported prefix remains visible instead of being reinterpreted in the new country.
  return receiveValue(toInternationalInput(previous, from.metadata), country, to);
}

/**
 * The accepted snapshot for a new value or configuration. An echoed proposal becomes the
 * accepted snapshot; a formatting-only change re-derives values from the existing digits; a
 * catalog replacement, of the metadata or of the picker countries, preserves the number's
 * international identity.
 */
function answer(stored: EditorRecord, value: string | undefined, configuration: Configuration): Snapshot {
  const echoedProposal = stored.proposal?.values.outputValue === value ? stored.proposal : null;
  if (echoedProposal && stored.configuration === configuration) {
    return echoedProposal;
  }
  const previous = echoedProposal ?? visibleSnapshot(stored);
  const country = resolveSelectedCountry(configuration.countries, previous.country.code);
  const replaced = catalogReplaced(stored.configuration, configuration, previous.country);
  if (value !== undefined && stored.value !== value && !echoedProposal) {
    return receiveValue(value, country, configuration);
  }
  if (value !== undefined && replaced) {
    // A controlled value the parent kept: its number reads again by its international form,
    // which keeps the number's identity, unless the field was submitting `value` and that
    // would change it. A `raw` value carries no country, so it then reads again as itself in
    // the country that remains.
    const kept = reformat(previous, country, stored.configuration, configuration, true);
    return kept.values.outputValue === value || previous.values.outputValue !== value
      ? kept
      : receiveValue(value, country, configuration);
  }
  return reformat(previous, country, stored.configuration, configuration, replaced);
}

/**
 * The state for a field's first props: the controlled value, else the default, read in the
 * default country.
 *
 * @param props - The field's props.
 * @returns The initial state.
 * @throws When the props leave no picker country, a configuration defect.
 */
export function create(props: PhoneEditorProps): PhoneEditorState {
  const configuration = configure(props);
  return wrap({
    configuration,
    value: props.value,
    defaultValue: props.defaultValue,
    defaultCountryCode: props.defaultCountryCode,
    preserveOnCountryChange: props.preserveOnCountryChange ?? false,
    accepted: receiveValue(
      props.value ?? props.defaultValue ?? "",
      resolveSelectedCountry(configuration.countries, props.defaultCountryCode),
      configuration
    ),
    proposal: null,
    unanswered: false,
  });
}

/**
 * Fold new props into the state. A proposal the parent echoes becomes the accepted state, one
 * it rejects stays out of view, and a new value, configuration or catalog is read as described
 * on {@link PhoneEditorProps}. The first answer to an edit keeps its caret when the field
 * shows the display the edit proposed, whatever value the parent stored.
 *
 * @param state - The current state.
 * @param props - The field's props now.
 * @returns `state` itself when nothing changed, else the next state.
 * @throws When the props leave no picker country, a configuration defect.
 */
export function reconcile(state: PhoneEditorState, props: PhoneEditorProps): PhoneEditorState {
  const stored = state[RECORD];
  const configuration = configure(props, stored.configuration);
  const next: EditorRecord = {
    ...stored,
    defaultValue: props.defaultValue,
    defaultCountryCode: props.defaultCountryCode,
    preserveOnCountryChange: props.preserveOnCountryChange ?? false,
    unanswered: false,
  };
  if (configuration === stored.configuration && stored.value === props.value) {
    const unchanged =
      !stored.unanswered &&
      stored.defaultValue === next.defaultValue &&
      stored.defaultCountryCode === next.defaultCountryCode &&
      stored.preserveOnCountryChange === next.preserveOnCountryChange;
    return unchanged ? state : wrap(settleCaret(stored, next));
  }
  return wrap(
    settleCaret(stored, {
      ...next,
      configuration,
      value: props.value,
      accepted: answer(next, props.value, configuration),
      proposal: null,
    })
  );
}

/**
 * Where an edit's caret goes when props first answer its proposal, from `stored` to `record`.
 * When the field then shows the proposal's display, whatever value the parent stored or however
 * a new configuration re-derived it, the shown snapshot takes the proposal's caret, so the
 * commit that answers it puts the caret back. Otherwise the caret is dropped, and a proposal
 * kept out of view loses it too: a later, delayed echo shows its number again but leaves the
 * caret where the user has put it since.
 */
function settleCaret(stored: EditorRecord, record: EditorRecord): EditorRecord {
  const { proposal } = stored;
  const shown = visibleSnapshot(record);
  if (!stored.unanswered || !proposal?.caret || shown === proposal) {
    return record;
  }
  return {
    ...record,
    accepted:
      shown.values.displayValue === proposal.values.displayValue
        ? { ...record.accepted, caret: proposal.caret }
        : record.accepted,
    proposal: record.proposal && { ...record.proposal, caret: null },
  };
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
  return proposeEntry(state[RECORD], value, ({ displayValue }) =>
    displayValue !== value && selectionStart !== null && selectionEnd !== null
      ? {
          start: significantAfter(value, selectionStart),
          end: significantAfter(value, selectionEnd),
          side,
          direction: selectionDirection,
        }
      : null
  );
}

/**
 * Propose pasted text in place of the number, with no caret to restore.
 *
 * @param state - The current state.
 * @param text - The clipboard text.
 * @returns The state with the paste proposed.
 */
export function paste(state: PhoneEditorState, text: string): PhoneEditorState {
  return proposeEntry(state[RECORD], text, () => null);
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
  const country = stored.configuration.countries.find((row) => row.code === code);
  if (!country) return state;
  return propose(
    stored,
    snapshot(
      stored.preserveOnCountryChange
        ? { digits: current.digits, country, parsedNational: current.parsedNational }
        : { digits: "", country },
      stored.configuration
    )
  );
}

/**
 * Native form reset for an uncontrolled field, with no proposal. A default number, `""`
 * included, is read again as on mount, in the default country and under the current
 * configuration, so a later formatting or catalog change shows in it. Without one, the
 * digits empty and the visible country stays.
 *
 * @param state - The current state.
 * @returns The reset state.
 */
export function reset(state: PhoneEditorState): PhoneEditorState {
  const stored = state[RECORD];
  const { configuration, defaultValue } = stored;
  return wrap({
    ...stored,
    accepted:
      defaultValue !== undefined
        ? receiveValue(
            defaultValue,
            resolveSelectedCountry(configuration.countries, stored.defaultCountryCode),
            configuration
          )
        : snapshot({ digits: "", country: visibleSnapshot(stored).country }, configuration),
    proposal: null,
    unanswered: false,
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
  const { caret } = shown;
  return {
    displayValue,
    outputValue,
    country: shown.country,
    countries: stored.configuration.countries,
    selection: caret && {
      start: caretOffset(displayValue, caret.start, caret.side),
      end: caretOffset(displayValue, caret.end, caret.side),
      direction: caret.direction,
    },
    proposalKey: caret,
  };
}
