// Text written in a field's own format read back into its units, part by part along the parts the
// field writes itself (`fieldParts` in `date-field-format.ts`), so a paste of what the field shows
// reads as what it shows. Each part has a reader that takes the text left and returns the text
// after its part, with the unit's number or the zone's name it read.

import { canonicalSpaces } from "../../intl/canonical-spaces";
import type { EditableSegmentType } from "./date-draft";
import {
  LEFT_TO_RIGHT_ISOLATE,
  POP_DIRECTIONAL_ISOLATE,
  dayPeriodNames,
  fieldParts,
  zoneNameAt,
} from "./date-field-format";
import type { FieldFormat, FieldPart } from "./date-field-format";

/** One unit's number in text written in a field's format; a day period is 0 before noon, 1 after. */
export type FieldTextEntry = { readonly type: EditableSegmentType; readonly value: number };

/** Text written in a field's format, read back: its units, and what its zone's name says. */
export type FieldText = {
  /** Every shown unit's number, in display order. */
  readonly entries: readonly FieldTextEntry[];
  /**
   * Whether the zone's name the text wrote is the field's zone's name at an instant: how a wall
   * time a zone repeats (02:30 on the night the clocks go back) tells its two instants apart.
   * Always true for text that wrote no zone name, and for a field without a zone.
   */
  readonly namesZoneAt: (instant: number) => boolean;
};

/** One run of separators: spaces, punctuation and format characters, the time's isolates among them. */
const SEPARATOR_RUN = String.raw`[\p{P}\p{Z}\s\p{Cf}]+`;

/** Separators the reading skips between parts. */
const SEPARATORS = new RegExp(`^(?:${SEPARATOR_RUN})?`, "u");

/** Separators around a literal's own word. */
const EDGE_SEPARATORS = new RegExp(`^${SEPARATOR_RUN}|${SEPARATOR_RUN}$`, "gu");

/** What may stand around a zone's name the text wrote: spaces, a comma and the time's isolates. */
const ZONE_NAME_EDGES = new RegExp(
  `^[\\s,${LEFT_TO_RIGHT_ISOLATE}${POP_DIRECTIONAL_ISOLATE}]+|[\\s,${LEFT_TO_RIGHT_ISOLATE}${POP_DIRECTIONAL_ISOLATE}]+$`,
  "gu"
);

/** What a part's reader read: the text after its part, and the unit or the zone's name it read. */
type PartRead = {
  readonly rest: string;
  readonly entry?: FieldTextEntry;
  readonly zoneName?: string;
};

/** Whether a literal is one of the isolates around the time, which carry no text of their own. */
function isIsolate(text: string): boolean {
  return text === LEFT_TO_RIGHT_ISOLATE || text === POP_DIRECTIONAL_ISOLATE;
}

/** A literal's own text: what is left once its spaces, punctuation and isolates are taken off. */
function literalWord(text: string): string {
  return text.replace(EDGE_SEPARATORS, "");
}

/**
 * `text` after a word the field writes, the word matched by case alone: its accents count, so a
 * word of another spelling is no match, composed or decomposed. Only a slice of the word's own
 * length is compared, so the rest returned is the raw text that follows it.
 *
 * @returns The text after the word, or `undefined` when it does not start with the word.
 */
function afterWord(text: string, word: string, locale: string): string | undefined {
  const head = text.slice(0, word.length);
  return word !== "" && head.localeCompare(word, locale, { sensitivity: "accent" }) === 0
    ? text.slice(word.length)
    : undefined;
}

/** A literal with a word of its own, such as fi-FI's `klo`, reads that word; any other, nothing. */
function readLiteral(rest: string, text: string, locale: string): PartRead | undefined {
  const word = literalWord(text);
  if (word === "") {
    return { rest };
  }
  const after = afterWord(rest, word, locale);
  return after === undefined ? undefined : { rest: after };
}

