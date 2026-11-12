import type { PhoneCountryCode, PhoneNumberCountry } from "./phone-engine";
import { carry, hasOwnPrefix, offeredCountry, readAsNumber, readInternationalIn } from "./phone-snapshot";
import type { Configuration, Snapshot } from "./phone-snapshot";

/**
 * The fate of a proposal waiting for the parent under new props: whether it waits on, carried
 * into the new configuration, or ends. The editor decides acceptance and the shown country; this
 * module decides only what the props say to a proposal they do not show.
 */

/** The props a waiting proposal is judged against. */
export type ProposalProps = {
  /** The controlled value, or undefined for an uncontrolled number. */
  readonly value: string | undefined;
  /** The controlled country code, or undefined. */
  readonly countryCode: PhoneCountryCode | undefined;
  /** The configuration numbers are read in. */
  readonly configuration: Configuration;
};

/** The props a proposal was made under, with the proposal and the value that holds its number. */
export type ProposalRecord = ProposalProps & {
  /** The proposal waiting for the parent, or null. */
  readonly proposal: Snapshot | null;
  /** The value that holds the waiting proposal's number without a parse, or null. */
  readonly numberAnswer: string | null;
};

/** New props, with the countries the editor derives from them without a parse. */
export type JudgedProps = ProposalProps & {
  /** The country `countryCode` resolves to in the new catalog, or null. */
  readonly controlled: PhoneNumberCountry | null;
  /** The offered country the value names, from its cached detection only, or null. */
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
  /** The value that holds its number without a parse, or null. */
  readonly numberAnswer: string | null;
};

/** What new props say to the number of a proposal they do not show. */
type NumberReply =
  /** The value is as it was, and holds the proposal's number. */
  | { readonly kind: "held" }
  /** The value is as it was, and holds another. */
  | { readonly kind: "unchanged" }
  /**
   * A new value answers the number alone, in a countryless form of the parent's own, such as the
   * national digits it stores: `read` is that value read in the proposal's country, the
   * proposal's number under the new configuration, or null for an echo of an output the parent
   * heard, which holds the number without a parse.
   */
  | { readonly kind: "answered"; readonly read: Snapshot | null }
  /** Any other value. */
  | { readonly kind: "contradicted" };

/**
 * Whether `value` holds a waiting proposal's number without a parse: it is the proposal's output,
 * or `numberAnswer`, the output the parent heard before a formatting change carried the proposal,
 * or a countryless form the parent answered with.
 */
function holdsNumber(value: string | undefined, proposal: Snapshot, numberAnswer: string | null): boolean {
  return value !== undefined && (value === proposal.values.outputValue || value === numberAnswer);
}

function countryAnswer(stored: ProposalProps, next: ProposalProps, proposal: Snapshot): CountryAnswer {
  if (next.countryCode === stored.countryCode) return "unchanged";
  return next.value === stored.value && next.countryCode === proposal.country.code
    ? "answered"
    : "contradicted";
}

/**
 * The stored proposal, while the new configuration still offers its country, with what the new
 * `countryCode` says to it; else null. An answer to either half keeps a proposal waiting across
 * formatting, flag, detection, metadata and catalog changes in the same render only while the
 * catalog offers its country.
 *
 * @param stored - The props the proposal was made under, with the proposal.
 * @param next - The new props.
 * @returns The pending proposal, or null when there is none or the catalog no longer offers it.
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
  if (holds) return { kind: "answered", read: null };
  const read = readAsNumber(value, proposal.country, proposal, configuration);
  return read ? { kind: "answered", read } : { kind: "contradicted" };
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
 * international form, as the editor realigns an accepted number.
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

/**
 * The pending proposal under new props that do not show it, decided once, from its two halves.
 *
 * A proposal waits on while exactly one half of it is answered: the parent sets its country and
 * keeps a value that does not hold its number yet, or answers its number in a countryless form of
 * its own beside the `countryCode` it had. Answered in both halves, it ends, and the field shows
 * what the precedence gives. Props that change neither half keep it waiting: equal props, a change
 * to defaults only, and, under a controlled country, a configuration change that answers nothing
 * (a format, flag, detection, metadata or catalog change), which carries it into the new
 * configuration as an answer would: it is no steer of its own. Without a controlled country such a
 * change drops it, as fields always have. Any other props reject it.
 *
 * A waiting proposal also ends when it can never show: the parent holds its number already, and
 * the value names an offered country other than the proposal's, which wins whatever `countryCode`
 * the parent sets. That is read from the value's cached detection only, so equal props parse
 * nothing; without one the proposal stays.
 *
 * @param stored - The props the proposal was made under, with the proposal.
 * @param next - The new props, which do not show the proposal.
 * @param pending - The stored proposal, as {@link pendingProposal} found it under `next`.
 * @returns The proposal waiting on in the new configuration, or null when it ends.
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
  const answer = number.kind === "answered" ? (next.value ?? null) : stored.numberAnswer;
  const blocked =
    holdsNumber(next.value, carried, answer) &&
    next.named !== null &&
    next.named.code !== carried.country.code;
  return blocked ? null : { proposal: carried, numberAnswer: answer };
}
