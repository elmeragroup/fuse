import type { PhoneCountryCode, PhoneNumberCountry } from "./phone-engine";
import {
  carry,
  catalogReplaced,
  hasOwnPrefix,
  offeredCountry,
  readAsNumber,
  readInternationalIn,
} from "./phone-snapshot";
import type { Configuration, Snapshot } from "./phone-snapshot";

/**
 * The fate of a proposal waiting for the parent under new props: whether it waits on, carried
 * into the new configuration, or ends. The editor decides acceptance and the shown country; this
 * module decides what the props say to a proposal they do not show, and carries a proposal they
 * show into their configuration.
 */

/** The props a waiting proposal is judged against. */
export type ProposalProps = {
  /** The controlled value, or `undefined` for an uncontrolled number. */
  readonly value: string | undefined;
  /** The controlled country code, or `undefined`. */
  readonly countryCode: PhoneCountryCode | undefined;
  /** The configuration numbers are read in. */
  readonly configuration: Configuration;
};

/**
 * A value that holds a waiting proposal's number without a parse, with a `kind` that sets what an
 * answer with that value shows. Formatting changes that carry the proposal into a new output keep
 * this value, so an answer in the form the parent heard still holds the number.
 */
export type NumberAnswer =
  /**
   * The output the parent heard for the proposal. Since the parent heard it, only changes that keep
   * the proposal's digits and number, such as formatting changes, have carried the proposal.
   * Matching this value passes the number check for showing the proposal, as matching the
   * proposal's current output does. The shown country must also be the proposal's country.
   */
  | { readonly kind: "heard"; readonly value: string }
  /**
   * A value that holds only the number. It is a countryless form of the parent's own, or an output
   * the parent heard before a catalog replacement read the proposal again into other digits or
   * another number. An answer with this value shows what the precedence gives.
   */
  | { readonly kind: "number"; readonly value: string };

/** The props a proposal was made under, with the proposal and the value that holds its number. */
export type ProposalRecord = ProposalProps & {
  /** The proposal waiting for the parent, or `null`. */
  readonly proposal: Snapshot | null;
  /** The value that holds the waiting proposal's number without a parse, or `null`. */
  readonly numberAnswer: NumberAnswer | null;
};

/** New props, with the countries the editor derives from them. */
export type JudgedProps = ProposalProps & {
  /** The country `countryCode` resolves to in the new catalog, or `null`. */
  readonly controlled: PhoneNumberCountry | null;
  /** The offered country the value's own prefix names, or `null`. */
  readonly named: PhoneNumberCountry | null;
};

/** What new props say to the country of a proposal they do not show. */
export type CountryAnswer =
  /** `countryCode` is as it was. */
  | "unchanged"
  /**
   * A new `countryCode` names the proposal's country itself, the value as it was: acceptance of
   * the country alone, not a pick of its own. A code that only falls back to it is no answer.
   */
  | "answered"
  /** Any other change of `countryCode`. */
  | "contradicted";

/** A stored proposal the new configuration still offers, and what the new props say to its country. */
export type PendingProposal = {
  /** The stored proposal. */
  readonly proposal: Snapshot;
  /** What the new `countryCode` says to its country. */
  readonly country: CountryAnswer;
};

/** A proposal that waits on under new props, carried into their configuration. */
export type WaitingProposal = {
  /** The proposal, read in the new configuration. */
  readonly proposal: Snapshot;
  /** The value that holds its number without a parse, or `null`. */
  readonly numberAnswer: NumberAnswer | null;
};

/** What new props say to the number of a proposal they do not show. */
type NumberReply =
  /** The value is as it was, and holds the proposal's number. */
  | { readonly kind: "held" }
  /** The value is as it was, and holds another. */
  | { readonly kind: "unchanged" }
  /**
   * A new `value` that answers the number alone, in a countryless form the parent stores, such as
   * national digits. `read` is that value read in the proposal's country under the new
   * configuration, and it matches the proposal's number. `read` is `null` when `value` matches the
   * proposal's output or `numberAnswer.value`, so no parse is needed.
   */
  | { readonly kind: "answered"; readonly value: string; readonly read: Snapshot | null }
  /** Any other value. */
  | { readonly kind: "contradicted" };

/**
 * Whether `value` holds a waiting proposal's number without a parse. It does when it is the
 * proposal's output or the value of `numberAnswer`, of either kind.
 */
