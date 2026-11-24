import type { PhoneCountryCode, PhoneNumberCountry } from "./phone-engine";
import {
  carry,
  carryValue,
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
 * A waiting proposal as the parent's replies are judged against it, and as adoption carries it.
 *
 * Props that change the configuration alone leave the reading as it was, so an answer is judged
 * and carried alike whether such a change came before it or with it. Any other props that keep
 * the proposal waiting replace `proposal` with the proposal as they carried or read it, in their
 * configuration. `output` stays the output the parent heard, and changes only when props read the
 * proposal again: a countryless answer that the field parses, or a catalog replacement that reads
 * the proposal into other digits or another number. So an output that a carry alone gave the
 * proposal never answers its number.
 */
export type ProposalReading = {
  /** The proposal that the next reply, or an adoption, carries from. */
  readonly proposal: Snapshot;
  /** The configuration `proposal` was read in. */
  readonly configuration: Configuration;
  /**
   * The output that holds the proposal's number: the heard one, or the latest read's. A controlled
   * value equal to it passes the number check for showing the proposal.
   */
  readonly output: string;
  /**
   * The latest value that holds the proposal's number without a parse: the output the parent
   * heard, or a countryless form of the parent's own. It can differ from `output` after such an
   * answer, or after a catalog replacement reads the proposal again into other digits or another
   * number. A value equal to it and not to `output` holds only the number, and shows what the
   * precedence gives.
   */
  readonly numberAnswer: string;
};

/** A proposal waiting for the parent. */
export type WaitingProposal = WaitingCarry & {
  /** The proposal as replies are judged against it. */
  readonly reading: ProposalReading;
};

/** A waiting proposal's reading carried into the configuration and `value` of the latest props. */
type WaitingCarry = {
  /** The proposal in its own country, which the field shows while those props show it. */
  readonly proposal: Snapshot;
  /**
   * The proposal as {@link carryAdopted} carries it, which props that keep the configuration and
   * `value` adopt without a parse. It is `proposal` itself unless that carry moved the proposal to
   * another country.
   */
  readonly adoption: Snapshot;
  /**
   * The reading's proposal as {@link carry} carries it into these props' configuration without a
   * controlled value. Later props in the same configuration carry from it, so a reply that
   * changes only `value` does not read the proposal again.
   */
  readonly kept: Snapshot;
};

/** The props a proposal waits under, with the proposal. */
export type ProposalRecord = ProposalProps & {
  /** The proposal waiting for the parent, or `null`. */
  readonly waiting: WaitingProposal | null;
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
  readonly waiting: WaitingProposal;
  /** What the new `countryCode` says to its country. */
  readonly country: CountryAnswer;
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
   * configuration, and it matches the proposal's number. `read` is `null` when `value` already
   * holds the number, so no parse is needed.
   */
  | { readonly kind: "answered"; readonly value: string; readonly read: Snapshot | null }
  /** Any other value. */
  | { readonly kind: "contradicted" };

/**
 * Whether `value` holds a waiting proposal's number without a parse. It does when it is the
 * reading's `output` or its `numberAnswer`.
 */
function holdsNumber(value: string | undefined, { output, numberAnswer }: ProposalReading): boolean {
  return value !== undefined && (value === output || value === numberAnswer);
}

/** Whether the configuration offers the country of the proposal that `waiting` holds. */
function offers(configuration: Configuration, waiting: WaitingProposal): boolean {
  return offeredCountry(configuration, waiting.reading.proposal.country.code) !== undefined;
}

/**
 * Whether a proposal can never show under `next`: the value holds its number already, as `reading`
 * says, and names an offered country other than the proposal's. That country wins whatever
 * `countryCode` the parent sets.
 */
function blocks(next: JudgedProps, reading: ProposalReading): boolean {
  return (
    holdsNumber(next.value, reading) &&
    next.named !== null &&
    next.named.code !== reading.proposal.country.code
  );
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
 * @param stored - The props the proposal waits under, with the proposal.
 * @param next - The new props.
 * @returns The pending proposal, or `null` when there is none or the catalog no longer offers it.
 */
export function pendingProposal(stored: ProposalRecord, next: ProposalProps): PendingProposal | null {
  const { waiting } = stored;
  return waiting && offers(next.configuration, waiting)
    ? { waiting, country: countryAnswer(stored, next, waiting.reading.proposal) }
    : null;
}

/**
 * Whether props equal to the stored ones keep the waiting proposal: the catalog still offers its
 * country, and the value does not block it, as {@link proposalFate} decides for any other props.
 * Equal props carry nothing, so this parses nothing.
 *
 * @param record - The stored props, with the countries they name and a waiting proposal.
 * @param waiting - The waiting proposal.
 * @returns `true` when the proposal waits on.
 */
export function waitsUnchanged(record: JudgedProps, waiting: WaitingProposal): boolean {
  return offers(record.configuration, waiting) && !blocks(record, waiting.reading);
}

/**
 * The number half of an answer. A new value with its own prefix answers for itself: it names its
 * country or is read in `countryCode`, and the proposal ends. A countryless one answers the number
 * only beside a `countryCode` as it was, which still differs from the proposal's country.
 */
function answerToNumber(
  stored: ProposalRecord,
  next: JudgedProps,
  { waiting, country }: PendingProposal
): NumberReply {
  const { value, configuration } = next;
  const { proposal } = waiting.reading;
  const holds = holdsNumber(value, waiting.reading);
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
 * A waiting proposal carried into a new configuration, in its own country, with the carry
 * {@link carryAdopted} makes as its `adoption`. A replaced catalog reads the proposal again with
 * detection, which could move it to a country the user never chose and the parent never heard;
 * read there, it is read again in its own country by its international form, as the editor
 * realigns an accepted number. Direct adoption instead keeps the moved read, and the editor
 * realigns it to its country precedence. These paths can normalize a raw value differently, as
 * #712 tracks.
 */
function carryProposal(
  from: Configuration,
  to: Configuration,
  proposal: Snapshot,
  kept: Snapshot,
  value: string | undefined
): WaitingCarry {
  const adoption = carryAdopted(from, to, proposal, kept, value);
  return adoption.country.code === proposal.country.code
    ? { proposal: adoption, adoption, kept }
    : { proposal: readInternationalIn(proposal, proposal.country, to), adoption, kept };
}

/** Whether `carried`, a proposal carried into new props, keeps the proposal's digits and number. */
function keepsNumber(proposal: Snapshot, carried: Snapshot): boolean {
  return carried.digits === proposal.digits && carried.values.number === proposal.values.number;
}

/**
 * A proposal the new props show, carried into their configuration to become the accepted number.
 * A catalog replacement may read the proposal again. `kept` is the proposal carried without a
 * controlled value. This function returns it when `value` is `undefined`. For a
 * controlled value, it returns that snapshot when the digits and number stay the same and either
 * the output format changes or the output stays the same. Otherwise it carries the proposal with
 * `value`, as {@link carryValue} does from `kept`. The returned snapshot uses the new
 * configuration's output format.
 *
 * @param from - The configuration the proposal was read in.
 * @param to - The new props' configuration.
 * @param proposal - The proposal the new props show.
 * @param kept - `proposal` carried into `to` without a controlled value.
 * @param value - The new props' controlled value, or `undefined`.
 * @returns The proposal read in `to`.
 */
function carryAdopted(
  from: Configuration,
  to: Configuration,
  proposal: Snapshot,
  kept: Snapshot,
  value: string | undefined
): Snapshot {
  const keepsOutput =
    from.outputFormat !== to.outputFormat || kept.values.outputValue === proposal.values.outputValue;
  return value === undefined || (keepsNumber(proposal, kept) && keepsOutput)
    ? kept
    : carryValue(from, to, proposal, kept, value);
}

/**
 * Whether `carried`, the reading's proposal carried into new props, is a new read of it: a catalog
 * replacement read it into other digits or another number.
 */
function rereads(reading: ProposalReading, next: ProposalProps, carried: Snapshot): boolean {
  return (
    !keepsNumber(reading.proposal, carried) &&
    catalogReplaced(reading.configuration, next.configuration, reading.proposal.country)
  );
}

/** Whether new props keep the stored configuration and `value`, so a waiting proposal needs no carry. */
function carriesNothing(stored: ProposalProps, next: ProposalProps): boolean {
  return next.configuration === stored.configuration && next.value === stored.value;
}

/**
 * The reading's proposal carried into the configuration of new props without a controlled value:
 * the waiting proposal's `kept` while the configuration stays, else a new carry.
 */
function keptIn(stored: ProposalProps, next: ProposalProps, waiting: WaitingProposal): Snapshot {
  const { proposal, configuration } = waiting.reading;
  return next.configuration === stored.configuration
    ? waiting.kept
    : carry(configuration, next.configuration, proposal, undefined);
}

/**
 * The waiting proposal carried into new props: as it waits, with no parse, when they carry
 * nothing, else the reading's proposal carried from the configuration it was read in.
 */
function carryWaiting(stored: ProposalRecord, next: ProposalProps, waiting: WaitingProposal): WaitingCarry {
  const { proposal, configuration } = waiting.reading;
  return carriesNothing(stored, next)
    ? waiting
    : carryProposal(configuration, next.configuration, proposal, keptIn(stored, next, waiting), next.value);
}

/**
 * The accepted number that new props make of a waiting proposal they show: its `adoption` when
 * they carry nothing, else the reading's proposal carried as {@link carryAdopted} carries it.
 *
 * @param stored - The props the proposal waits under.
 * @param next - The new props, which show the proposal.
 * @param waiting - The waiting proposal.
 * @returns The proposal read in the new configuration.
 */
export function adoptedNumber(
  stored: ProposalProps,
  next: ProposalProps,
  waiting: WaitingProposal
): Snapshot {
  if (carriesNothing(stored, next)) return waiting.adoption;
  const { proposal, configuration } = waiting.reading;
  return carryAdopted(configuration, next.configuration, proposal, keptIn(stored, next, waiting), next.value);
}

/**
 * The proposal `reading` holds, waiting with itself as its `adoption` and `kept`, since it was read
 * in the reading's configuration.
 */
function waitingIn(reading: ProposalReading): WaitingProposal {
  return { proposal: reading.proposal, adoption: reading.proposal, kept: reading.proposal, reading };
}

/**
 * A new proposal, read in `configuration`, waiting for the parent to answer the output it hears.
 *
 * @param proposal - The proposal.
 * @param configuration - The configuration it was read in.
 * @returns The waiting proposal.
 */
export function waitingFor(proposal: Snapshot, configuration: Configuration): WaitingProposal {
  const output = proposal.values.outputValue;
  return waitingIn({ proposal, configuration, output, numberAnswer: output });
}

/**
 * A proposal that waits on under new props, its reading changed as {@link ProposalReading} says. A
 * countryless answer becomes the reading's `numberAnswer`.
 */
function waitingAfter(
  stored: ProposalRecord,
  next: ProposalProps,
  waiting: WaitingProposal,
  number: NumberReply
): WaitingProposal {
  const { reading } = waiting;
  if (number.kind === "answered" && number.read !== null) {
    const { read } = number;
    return waitingIn({
      proposal: read,
      configuration: next.configuration,
      output: read.values.outputValue,
      numberAnswer: number.value,
    });
  }
  const carried = carryWaiting(stored, next, waiting);
  if (next.value === stored.value && next.countryCode === stored.countryCode) return { ...carried, reading };
  return waitingIn({
    proposal: carried.proposal,
    configuration: next.configuration,
    output: rereads(reading, next, carried.proposal) ? carried.proposal.values.outputValue : reading.output,
    numberAnswer: number.kind === "answered" ? number.value : reading.numberAnswer,
  });
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
 * Props that show the proposal adopt it and never reach this function, except props that release a
 * controlled `value`, which accept nothing. Props equal to the stored ones go to
 * {@link waitsUnchanged} instead.
 *
 * A waiting proposal also ends when it can never show: the parent holds its number already, and
 * the value names an offered country other than the proposal's, which wins whatever `countryCode`
 * the parent sets.
 *
 * @param stored - The props the proposal waits under, with the proposal.
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
  const waiting = waitingAfter(stored, next, pending.waiting, number);
  return blocks(next, waiting.reading) ? null : waiting;
}
