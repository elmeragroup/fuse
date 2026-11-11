import fc from "fast-check";
import maxMetadata from "libphonenumber-js/metadata.max.json";
import { describe, expect, it } from "vitest";

import * as BaseEditor from "../../../test/phone-base/phone-editor";
import { initialTraceProps, traceAnswer, traceStep } from "../../../test/phone-country-trace-model";
import type {
  CountryTraceProps,
  MetadataKind,
  TraceAnswer,
  TraceStep,
} from "../../../test/phone-country-trace-model";
import { parseCounter, phoneEditorFixtures } from "../../../test/phone-editor-fixtures";
import {
  CALLING_CODES,
  TRACE_CODES,
  decodeNumber,
  namedCountry,
  projectDisplay,
  resolveCode,
  significantDigits,
  writesTrunkPrefix,
} from "../../../test/phone-number-oracle";
import type { TraceCode } from "../../../test/phone-number-oracle";
import { pasteText, traceCatalog, traceCode, traceFormat } from "../../../test/phone-trace-arbitraries";
import type { PasteForm, TraceUserAction } from "../../../test/phone-trace-arbitraries";
import { createCountryAnnouncer } from "./phone-country-notices";
import * as PhoneEditor from "./phone-editor";
import type { PhoneEditorProps } from "./phone-editor";
import { defaultMetadata } from "./phone-engine";

const { fill } = phoneEditorFixtures(PhoneEditor);
const { fill: fillBase } = phoneEditorFixtures(BaseEditor);
const parses = parseCounter();

/**
 * Unit under test: `PhoneEditor` and `createCountryAnnouncer` under a controlled `countryCode`, as
 * the hook drives them. Oracle: contracts (i)–(xi) below, read through the independent number
 * decoder in `test/phone-number-oracle.ts`, and for (vii) the parse cost of the #586 editor frozen
 * in `test/phone-base`.
 *
 * Contract checks over generated traces. Nothing here restates how the editor reaches a state:
 * each check is a property of what a parent can observe after every step (the shown country,
 * digits and output, and the calls it received), written from the decided semantics in issue
 * #246 and the `countryCode` JSDoc. A small decoder of the generated numbers, with its own
 * calling-code table, names what each value and proposal means.
 *
 * The contracts:
 * - (i) precedence: under a controlled `countryCode`, the field shows the offered country the
 *   controlled value's own prefix names, else the country `countryCode` resolves to;
 * - (ii) a controlled field shows its value's digits;
 * - (iii) a proposal the parent leaves unanswered or rejects leaves the field as it was;
 * - (iv) `onCountryChange` is never called with a `countryCode` set in the same step;
 * - (v) the notice contract the `phone-country-notices.ts` header states, checked as properties
 *   that need none of its rules: every announced country is the field's current one, and never
 *   `countryCode`; a disagreement is announced at most once while it holds, and at least once: a
 *   disagreement that holds was announced when it began; without a controlled country only a
 *   commit that shows a new country announces, and only that country. The exact sequences are the
 *   literal traces in `phone-country-notices.test.ts`;
 * - (vi) an uncontrolled field's `onChange` reports only the output it shows, as the change
 *   that sends it leaves it, and a controlled one is never told the value it holds;
 * - (vii) the parse budget, counted over every render the hook makes until the props settle:
 *   equal props and a change to defaults only parse nothing; a step whose only change is
 *   `countryCode` (a new code, starting control or releasing it), or a catalog change alone that
 *   moves the country the controlled code resolves to, parses at most once, or twice for a value
 *   that writes a trunk prefix after its calling code when control starts, with detection on and
 *   international off; a new value alone, such as an echo of a proposal's output, parses at most
 *   twice. Any other step costs at most what the base editor
 *   (#586, frozen in `test/phone-base`) charges for it without `countryCode`, plus
 *   `CONTROLLED_ALLOWANCE` (3, until #616) once country control is in the trace (`countryCode`
 *   set before or after the step, or earlier). A trace never under control costs
 *   no more than the base, step by step. The base editor runs the same trace, every props step
 *   and user action, with country control removed;
 * - (viii) props that keep the controlled country never clear the number;
 * - (ix) a user proposal reaches `onChange` at most once per output, whatever order the parent
 *   answers in: together, country first (synchronously, inside `onCountryChange`, when the
 *   answer is immediate) or value first. A change the parent makes of its own in the same render
 *   starts the count afresh only when it steers the field anew: it changes the value, moves
 *   the country the controlled code resolves to, or sets another `countryCode`;
 * - (x) a step that changes only defaults or reset-only settings (`defaultValue`,
 *   `defaultCountryCode`, `preserveOnCountryChange`) leaves the field as it was: display,
 *   output, country, a waiting proposal, and `onChange` silent;
 * - (xi) a step that only releases `value` keeps the number the field submits and tells
 *   `onChange` nothing; its shown country follows (i);
 * - with (v), a proposal the parent answered in full, value and country held (the country also
 *   when the value names its own), no longer waits.
 */