function holdsNumber(
  value: string | undefined,
  proposal: Snapshot,
  numberAnswer: NumberAnswer | null
): boolean {
  return value !== undefined && (value === proposal.values.outputValue || value === numberAnswer?.value);
}

function countryAnswer(stored: ProposalProps, next: ProposalProps, proposal: Snapshot): CountryAnswer {
  if (next.countryCode === stored.countryCode) return "unchanged";
  return next.value === stored.value && next.countryCode === proposal.country.code
    ? "answered"
    : "contradicted";
}

/**
 * The stored proposal, while the new configuration still offers its country, with what the new
 * `countryCode` says to it; else `null`. An answer to either half keeps a proposal waiting across
 * formatting, flag, detection, metadata and catalog changes in the same render only while the
 * catalog offers its country.
 *
 * @param stored - The props the proposal was made under, with the proposal.
 * @param next - The new props.
 * @returns The pending proposal, or `null` when there is none or the catalog no longer offers it.
 */
export function pendingProposal(stored: ProposalRecord, next: ProposalProps): PendingProposal | null {
  const { proposal } = stored;
  return proposal && offeredCountry(next.configuration, proposal.country.code)
    ? { proposal, country: countryAnswer(stored, next, proposal) }
    : null;
}

/**
 * The number half of an answer. A new value with its own prefix answers for itself: it names its
 * country or is read in `countryCode`, and the proposal ends. A countryless one answers the number
 * only beside a `countryCode` as it was, which still differs from the proposal's country.
 */
function answerToNumber(
  stored: ProposalRecord,
  next: JudgedProps,
  { proposal, country }: PendingProposal
): NumberReply {
  const { value, configuration } = next;
  const holds = holdsNumber(value, proposal, stored.numberAnswer);
  if (value === stored.value) return holds ? { kind: "held" } : { kind: "unchanged" };
  if (
    value === undefined ||
    hasOwnPrefix(value) ||
    country !== "unchanged" ||
    next.countryCode === undefined ||
    proposal.country.code === next.controlled?.code
  ) {
    return { kind: "contradicted" };
  }
  if (holds) return { kind: "answered", value, read: null };
  const read = readAsNumber(value, proposal.country, proposal, configuration);
  return read ? { kind: "answered", value, read } : { kind: "contradicted" };
}

/**
 * Whether a proposal waits on, from what new props say to its two halves: exactly one half
 * answered, or neither touched while the configuration stays or a controlled country carries it.
 */
function waitsOn(
  stored: ProposalProps,
  next: ProposalProps,
  country: CountryAnswer,
  number: NumberReply
): boolean {
  switch (country) {
    case "answered":
      return number.kind === "unchanged";
    case "unchanged":
      return (
        number.kind === "answered" ||
        (number.kind !== "contradicted" &&
          (next.configuration === stored.configuration || next.countryCode !== undefined))
      );
    case "contradicted":
      return false;
  }
}

/**
 * A waiting proposal carried into a new configuration, in its own country. A replaced catalog
 * reads the proposal again with detection, which could move it to a country the user never
 * chose and the parent never heard; read there, it is read again in its own country by its
 * international form, as the editor realigns an accepted number. Direct adoption instead carries
 * the proposal through {@link carryAdopted}, and the editor realigns the result to its country
 * precedence. These paths can normalize a raw value differently, as #712 tracks.
 */
function carryProposal(
  from: Configuration,
  to: Configuration,
  proposal: Snapshot,
  value: string | undefined
): Snapshot {
  const carried = carry(from, to, proposal, value);
  return carried.country.code === proposal.country.code
    ? carried
    : readInternationalIn(proposal, proposal.country, to);
}

/** Whether `carried`, a proposal carried into new props, keeps the proposal's digits and number. */
function keepsNumber(proposal: Snapshot, carried: Snapshot): boolean {
  return carried.digits === proposal.digits && carried.values.number === proposal.values.number;
}

/**
 * A proposal the new props show, carried into their configuration to become the accepted number.
 * A catalog replacement may read the proposal again. This function first carries the proposal
 * without a controlled value. It returns that snapshot when `value` is `undefined`. For a
 * controlled value, it returns that snapshot when the digits and number stay the same and either
 * the output format changes or the output stays the same. Otherwise it calls {@link carry} with
 * `value`. The returned snapshot uses the new configuration's output format. `carriedAnswer` also
 * keeps an existing `"heard"` answer when a no-steer carry keeps the digits and number, so a later
 * answer can still adopt the proposal's display.
 *
 * @param from - The configuration the proposal waited in.
 * @param to - The new props' configuration.
 * @param proposal - The proposal the new props show.
 * @param value - The new props' controlled value, or `undefined`.
 * @returns The proposal read in `to`.
 */