/** The day period reads the next word, the locale's morning or afternoon word. */
function readDayPeriod(rest: string, locale: string): PartRead | undefined {
  // The longer word first, where one locale's morning word starts its afternoon one.
  const [match] = dayPeriodNames(locale)
    .map((name, value) => ({ value, after: afterWord(rest, name, locale), length: name.length }))
    .filter((candidate) => candidate.after !== undefined)
    .sort((left, right) => right.length - left.length);
  return match?.after === undefined
    ? undefined
    : { rest: match.after, entry: { type: "dayPeriod", value: match.value } };
}

/** A number unit reads the next run of digits. */
function readNumber(rest: string, type: EditableSegmentType): PartRead | undefined {
  const digits = /^\d+/u.exec(rest);
  return digits === null
    ? undefined
    : {
        rest: rest.slice(digits[0].length),
        entry: { type, value: Number.parseInt(digits[0], 10) },
      };
}

/**
 * The zone's name reads the text up to the next literal the field writes with text of its own, or
 * to the end when nothing follows it, kept apart from the units so its offset digits ("GMT+2") are
 * never a unit's.
 */
function readZoneName(rest: string, later: readonly FieldPart[]): PartRead | undefined {
  const [next] = later.flatMap((part) =>
    part.kind === "literal" && part.text.trim() !== "" && !isIsolate(part.text) ? [part.text.trim()] : []
  );
  const end = next === undefined ? rest.length : rest.indexOf(next);
  return end < 0 ? undefined : { rest: rest.slice(end), zoneName: rest.slice(0, end) };
}

/** One part read from the text left, with the parts the field writes after it. */
function readPart(
  part: FieldPart,
  rest: string,
  later: readonly FieldPart[],
  locale: string
): PartRead | undefined {
  switch (part.kind) {
    case "literal":
      return readLiteral(rest, part.text, locale);
    case "timeZoneName":
      return readZoneName(rest, later);
    case "segment":
      return part.type === "dayPeriod" ? readDayPeriod(rest, locale) : readNumber(rest, part.type);
  }
}

/**
 * Text written in the field's own format read back into its units, part by part along the parts
 * the field writes itself, consuming the whole text:
 *
 * - each number unit takes the next run of digits;
 * - the day period, the next word, which must be the locale's morning or afternoon word;
 * - a literal with a word of its own, such as fi-FI's `klo`, that word, in any case but with its
 *   own accents (see `afterWord`);
 * - the zone's name, the text up to the next literal or the end; `namesZoneAt` compares it with the
 *   name the field writes at an instant, so a caller can pick the instant the text meant.
 *
 * Between them only spaces, punctuation and the isolates around the time may stand, whatever
 * punctuation the field itself writes, so "10/05/2026" and "10-05-2026" both read in en-US. A letter
 * or a digit anywhere else, such as ISO's `T` or a UTC `Z`, or another word than the locale's, makes
 * the text no reading of the field's format.
 *
 * @param format - The field's format.
 * @param text - The text, such as `10/05/2026, 02:30 PM GMT+2`.
 * @returns The units and the zone check, or `undefined` when the text does not read.
 */
export function readFieldText(format: FieldFormat, text: string): FieldText | undefined {
  const parts = fieldParts(format);
  const entries: FieldTextEntry[] = [];
  let rest = text;
  let zoneName = "";
  for (const [index, part] of parts.entries()) {
    const read = readPart(part, rest.replace(SEPARATORS, ""), parts.slice(index + 1), format.locale);
    if (read === undefined) {
      return undefined;
    }
    rest = read.rest;
    if (read.entry !== undefined) {
      entries.push(read.entry);
    }
    zoneName = read.zoneName ?? zoneName;
  }
  if (rest.replace(SEPARATORS, "") !== "") {
    return undefined;
  }
  // The name as the field writes it: canonical spaces, and none of the separators or the time's
  // closing isolate around it.
  const written = canonicalSpaces(zoneName).replace(ZONE_NAME_EDGES, "");
  return {
    entries,
    namesZoneAt:
      format.timeZone === undefined || written === ""
        ? () => true
        : (instant) => canonicalSpaces(zoneNameAt(format, instant)) === written,
  };
}