describe("PhoneEditor controlled country contracts over generated traces", () => {
  type Code = TraceCode;
  type UserAction = TraceUserAction;
  type Props = CountryTraceProps;
  type Answer = TraceAnswer;
  type Step = TraceStep;

  /**
   * What a step under country control may cost beyond the base editor's price, where no tighter
   * class above bounds it. A compound render reads the shown number and a waiting proposal again,
   * each in its own country: a metadata replacement costs up to 3 more, a value and `countryCode`
   * together or a catalog change up to 2. Sharing those parses is #616; this tightens with it.
   */
  const CONTROLLED_ALLOWANCE = 3;

  const offered = (props: Props, code: Code) => props.countries.includes(code);
  const resolve = (props: Props, code: Code) => resolveCode(props.countries, code);

  /** The country a user action proposes, read from the field before it; null for a no-op. */
  function proposedCountryOf(props: Props, before: Code, action: UserAction): Code | null {
    switch (action.kind) {
      case "pick":
        return action.country === before || !offered(props, action.country) ? null : action.country;
      case "paste":
        // Detection moves the country only when it is on and the picker offers the number's; a
        // national paste carries no prefix to detect.
        return action.form !== "national" && props.autoDetectCountry && offered(props, action.country)
          ? action.country
          : before;
      case "edit":
        return before;
      default:
        return unhandled(action);
    }
  }

  /** A shown country as one of the generated codes; the field shows no other. */
  function asCode(code: string): Code {
    const known = TRACE_CODES.find((candidate) => candidate === code);
    if (!known) throw new Error(`the field showed ${code}, outside the generated catalog`);
    return known;
  }

  /** The catalog a metadata kind names: a copy of min is min. */
  function catalogOf(kind: MetadataKind): "min" | "max" {
    return kind === "max" ? "max" : "min";
  }

  /** The props that differ between two renders; metadata compares by the catalog it names. */
  function changedProps(left: Props, right: Props): Set<keyof Props> {
    const keys: (keyof Props)[] = [
      "value",
      "defaultValue",
      "defaultCountryCode",
      "countryCode",
      "outputFormat",
      "preserveOnCountryChange",
      "international",
      "formatOnType",
      "autoDetectCountry",
    ];
    const changed = new Set(keys.filter((key) => left[key] !== right[key]));
    if (left.countries.join() !== right.countries.join()) changed.add("countries");
    if (catalogOf(left.metadata) !== catalogOf(right.metadata)) changed.add("metadata");
    return changed;
  }

  /**
   * Whether `full`, an answer with `change` of the parent's own, steers the field anew compared
   * with `echoed`, the same answer without it: it changes the value, or moves the country the
   * controlled code resolves to, or sets another `countryCode`, which drops a waiting proposal
   * even where it resolves to the same country. A change that sets a half the answer echoed
   * replaces that half, which the parent then never answered: a code that only falls back to the
   * proposal's country is no answer to it. That half is judged against `before`, the props before
   * the render.
   */
  function steersAnew(before: Props, echoed: Props, change: Partial<Props>, full: Props): boolean {
    const control = (props: Props) =>
      props.countryCode === undefined ? null : resolve(props, props.countryCode);
    const valueFrom = "value" in change ? before : echoed;
    const codeFrom = "countryCode" in change ? before : echoed;
    return (
      full.value !== valueFrom.value ||
      control(full) !== control(codeFrom) ||
      full.countryCode !== codeFrom.countryCode
    );
  }

  /** Whether every prop in `changed` is among `allowed`. */
  function onlyAmong(changed: Set<keyof Props>, allowed: readonly (keyof Props)[]): boolean {
    return [...changed].every((key) => allowed.includes(key));
  }

  /** The editor's props for `props`, with a new metadata object for each copy. */
  function editorProps(props: Props): PhoneEditorProps {
    const { metadata, ...rest } = props;
    const document =
      metadata === "max" ? maxMetadata : metadata === "min copy" ? { ...defaultMetadata } : defaultMetadata;
    return { ...rest, metadata: document };
  }

  /**
   * The props the base editor takes for `props`: the same, with country control removed. A copy
   * of the min metadata is the same catalog to this editor, by design, and the base compared
   * catalogs by identity, so the base gets the one document, and prices the step this editor
   * takes, not a catalog replacement on every render.
   */
  function baseProps(props: Props): BaseEditor.PhoneEditorProps {
    const { countryCode: _code, ...rest } = editorProps({
      ...props,
      metadata: props.metadata === "min copy" ? "min" : props.metadata,
    });
    return rest;
  }

  function unhandled(unexpected: never): never {
    throw new Error(`unhandled ${JSON.stringify(unexpected)}`);
  }

  /**
   * The state a render commits for `props`: the hook folds props in during render and sets the
   * result, so React renders again, with the same props, until `reconcile` returns the state it
   * was given. The parse count of a step covers every pass.
   */
  function rendered<S, P>(reconcile: (state: S, props: P) => S, state: S, props: P): S {
    let current = state;
    for (let pass = 0; pass < 8; pass += 1) {
      const next = reconcile(current, props);
      if (next === current) return current;
      current = next;
    }
    throw new Error("the props never settle: the hook would render in a loop");
  }

  type Event =
    | { readonly kind: "change"; readonly value: string }
    | { readonly kind: "country"; readonly code: string };

  /**
   * Runs a trace through the editor, as the hook does, checking every contract after each step.
   * Returns the parses each step's renders took, so a named case can pin its budget.
   */
  function run(initial: Props, steps: readonly Step[]): number[] {
    const costs = steps.map(() => 0);
    let stepIndex = -1;
    let props = initial;
    let state = PhoneEditor.create(editorProps(initial));
    // The base editor, run through the same trace without country control, prices each step.
    let base = BaseEditor.create(baseProps(initial));
    // Whether country control has been in the trace: from then on the field's state is one
    // control shaped, which the base editor's need not match.
    let controlSeen = initial.countryCode !== undefined;
    const announcer = createCountryAnnouncer(PhoneEditor.observeCountry(state));
    // Steered notices reach `onChange` once per notice, as in the hook.
    const delivered = new WeakSet<object>();
    let proposalChanges: string[] = [];
    // Whether the latest user proposal and the parent's answers to it are all that happened
    // since: a props change of the parent's own ends that, and (ix) waits for the next proposal.
    let answering = false;
    const tell = (value: string, events: Event[]) => {
      // As the hook: no output the parent holds by the time it is delivered.
      if (props.value !== undefined && value === props.value) return;
      events.push({ kind: "change", value });
      if (answering) proposalChanges.push(value);
    };
    const checkOnce = (label: string) => {
      expect(
        proposalChanges,
        `(ix) a user proposal reaches onChange at most once per output, ${label}`
      ).toEqual([...new Set(proposalChanges)]);
    };
    // The contract's own bookkeeping, from what the parent observes: the disagreements it heard
    // that still hold, as `countryCode>country`, and the country the last commit showed.
    let heardDisagreements = new Set<string>();
    let lastShown: string = PhoneEditor.view(state).country.code;
    /**
     * What the parent heard of the latest proposal, and the proposal's own country, read from the
     * action by the decoder.
     */
    let heard: {
      readonly value: string | null;
      readonly country: Code | null;
      readonly proposed: Code;
    } | null = null;

    /**
     * (v), stated without the notices' own rule. Under a controlled country every announced
     * country is `current`, the field's country at that moment, and so never `countryCode` while
     * they agree; a disagreement is announced at most once while it holds, and one that holds was
     * announced when it began, so notices that never announce, or never end a disagreement and so
     * never announce it again, go red. Without one, only a commit that shows another country than
     * the last commit announces, and only that country.
     * `current` is the decoder's proposed country at a publish, and the editor's observation, a
     * proposal waiting for the parent or else the shown country, at a commit.
     */
    const checkNotices = (moment: "publish" | "commit", events: Event[], current: string, label: string) => {
      const announced = events.filter((event) => event.kind === "country").map((event) => event.code);
      const { countryCode } = props;
      const shownCode = PhoneEditor.view(state).country.code;
      if (countryCode === undefined) {
        heardDisagreements = new Set();
        const allowed: string[] = moment === "commit" && shownCode !== lastShown ? [shownCode] : [];
        expect(
          announced.filter((code) => !allowed.includes(code)),
          `(v) without a controlled country only a commit that shows a new country announces it, ${label}`
        ).toEqual([]);
      } else {
        if (moment === "publish") {
          // At a publish `current` is the decoder's, not the editor's: a proposal that starts a
          // disagreement the parent has not heard announces exactly its country.
          const fresh = current !== countryCode && !heardDisagreements.has(`${countryCode}>${current}`);
          expect(announced, `(v) a proposal announces the disagreement it starts, ${label}`).toEqual(
            fresh ? [current] : []
          );
        }
        for (const code of announced) {
          expect(code, `(v) an announced country is the current one, ${label}`).toBe(current);
          expect(code, `(v) the controlled code is never announced, ${label}`).not.toBe(countryCode);
          const disagreement = `${countryCode}>${code}`;
          expect(
            heardDisagreements.has(disagreement),
            `(v) a disagreement is announced at most once while it holds, ${label}`
          ).toBe(false);
          heardDisagreements.add(disagreement);
        }
        const holding = `${countryCode}>${current}`;
        heardDisagreements = new Set([...heardDisagreements].filter((heard) => heard === holding));
        if (current !== countryCode) {
          expect(
            heardDisagreements.has(holding),
            `(v) a disagreement that holds was announced when it began, ${label}`
          ).toBe(true);
        }
      }
      if (moment === "commit") lastShown = shownCode;
    };

    /**
     * `shown` is the output the field showed when the notices were made: a proposal's notice is
     * judged against the field as the proposal left it, before any synchronous answer, since a
     * format change the parent makes of its own is silent by design.
     */
    const checkChanges = (events: Event[], label: string, shown = PhoneEditor.view(state).outputValue) => {
      for (const event of events) {
        if (event.kind !== "change") continue;
        if (props.value === undefined) {
          expect(event.value, `(vi) an uncontrolled field reports what it shows, ${label}`).toBe(shown);
        } else {
          expect(event.value, `(vi) a controlled field is not told its value, ${label}`).not.toBe(
            props.value
          );
        }
      }
    };

    /** Applies new props as a render does, then the commit's notices. */
    const commit = (next: Props, label: string, setCode: boolean, kind: "props" | "answer" = "answer") => {
      const previous = props;
      const viewBefore = PhoneEditor.view(state);
      const proposedBefore = PhoneEditor.observeCountry(state).proposed?.code ?? null;
      const baseBefore = parses.count;
      base = rendered(BaseEditor.reconcile, base, baseProps(next));
      const baseCost = parses.count - baseBefore;
      const before = parses.count;
      state = rendered(PhoneEditor.reconcile, state, editorProps(next));
      const cost = parses.count - before;
      if (stepIndex >= 0) costs[stepIndex] = (costs[stepIndex] ?? 0) + cost;
      props = next;
      const changed = changedProps(previous, next);
      if (changed.size === 0) {
        expect(cost, `(vii) equal props parse nothing, ${label}`).toBe(0);
      } else {
        controlSeen ||= next.countryCode !== undefined;
        // A catalog change alone that moves the country the controlled code resolves to is a pick
        // of that country, which reads the number once.
        const catalogMovesControl =
          onlyAmong(changed, ["countries"]) &&
          next.countryCode !== undefined &&
          resolve(previous, next.countryCode) !== resolve(next, next.countryCode);
        if (onlyAmong(changed, ["countryCode"]) || catalogMovesControl) {
          // When control starts, with detection on and international off, a value that writes a
          // trunk prefix after its calling code is read twice in the new country: as written, and
          // as the national number libphonenumber strips it to.
          const startsControl = previous.countryCode === undefined && next.countryCode !== undefined;
          const limit =
            startsControl &&
            next.autoDetectCountry &&
            !next.international &&
            next.value !== undefined &&
            writesTrunkPrefix(next.value)
              ? 2
              : 1;
          expect(
            cost,
            `(vii) a countryCode change, or a catalog move of it, parses at most ${limit}, ${label}`
          ).toBeLessThanOrEqual(limit);
        } else if (onlyAmong(changed, ["defaultValue", "defaultCountryCode", "preserveOnCountryChange"])) {
          // Defaults and reset-only settings shape later resets and picks, not what shows now.
          expect(cost, `(vii) a change to defaults only parses nothing, ${label}`).toBe(0);
        } else if (onlyAmong(changed, ["value"])) {
          expect(cost, `(vii) a new value alone parses at most twice, ${label}`).toBeLessThanOrEqual(2);
        }
        if (!controlSeen || !onlyAmong(changed, ["value"])) {
          const allowance = controlSeen ? CONTROLLED_ALLOWANCE : 0;
          expect(
            cost,
            `(vii) a step costs at most the base editor's price without countryCode (${baseCost}) plus ${allowance}, ${label}`
          ).toBeLessThanOrEqual(baseCost + allowance);
        }
      }
      const events: Event[] = [];
      const steered = PhoneEditor.steeredValue(state);
      if (steered !== null && !delivered.has(steered)) {
        delivered.add(steered);
        tell(steered.value, events);
      }
      const committed = announcer.commit(PhoneEditor.observeCountry(state));
      if (committed) events.push({ kind: "country", code: committed.code });
      checkChanges(events, label);
      const stepChanged = changedProps(previous, next);
      const viewAfter = PhoneEditor.view(state);
      if (
        kind === "props" &&
        stepChanged.size > 0 &&
        onlyAmong(stepChanged, ["defaultValue", "defaultCountryCode", "preserveOnCountryChange"])
      ) {
        expect(
          {
            display: viewAfter.displayValue,
            output: viewAfter.outputValue,
            country: viewAfter.country.code,
            waiting: PhoneEditor.observeCountry(state).proposed?.code ?? null,
            changes: events.filter((event) => event.kind === "change"),
          },
          `(x) a change to defaults only leaves the field and a waiting proposal as they were, ${label}`
        ).toEqual({
          display: viewBefore.displayValue,
          output: viewBefore.outputValue,
          country: viewBefore.country.code,
          waiting: proposedBefore,
          changes: [],
        });
      }
      if (
        kind === "props" &&
        stepChanged.size === 1 &&
        stepChanged.has("value") &&
        previous.value !== undefined &&
        next.value === undefined
      ) {
        expect(
          {
            number: decodeNumber(viewAfter.outputValue).nsn.replace(/^0/, ""),
            changes: events.filter((event) => event.kind === "change"),
          },
          `(xi) releasing the value keeps the number and tells onChange nothing, ${label}`
        ).toEqual({ number: decodeNumber(viewBefore.outputValue).nsn.replace(/^0/, ""), changes: [] });
      }
      const control = (props: Props) =>
        props.countryCode === undefined ? null : resolve(props, props.countryCode);
      if (
        kind === "props" &&
        previous.value === next.value &&
        control(previous) !== null &&
        control(previous) === control(next)
      ) {
        expect(
          events.filter((event) => event.kind === "change"),
          `(viii) props that keep the controlled country never clear the number, ${label}`
        ).toEqual([]);
      }
      if (setCode && next.countryCode !== undefined) {
        expect(
          events.filter((event) => event.kind === "country").map((event) => event.code),
          `(iv) no notice of the code just set, ${label}`
        ).not.toContain(next.countryCode);
      }
      // The field's current country, as the editor reports it to the hook: the country of a
      // proposal that waits for the parent, else the shown one. Whether a proposal still waits
      // is the editor's acceptance rule, which (iii), (ix) and the unit tests check; (v) checks
      // what the notices announce from it.
      const observed = PhoneEditor.observeCountry(state);
      checkNotices("commit", events, observed.proposed?.code ?? observed.shown.code, label);
      checkShown(label);
      checkOnce(label);
    };

    const checkShown = (label: string) => {
      const { country, displayValue } = PhoneEditor.view(state);
      expect(offered(props, asCode(country.code)), `the shown country is offered, ${label}`).toBe(true);
      if (props.countryCode !== undefined) {
        expect(country.code, `(i) precedence, ${label}`).toBe(
          namedCountry(props) ?? resolve(props, props.countryCode)
        );
      }
      if (props.value !== undefined) {
        // National output keeps a trunk 0 the national significant number does not have.
        expect(
          projectDisplay(displayValue),
          `(ii) a controlled field shows its value's digits, ${label}`
        ).toBe(significantDigits(decodeNumber(props.value).nsn));
      }
    };

    const answerWith = (answer: Answer, label: string) => {
      const answered = heard;
      heard = null;
      const withValue = (base: Props): Props => {
        if (answered === null || base.value === undefined || answered.value === null) return base;
        if (answer.value === "echo") return { ...base, value: answered.value };
        if (answer.value === "countryless") return { ...base, value: decodeNumber(answered.value).nsn };
        if (answer.value === "national") {
          const { cc, nsn } = decodeNumber(answered.value);
          // SE and FI write a trunk zero before national numbers; NO and SJ write none. A national
          // number that starts with a zero of its own is written as it is: another zero would make
          // it a `00` international prefix.
          const trunked = (cc === CALLING_CODES.SE || cc === CALLING_CODES.FI) && !nsn.startsWith("0");
          return { ...base, value: trunked ? `0${nsn}` : nsn };
        }
        return base;
      };
      const withCountry = (base: Props): Props =>
        answered !== null &&
        base.countryCode !== undefined &&
        answered.country !== null &&
        answer.country === "echo"
          ? { ...base, countryCode: answered.country }
          : base;
      const withChange = (base: Props): Props => (answer.change ? { ...base, ...answer.change } : base);
      let steered = false;
      const controlOf = (of: Props) => (of.countryCode === undefined ? null : resolve(of, of.countryCode));
      /** Commits one render of the answer. */
      const answerCommit = (next: Props, stepLabel: string) => {
        // A render that moves the controlled country to another than the proposal's answers
        // nothing of it and steers anew, as an echo of the proposal's code does once the parent's
        // own catalog change leaves it falling back elsewhere.
        const moved = controlOf(next);
        if (
          answered !== null &&
          moved !== null &&
          moved !== controlOf(props) &&
          moved !== answered.proposed
        ) {
          steered = true;
          proposalChanges = [];
          answering = false;
        }
        commit(next, stepLabel, next.countryCode !== props.countryCode);
      };
      /**
       * Whether the parent's own change steers the field anew, judged at the render that carries
       * it, against the props just before: it changes the value, or moves the resolved controlled
       * country. A formatting, flag or catalog change that keeps the controlled country where it
       * was is no such change. A steering change sends `onChange` what is not the proposal's, so
       * (ix) starts afresh, and the proposal's lifetime is the parent's to end.
       */
      const withOwnChange = (echoed: Props): Props => {
        const full = withChange(echoed);
        if (answer.change !== null && steersAnew(props, echoed, answer.change, full)) {
          steered = true;
          proposalChanges = [];
          answering = false;
        }
        return full;
      };
      /**
       * A proposal the parent answered in full, its value held (echoed, or held already) and its
       * country held (echoed, never moved, or blocked by the country the value names), no longer
       * waits: the field reports no proposal in another country than the one it shows.
       */
      const checkAnswered = () => {
        if (answered === null || steered) return;
        const valueHeld =
          props.value === undefined || answered.value === null || props.value === answered.value;
        const countryHeld =
          props.countryCode === undefined ||
          resolve(props, props.countryCode) === answered.proposed ||
          namedCountry(props) !== null;
        if (!valueHeld || !countryHeld) return;
        const { proposed, shown } = PhoneEditor.observeCountry(state);
        expect(
          proposed === null || proposed.code === shown.code ? null : proposed.code,
          `(v) a proposal answered in full no longer waits, ${label}`
        ).toBeNull();
      };
      if (answer.order === "together") {
        answerCommit(withOwnChange(withCountry(withValue(props))), label);
        checkAnswered();
        return;
      }
      const [first, second] =
        answer.order === "country first" ? [withCountry, withValue] : [withValue, withCountry];
      const middle = answer.changeWith === "first" ? withOwnChange(first(props)) : first(props);
      answerCommit(middle, `${label} (${answer.order}, 1/2)`);
      const last = answer.changeWith === "first" ? second(props) : withOwnChange(second(props));
      answerCommit(last, `${label} (${answer.order}, 2/2)`);
      checkAnswered();
    };

    commit(props, "mount", false);
    for (const [index, step] of steps.entries()) {
      stepIndex = index;
      const label = `step ${index + 1}: ${JSON.stringify(step)}`;
      if (step.kind === "props") {
        const { release, releaseValue, keepingCode, ...change } = step.change;
        const countries =
          keepingCode === undefined
            ? undefined
            : TRACE_CODES.filter(
                (candidate) => keepingCode.includes(candidate) || candidate === props.countryCode
              );
        const changed: Props = { ...props, ...change };
        const merged: Props = countries?.length ? { ...changed, countries } : changed;
        const withoutCountry: Props = release
          ? (({ countryCode: _released, ...rest }) => rest)(merged)
          : merged;
        const next: Props = releaseValue
          ? (({ value: _released, ...rest }) => rest)(withoutCountry)
          : withoutCountry;
        // A props change of the parent's own is no answer to a proposal, and a later answer step
        // answers none.
        proposalChanges = [];
        answering = false;
        heard = null;
        commit(next, label, next.countryCode !== props.countryCode, "props");
        continue;
      }
      if (step.kind === "answer") {
        answerWith(step.answer, label);
        continue;
      }
      const viewBefore = PhoneEditor.view(state);
      base =
        step.action.kind === "pick"
          ? BaseEditor.selectCountry(base, step.action.country)
          : step.action.kind === "paste"
            ? BaseEditor.paste(base, pasteText(step.action.country, step.action.form))
            : fillBase(base, step.action.digits);
      const country = proposedCountryOf(props, asCode(viewBefore.country.code), step.action);
      const proposed =
        step.action.kind === "pick"
          ? PhoneEditor.selectCountry(state, step.action.country)
          : step.action.kind === "paste"
            ? PhoneEditor.paste(state, pasteText(step.action.country, step.action.form))
            : fill(state, step.action.digits);
      if (country === null) {
        expect(proposed, `a pick of the shown or an unoffered country changes nothing, ${label}`).toBe(state);
        continue;
      }
      state = proposed;
      proposalChanges = [];
      answering = true;
      // The hook takes the proposal into the notices before any callback, then calls
      // `onCountryChange`, then tells `onChange` the proposal's output.
      const published = announcer.publish(PhoneEditor.observeCountry(state));
      const countryEvents: Event[] = published ? [{ kind: "country", code: published.code }] : [];
      checkNotices("publish", countryEvents, country, label);
      const value = PhoneEditor.proposedValue(state);
      const proposedOutput = PhoneEditor.view(state).outputValue;
      const heardCountry = TRACE_CODES.find((code) => code === published?.code) ?? null;
      heard = { value, country: heardCountry, proposed: country };
      if (
        step.answer !== "later" &&
        step.answer.order === "country first" &&
        props.countryCode !== undefined &&
        heardCountry !== null &&
        step.answer.country === "echo"
      ) {
        // A synchronous parent commits the country inside `onCountryChange`, with any change of
        // its own it makes in the same handler.
        const accepted: Props = { ...props, countryCode: heardCountry };
        const synchronous: Props = step.answer.change
          ? { ...props, ...step.answer.change, countryCode: heardCountry }
          : accepted;
        if (steersAnew(props, accepted, step.answer.change ?? {}, synchronous)) {
          proposalChanges = [];
          answering = false;
        }
        commit(synchronous, `${label} (country, synchronously)`, true);
        heard = { value, country: null, proposed: country };
      }
      const valueEvents: Event[] = [];
      if (value !== null) tell(value, valueEvents);
      checkChanges(valueEvents, label, proposedOutput);
      checkOnce(label);
      // The proposal needs the parent when it would change a controlled value, or move the
      // country away from the one the precedence requires under a controlled code.
      const needsParent =
        (props.value !== undefined && value !== null) ||
        (props.countryCode !== undefined &&
          country !== (namedCountry(props) ?? resolve(props, props.countryCode)));
      if (step.answer === "later") {
        // The commit of the proposal, before the parent answers.
        commit(props, `${label} (unanswered)`, false);
        if (needsParent) {
          const { displayValue, outputValue, country: shownCountry } = PhoneEditor.view(state);
          expect(
            { display: displayValue, output: outputValue, country: shownCountry.code },
            `(iii) an unanswered proposal leaves the field as it was, ${label}`
          ).toEqual({
            display: viewBefore.displayValue,
            output: viewBefore.outputValue,
            country: viewBefore.country.code,
          });
        }
        continue;
      }
      const rejected =
        step.answer.change === null &&
        (props.value === undefined || step.answer.value === "reject" || value === null) &&
        (heardCountry === null || step.answer.country === "reject");
      answerWith(step.answer, label);
      if (rejected && needsParent) {
        const { displayValue, outputValue, country: shownCountry } = PhoneEditor.view(state);
        expect(
          { display: displayValue, output: outputValue, country: shownCountry.code },
          `(iii) a rejected proposal leaves the field as it was, ${label}`
        ).toEqual({
          display: viewBefore.displayValue,
          output: viewBefore.outputValue,
          country: viewBefore.country.code,
        });
      }
    }
    return costs;
  }

  /** A trace's starting props, with the settings a generated trace varies most rarely held plain. */
  const plain = {
    countries: ["FI", "NO", "SE", "SJ"],
    outputFormat: "e164",
    preserveOnCountryChange: false,
    international: false,
    formatOnType: false,
    autoDetectCountry: false,
    metadata: "min",
  } as const satisfies Props;
  /** An answer that echoes both halves in one order, with `change` of the parent's own. */
  const echoing = (order: Answer["order"], change: Partial<Props> | null = null): Answer => ({
    value: "echo",
    changeWith: "first",
    country: "echo",
    order,
    change,
  });

  // Counterexamples generated traces once shrank to, kept by what they pin, each with the parses
  // its steps' renders take, with no slack: one parse more or fewer turns the case red, so the
  // change that lowers them (#616) updates these rows with CONTROLLED_ALLOWANCE.
  it.each<[string, Props, readonly Step[], readonly number[]]>([
    [
      "a waiting national draft keeps its country when the metadata is replaced and detection turns on",
      {
        ...plain,
        value: "",
        countryCode: "SJ",
        countries: ["NO", "SJ"],
        outputFormat: "raw",
        metadata: "max",
      },
      [
        {
          kind: "user",
          action: { kind: "edit", digits: "701234567" },
          answer: echoing("country first", { autoDetectCountry: true, metadata: "min" }),
        },
      ],
      [3],
    ],
    [
      "a waiting paste keeps its country when the catalog widens and the metadata is replaced",
      {
        ...plain,
        value: "",
        countryCode: "SJ",
        countries: ["SJ"],
        outputFormat: "national",
        autoDetectCountry: true,
      },
      [
        {
          kind: "user",
          action: { kind: "paste", country: "FI", form: "plain" },
          answer: echoing("country first", { countries: ["FI", "SJ"], metadata: "max" }),
        },
      ],
      [2],
    ],
    [
      "a waiting edit keeps its country when detection turns on with max metadata",
      { ...plain, value: "", countryCode: "FI", countries: ["NO", "SJ"], outputFormat: "raw" },
      [
        {
          kind: "user",
          action: { kind: "edit", digits: "79123456" },
          answer: echoing("country first", { autoDetectCountry: true, metadata: "max" }),
        },
      ],
      [3],
    ],
    [
      "an echo after a country answer that clears the value and turns detection on costs two parses",
      { ...plain, countries: ["SE"] },
      [
        { kind: "props", change: { outputFormat: "raw" } },
        {
          kind: "user",
          action: { kind: "paste", country: "SE", form: "trunk" },
          answer: echoing("country first", { value: "", autoDetectCountry: true }),
        },
      ],
      [0, 2],
    ],
    [
      "a pasted trunk zero answered with country control and a metadata replacement in one render",
      { ...plain, value: "", countries: ["FI"], metadata: "max" },
      [
        {
          kind: "user",
          action: { kind: "paste", country: "FI", form: "trunk" },
          answer: echoing("together", {
            value: "",
            countryCode: "FI",
            autoDetectCountry: true,
            metadata: "min",
          }),
        },
        { kind: "props", change: { autoDetectCountry: true } },
        { kind: "props", change: { countryCode: "FI" } },
      ],
      [2, 0, 0],
    ],
    [
      "a catalog change that releases control and turns detection on over a repeated trunk prefix",
      {
        ...plain,
        value: "+4600701234567",
        defaultCountryCode: "FI",
        countryCode: "NO",
        countries: ["FI", "NO", "SJ"],
        outputFormat: "raw",
      },
      [{ kind: "props", change: { countries: ["FI", "SE", "SJ"], autoDetectCountry: true, release: true } }],
      [3],
    ],
    [
      "a pick answered with value and country together over a repeated trunk prefix",
      {
        ...plain,
        value: "+4600701234567",
        countries: ["FI", "SE", "SJ"],
        preserveOnCountryChange: true,
        international: true,
        autoDetectCountry: true,
      },
      [
        { kind: "answer", answer: { ...echoing("together"), change: { international: false } } },
        { kind: "props", change: { countryCode: "SJ" } },
        { kind: "user", action: { kind: "pick", country: "FI" }, answer: echoing("together") },
      ],
      [0, 0, 2],
    ],
    [
      "a countryCode change alone over a value that writes its trunk prefix",
      {
        ...plain,
        value: "+4600701234567",
        countries: ["NO", "SE", "SJ"],
        preserveOnCountryChange: true,
        international: true,
        autoDetectCountry: true,
      },
      [
        {
          kind: "user",
          action: { kind: "pick", country: "NO" },
          answer: echoing("value first", { international: false }),
        },
        { kind: "props", change: { countryCode: "FI" } },
      ],
      [0, 2],
    ],
    [
      "a pick under a repeated trunk prefix accepted with detection on and max metadata",
      { ...plain, value: "+4600", countryCode: "FI", preserveOnCountryChange: true },
      [
        {
          kind: "user",
          action: { kind: "pick", country: "NO" },
          answer: echoing("together", { autoDetectCountry: true, metadata: "max" }),
        },
      ],
      [4],
    ],
  ])("holds every contract and its parse budget when %s", (_name, initial, steps, costs) => {
    expect(run(initial, steps), "the parses each step's renders take").toEqual(costs);
  });

  it("holds every contract after every step of generated traces", () => {
    fc.assert(
      fc.property(initialTraceProps, fc.array(traceStep, { maxLength: 12 }), (initial, steps) => {
        run(initial, steps);
      }),
      { seed: 15, numRuns: 1000 }
    );
  });

  /**
   * Starting country control over a number the field holds already: a paste in any form, pasted
   * with detection off and answered as the parent does, under each output format; then detection
   * turned on, `countryCode` set, and one more step of either. Long random traces reach this
   * ordering rarely; a raw echo of a bracketed trunk zero, read again once detection is on, needs
   * all of it.
   */
  it("holds every contract when country control starts over an echoed paste", () => {
    const start: fc.Arbitrary<Props> = fc.record({
      value: fc.constant(""),
      countries: traceCatalog,
      outputFormat: traceFormat,
      preserveOnCountryChange: fc.boolean(),
      international: fc.boolean(),
      formatOnType: fc.boolean(),
      autoDetectCountry: fc.constant(false),
      metadata: fc.constantFrom<MetadataKind>("min", "max"),
    });
    const paste = fc
      .tuple(traceCode, fc.constantFrom<PasteForm>("plain", "trunk", "national"))
      .map(([country, form]) => ({ kind: "paste" as const, country, form }));
    const toggle = fc
      .boolean()
      .map((autoDetectCountry) => ({ kind: "props" as const, change: { autoDetectCountry } }));
    const control = traceCode.map((countryCode) => ({ kind: "props" as const, change: { countryCode } }));
    const then = fc
      .tuple(control, fc.option(fc.oneof(toggle, control), { nil: undefined }))
      .map(([set, more]) => [
        { kind: "props" as const, change: { autoDetectCountry: true } },
        set,
        ...(more === undefined ? [] : [more]),
      ]);
    fc.assert(
      fc.property(start, paste, traceAnswer, then, (initial, action, reply, after) => {
        run(initial, [{ kind: "user", action, answer: reply }, ...after]);
      }),
      { seed: 2, numRuns: 1000 }
    );
  });
});