export function carryAdopted(
  from: Configuration,
  to: Configuration,
  proposal: Snapshot,
  value: string | undefined
): Snapshot {
  const kept = carry(from, to, proposal, undefined);
  const keepsOutput =
    from.outputFormat !== to.outputFormat || kept.values.outputValue === proposal.values.outputValue;
  return value === undefined || (keepsNumber(proposal, kept) && keepsOutput)
    ? kept
    : carry(from, to, proposal, value);
}

/**
 * The value that holds the number of a proposal that waits on under new props, as
 * {@link answerAfter} gives it. A catalog replacement can read the proposal again into other digits
 * or another number. The parent never heard that proposal, so an output the parent heard before the
 * replacement holds only the number afterward.
 */
function carriedAnswer(
  stored: ProposalRecord,
  next: ProposalProps,
  proposal: Snapshot,
  carried: Snapshot,
  number: NumberReply
): NumberAnswer | null {
  const answer = answerAfter(stored.numberAnswer, number);
  return answer?.kind === "heard" &&
    !keepsNumber(proposal, carried) &&
    catalogReplaced(stored.configuration, next.configuration, proposal.country)
    ? { kind: "number", value: answer.value }
    : answer;
}

/**
 * The value that holds a proposal's number after new props reply to it. Replies other than
 * `"answered"` keep the stored answer. A parsed countryless answer has kind `"number"`. An unparsed
 * answer that repeats the stored answer's value keeps its kind, even when that value also matches
 * the proposal's output. Any other unparsed answer has kind `"heard"`.
 */
function answerAfter(stored: NumberAnswer | null, number: NumberReply): NumberAnswer | null {
  if (number.kind !== "answered") return stored;
  const { value, read } = number;
  if (read !== null) return { kind: "number", value };
  return value === stored?.value ? stored : { kind: "heard", value };
}

/**
 * The pending proposal under new props that do not adopt it, decided once, from its two halves.
 *
 * A proposal waits on while exactly one half of it is answered: the parent sets its country and
 * keeps a value that does not hold its number yet, or answers its number in a countryless form of
 * its own beside the `countryCode` it had. Answered in both halves, it ends, and the field shows
 * what the precedence gives. Props that change neither half keep it waiting: equal props, a change
 * to defaults only, and, under a controlled country, a configuration change that answers nothing,
 * such as a format, flag, detection, metadata or catalog change, which carries it into the new
 * configuration as an answer would: it is no steer of its own. Without a controlled country such a
 * change drops it, as fields always have. Any other props reject it.
 *
 * Props that show the proposal adopt it and never reach this function, with two exceptions. Props
 * that release a controlled `value` accept nothing. For props equal to the stored ones, as after an
 * uncontrolled paste, this function only decides whether the proposal can still show.
 *
 * A waiting proposal also ends when it can never show: the parent holds its number already, and
 * the value names an offered country other than the proposal's, which wins whatever `countryCode`
 * the parent sets.
 *
 * @param stored - The props the proposal was made under, with the proposal.
 * @param next - The new props, which do not adopt the proposal.
 * @param pending - The stored proposal, as {@link pendingProposal} found it under `next`.
 * @returns The proposal waiting on in the new configuration, or `null` when it ends.
 */
export function proposalFate(
  stored: ProposalRecord,
  next: JudgedProps,
  pending: PendingProposal
): WaitingProposal | null {
  const number = answerToNumber(stored, next, pending);
  if (!waitsOn(stored, next, pending.country, number)) return null;
  const carried =
    number.kind === "answered" && number.read !== null
      ? number.read
      : carryProposal(stored.configuration, next.configuration, pending.proposal, next.value);
  const answer = carriedAnswer(stored, next, pending.proposal, carried, number);
  const blocked =
    holdsNumber(next.value, carried, answer) &&
    next.named !== null &&
    next.named.code !== carried.country.code;
  return blocked ? null : { proposal: carried, numberAnswer: answer };
}
