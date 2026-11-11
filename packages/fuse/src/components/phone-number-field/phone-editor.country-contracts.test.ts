import fc from "fast-check";
import { AsYouType } from "libphonenumber-js/core";
import maxMetadata from "libphonenumber-js/metadata.max.json";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as BaseEditor from "../../../test/phone-base/phone-editor";
import type { PhoneEditorState as BaseEditorState } from "../../../test/phone-base/phone-editor";
import { committedCountry, publishedCountry, startCountryNotices } from "./phone-country-notices";
import * as PhoneEditor from "./phone-editor";
import type { PhoneEditorProps, PhoneEditorState } from "./phone-editor";
import { defaultMetadata } from "./phone-engine";

/** Replaces the whole input, as a fill or autofill does, with the caret at its end. */
function fill(state: PhoneEditorState, value: string): PhoneEditorState {
  return PhoneEditor.edit(state, {
    value,
    selectionStart: value.length,
    selectionEnd: value.length,
    selectionDirection: "none",
    inputType: "insertText",
  });
}

/** {@link fill} on the base editor, which `(vii)` measures compound steps against. */
function fillBase(state: BaseEditorState, value: string): BaseEditorState {
  return BaseEditor.edit(state, {
    value,
    selectionStart: value.length,
    selectionEnd: value.length,
    selectionDirection: "none",
    inputType: "insertText",
  });
}

/**
 * `AsYouType#input` runs once per libphonenumber parse; patching the shared prototype counts
 * real parses without mocking the module.
 */
// SAFETY: `input` is `AsYouType`'s own prototype method, read through its descriptor so the
// reference stays unbound and `.call` below restores the instance.
const realInput = Object.getOwnPropertyDescriptor(AsYouType.prototype, "input")?.value as (
  this: AsYouType,
  text: string
) => string;
let parses = 0;
beforeEach(() => {
  parses = 0;
  AsYouType.prototype.input = function countingInput(this: AsYouType, text: string) {
    parses += 1;
    return realInput.call(this, text);
  };
});
afterEach(() => {
  AsYouType.prototype.input = realInput;
});

/**
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
 * - (v) the notice contract: a disagreement is the field's current country (a proposal that
 *   waits for the parent, else the shown one) differing from `countryCode`, identified by the
 *   pair; it is announced once as it starts, continues while the pair holds, and ends when the
 *   current country is `countryCode` again or another country, or `countryCode` changes. The
 *   current country is the one the editor reports to the hook. Without a controlled country, a
 *   commit that shows another country announces it;
 * - (vi) an uncontrolled field's `onChange` reports only the output it shows, as the change
 *   that sends it leaves it, and a controlled one is never told the value it holds;
 * - (vii) the parse budget: equal props parse nothing; a step whose only change is
 *   `countryCode` (a new code, starting control or releasing it), or a catalog change alone that
 *   moves the country the controlled code resolves to, parses at most once. Any step costs at
 *   most what the base editor (#586, frozen in `test/phone-base`) charges for it without
 *   `countryCode`, plus one for its `countryCode` part once country control is in the trace
 *   (`countryCode` set before or after the step, or earlier): a new code read once, the read of
 *   the value's own prefix that precedence (i) needs, or a state control has shaped. A trace
 *   never under control costs no more than the base, step by step. No step builds a snapshot it
 *   then discards. The base editor runs the same trace, every props step and user action, with
 *   country control removed;
 * - (viii) props that keep the controlled country never clear the number;
 * - (ix) a user proposal reaches `onChange` at most once per output, whatever order the parent
 *   answers in: together, country first (synchronously, inside `onCountryChange`, when the
 *   answer is immediate) or value first. A change the parent makes of its own in the same render
 *   starts the count afresh only when it steers the field anew: it changes the value, or moves
 *   the country the controlled code resolves to;
 * - (x) a step that changes only defaults or reset-only settings (`defaultValue`,
 *   `defaultCountryCode`, `preserveOnCountryChange`) leaves the field as it was: display,
 *   output, country, a waiting proposal, and `onChange` silent;
 * - (xi) a step that only releases `value` keeps the number the field submits and tells
 *   `onChange` nothing; its shown country follows (i);
 * - with (v), a proposal the parent answered in full, value and country held (the country also
 *   when the value names its own), no longer waits; with (vii), an answer that only echoes the
 *   proposal's output parses at most once.
 */
describe("PhoneEditor controlled country contracts over generated traces", () => {
  // SJ shares +47 with NO: a +47 number in 79 belongs to SJ, any other to NO.
  type Code = "FI" | "NO" | "SE" | "SJ";
  type Format = "e164" | "raw" | "international" | "national";
  const CALLING = { FI: "358", NO: "47", SE: "46", SJ: "47" } as const satisfies Record<Code, string>;
  const NATIONAL = {
    FI: "401234567",
    NO: "41234567",
    SE: "701234567",
    SJ: "79123456",
  } as const satisfies Record<Code, string>;
  const CODES: readonly Code[] = ["FI", "NO", "SE", "SJ"];
  // libphonenumber's catalog order, which a fallback past NO follows.
  const CATALOG_ORDER: readonly Code[] = ["FI", "NO", "SE", "SJ"];

  type Props = {
    readonly value?: string;
    readonly defaultValue?: string;
    readonly defaultCountryCode?: Code;
    readonly countryCode?: Code;
    readonly countries: readonly Code[];
    readonly outputFormat: Format;
    readonly preserveOnCountryChange: boolean;
    readonly international: boolean;
    readonly formatOnType: boolean;
    readonly autoDetectCountry: boolean;
    /** min metadata; an equivalent copy of it, made anew on every render; or max metadata. */
    readonly metadata: MetadataKind;
  };
  type MetadataKind = "min" | "min copy" | "max";
  type PasteForm = "plain" | "trunk" | "national";
  type UserAction =
    | { readonly kind: "pick"; readonly country: Code }
    | {
        readonly kind: "paste";
        readonly country: Code;
        /**
         * Written plainly with its `+`; with its trunk zero in brackets, "+46 (0)70…", where the
         * country has one; or as national digits with no prefix, "070…", which no detection reads.
         */
        readonly form: PasteForm;
      }
    | { readonly kind: "edit"; readonly digits: string };
  type Answer = {
    /**
     * The value the parent stores: the output it heard, its old value, the national digits, or
     * the national number written with a trunk zero, as "070…" or "040…".
     */
    readonly value: "echo" | "reject" | "countryless" | "national";
    /** With which render of a split answer the parent's own change arrives. */
    readonly changeWith: "first" | "last";
    readonly country: "echo" | "reject";
    /** Props the parent changes of its own in the same render as its answer, or null. */
    readonly change: Partial<Props> | null;
    /**
     * How the parent's answer arrives: in one render, or the country and the value in two. An
     * immediate `country first` answer is synchronous: the parent commits the country inside
     * `onCountryChange`, before the proposal's `onChange` runs.
     */
    readonly order: "together" | "country first" | "value first";
  };
  type Step =
    | { readonly kind: "user"; readonly action: UserAction; readonly answer: Answer | "later" }
    | { readonly kind: "answer"; readonly answer: Answer }
    | {
        readonly kind: "props";
        readonly change: Partial<Props> & {
          /** The parent gives up control of the country. */
          readonly release?: true;
          /** The parent gives up control of the value. */
          readonly releaseValue?: true;
          /** A catalog that keeps the controlled code offered, when there is one. */
          readonly keepingCode?: readonly Code[];
        };
      };
  /** A value string as calling code and national digits; `cc` is null for countryless digits. */
  type Decoded = { readonly cc: string | null; readonly nsn: string };

  const offered = (props: Props, code: Code) => props.countries.includes(code);
  /** The country a calling code and national number belong to. */
  const codeOfNumber = (cc: string, nsn: string): Code | undefined =>
    cc === "47" ? (nsn.startsWith("79") ? "SJ" : "NO") : CODES.find((code) => CALLING[code] === cc);

  function decode(value: string): Decoded {
    // A bracketed trunk zero, "(0)", is no part of the number; separators and brackets go; a
    // `00` international prefix reads as `+`.
    const written = value.replace(/\(0\)/g, "").replace(/[\s\-()]/g, "");
    const text = written.startsWith("00") ? `+${written.slice(2)}` : written;
    if (!text.startsWith("+")) return { cc: null, nsn: text };
    const cc = Object.values(CALLING).find((candidate) => text.startsWith(`+${candidate}`));
    if (!cc) throw new Error(`the generator never makes ${value}`);
    return { cc, nsn: text.slice(cc.length + 1) };
  }

  function resolve(props: Props, code: Code): Code {
    if (offered(props, code)) return code;
    if (offered(props, "NO")) return "NO";
    const first = CATALOG_ORDER.find((candidate) => offered(props, candidate));
    if (!first) throw new Error("the generator never empties the catalog");
    return first;
  }

  /** The offered country a controlled value's own prefix names. */
  function named(props: Props): Code | null {
    if (props.value === undefined || !props.autoDetectCountry) return null;
    const { cc, nsn } = decode(props.value);
    // A prefix names its country once a national digit follows it, after libphonenumber strips
    // one trunk zero: "+467" and "+4600" name SE, "+46" and "+460" nothing.
    // "+477" names nothing either: it may still become SJ's 79 as well as a number of NO's.
    const national = cc === CALLING.SE || cc === CALLING.FI ? nsn.replace(/^0/, "") : nsn;
    if (national === "" || (cc === CALLING.NO && national === "7")) return null;
    const code = cc === null ? undefined : codeOfNumber(cc, nsn);
    return code && offered(props, code) ? code : null;
  }

  /** The digits a display shows, as the national significant number. */
  function project(display: string): string {
    let digits = display.replace(/[^\d+]/g, "");
    if (digits.startsWith("+")) {
      digits = digits.slice(1);
      const cc = ["358", "47", "46"].find((candidate) => digits.startsWith(candidate));
      if (cc) digits = digits.slice(cc.length);
    }
    return significant(digits);
  }

  /**
   * Digits without the trunk zeros before them. libphonenumber strips one trunk prefix per parse,
   * and a value its own prefix names is parsed twice, as written and then as its national number
   * behind the calling code, so "+4600701234567" shows "701234567".
   */
  function significant(digits: string): string {
    return digits.replace(/^0+/, "");
  }

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
    const known = CODES.find((candidate) => candidate === code);
    if (!known) throw new Error(`the field showed ${code}, outside the generated catalog`);
    return known;
  }

  /** The catalog a metadata kind names: a copy of min is min. */
  function catalogOf(kind: MetadataKind): "min" | "max" {
    return kind === "max" ? "max" : "min";
  }

  /** The editor's props for `props`, with a new metadata object for each copy. */
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
   * controlled code resolves to. A change that sets a half the answer echoed replaces that half,
   * which the parent then never answered: a code that only falls back to the proposal's country
   * is no answer to it. That half is judged against `before`, the props before the render.
   */
  function steersAnew(before: Props, echoed: Props, change: Partial<Props>, full: Props): boolean {
    const control = (props: Props) =>
      props.countryCode === undefined ? null : resolve(props, props.countryCode);
    const valueFrom = "value" in change ? before : echoed;
    const codeFrom = "countryCode" in change ? before : echoed;
    return full.value !== valueFrom.value || control(full) !== control(codeFrom);
  }

  /** A pasted number in one of the forms {@link PasteForm} names. */
  function pasteText(country: Code, form: PasteForm): string {
    // SE and FI write a trunk zero before national numbers; NO and SJ write none.
    const trunked = country === "SE" || country === "FI";
    if (form === "national") return trunked ? `0${NATIONAL[country]}` : NATIONAL[country];
    return form === "trunk" && trunked
      ? `+${CALLING[country]} (0)${NATIONAL[country]}`
      : `+${CALLING[country]}${NATIONAL[country]}`;
  }

  /** Whether every prop in `changed` is among `allowed`. */
  function onlyAmong(changed: Set<keyof Props>, allowed: readonly (keyof Props)[]): boolean {
    return [...changed].every((key) => allowed.includes(key));
  }

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

  type Event =
    | { readonly kind: "change"; readonly value: string }
    | { readonly kind: "country"; readonly code: string };

  /** Runs a trace through the editor, as the hook does, checking every contract after each step. */
  function run(initial: Props, steps: readonly Step[]): void {
    let props = initial;
    let state = PhoneEditor.create(editorProps(initial));
    // The base editor, run through the same trace without country control, prices each step.
    let base = BaseEditor.create(baseProps(initial));
    // Whether country control has been in the trace: from then on the field's state is one
    // control shaped, which the base editor's need not match.
    let controlSeen = initial.countryCode !== undefined;
    let notices = startCountryNotices(PhoneEditor.observeCountry(state));
    // Value notices reach `onChange` through one owner, once per notice, as in the hook.
    const delivered = new WeakSet<object>();
    let proposalChanges: string[] = [];
    // Whether the latest user proposal and the parent's answers to it are all that happened
    // since: a props change of the parent's own ends that, and (ix) waits for the next proposal.
    let answering = false;
    const deliver = (notice: { readonly value: string } | null, events: Event[]) => {
      if (notice === null || delivered.has(notice)) return;
      delivered.add(notice);
      // As the hook: no notice of the value the parent holds by the time it is delivered.
      if (props.value !== undefined && notice.value === props.value) return;
      events.push({ kind: "change", value: notice.value });
      if (answering) proposalChanges.push(notice.value);
    };
    const checkOnce = (label: string) => {
      expect(
        proposalChanges,
        `(ix) a user proposal reaches onChange at most once per output, ${label}`
      ).toEqual([...new Set(proposalChanges)]);
    };
    // The contract's own bookkeeping, from what the parent observes.
    let lastCost = 0;
    let disagreement: string | null = null;
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

    const announce = (point: string, events: Event[], current: string | null, label: string) => {
      const announced = events.filter((event) => event.kind === "country").map((event) => event.code);
      let expected: string[] = [];
      if (props.countryCode === undefined) {
        disagreement = null;
        if (point === "commit") {
          const shownCode = PhoneEditor.view(state).country.code;
          if (shownCode !== lastShown) expected = [shownCode];
        }
      } else {
        const pair =
          current === null || current === props.countryCode ? null : `${props.countryCode}>${current}`;
        if (pair !== null && pair !== disagreement) expected = [current ?? ""];
        disagreement = pair;
      }
      if (point === "commit") lastShown = PhoneEditor.view(state).country.code;
      expect(announced, `(v) notices at ${point}, ${label}`).toEqual(expected);
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
      const baseBefore = parses;
      base = BaseEditor.reconcile(base, baseProps(next));
      const baseCost = parses - baseBefore;
      const before = parses;
      state = PhoneEditor.reconcile(state, editorProps(next));
      const cost = parses - before;
      lastCost = cost;
      props = next;
      const changed = changedProps(previous, next);
      const same = changed.size === 0;
      if (same) {
        expect(cost, `(vii) equal props parse nothing, ${label}`).toBe(0);
      } else {
        // Any step whose only change is `countryCode`: a new code, starting control from none,
        // or releasing it.
        const onlyCode = changed.size === 1 && changed.has("countryCode");
        if (onlyCode)
          expect(cost, `(vii) a countryCode change parses at most once, ${label}`).toBeLessThanOrEqual(1);
        // A catalog change alone that moves the country the controlled code resolves to is a pick
        // of that country, which reads the number once.
        const catalogMovesControl =
          onlyAmong(changed, ["countries"]) &&
          next.countryCode !== undefined &&
          resolve(previous, next.countryCode) !== resolve(next, next.countryCode);
        // A step, compound or not, costs what the base editor charges for it without its
        // `countryCode` part, plus one for that part once control is in the trace.
        controlSeen ||= next.countryCode !== undefined;
        expect(
          cost,
          `(vii) a step costs at most the base editor's price without countryCode (${baseCost}), plus one once control is in the trace, ${label}`
        ).toBeLessThanOrEqual(baseCost + (controlSeen ? 1 : 0));
        if (catalogMovesControl) {
          expect(
            cost,
            `(vii) a catalog change that moves the controlled country parses at most once, ${label}`
          ).toBeLessThanOrEqual(1);
        }
        // Defaults and reset-only settings shape later resets and picks, not what shows now.
        if (onlyAmong(changed, ["defaultValue", "defaultCountryCode", "preserveOnCountryChange"])) {
          expect(cost, `(vii) a change to defaults only parses nothing, ${label}`).toBe(0);
        }
      }
      const events: Event[] = [];
      const steered = PhoneEditor.steeredValue(state);
      deliver(steered, events);
      const committed = committedCountry(notices, PhoneEditor.observeCountry(state));
      notices = committed.notices;
      if (committed.country) events.push({ kind: "country", code: committed.country.code });
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
            number: decode(viewAfter.outputValue).nsn.replace(/^0/, ""),
            changes: events.filter((event) => event.kind === "change"),
          },
          `(xi) releasing the value keeps the number and tells onChange nothing, ${label}`
        ).toEqual({ number: decode(viewBefore.outputValue).nsn.replace(/^0/, ""), changes: [] });
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
      announce("commit", events, observed.proposed?.code ?? observed.shown.code, label);
      checkShown(label);
      checkOnce(label);
    };

    const checkShown = (label: string) => {
      const { country, displayValue } = PhoneEditor.view(state);
      expect(offered(props, asCode(country.code)), `the shown country is offered, ${label}`).toBe(true);
      if (props.countryCode !== undefined) {
        expect(country.code, `(i) precedence, ${label}`).toBe(
          named(props) ?? resolve(props, props.countryCode)
        );
      }
      if (props.value !== undefined) {
        // National output keeps a trunk 0 the national significant number does not have.
        expect(project(displayValue), `(ii) a controlled field shows its value's digits, ${label}`).toBe(
          significant(decode(props.value).nsn)
        );
      }
    };

    const answerWith = (answer: Answer, label: string) => {
      const answered = heard;
      heard = null;
      const withValue = (base: Props): Props => {
        if (answered === null || base.value === undefined || answered.value === null) return base;
        if (answer.value === "echo") return { ...base, value: answered.value };
        if (answer.value === "countryless") return { ...base, value: decode(answered.value).nsn };
        if (answer.value === "national") {
          const { cc, nsn } = decode(answered.value);
          // SE and FI write a trunk zero before national numbers; NO and SJ write none. A national
          // number that starts with a zero of its own is written as it is: another zero would make
          // it a `00` international prefix.
          const trunked = (cc === CALLING.SE || cc === CALLING.FI) && !nsn.startsWith("0");
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
      const sameBesidesValue = (left: Props, right: Props) => onlyAmong(changedProps(left, right), ["value"]);
      /** Commits an answer, holding an echo of the proposal's own output to the echo budget. */
      let steered = false;
      const controlOf = (of: Props) => (of.countryCode === undefined ? null : resolve(of, of.countryCode));
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
        const echoOnly =
          answered !== null &&
          answered.value !== null &&
          next.value === answered.value &&
          next.value !== props.value &&
          sameBesidesValue(props, next);
        commit(next, stepLabel, next.countryCode !== props.countryCode);
        if (echoOnly) {
          expect(
            lastCost,
            `(vii) an echo of the proposal's output parses at most once, ${stepLabel}`
          ).toBeLessThanOrEqual(1);
        }
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
          named(props) !== null;
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
      const label = `step ${index + 1}: ${JSON.stringify(step)}`;
      if (step.kind === "props") {
        const { release, releaseValue, keepingCode, ...change } = step.change;
        const countries =
          keepingCode === undefined
            ? undefined
            : CATALOG_ORDER.filter(
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
        // A props change of the parent's own is no answer to a proposal.
        proposalChanges = [];
        answering = false;
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
      // `onCountryChange`, then delivers the proposal's value notice to `onChange`.
      const published = publishedCountry(notices, PhoneEditor.observeCountry(state));
      notices = published.notices;
      const countryEvents: Event[] = published.country
        ? [{ kind: "country", code: published.country.code }]
        : [];
      announce("publish", countryEvents, country, label);
      const notice = PhoneEditor.proposalNotice(state);
      const proposedOutput = PhoneEditor.view(state).outputValue;
      const value = notice?.value ?? null;
      const heardCountry = CODES.find((code) => code === published.country?.code) ?? null;
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
      deliver(notice, valueEvents);
      checkChanges(valueEvents, label, proposedOutput);
      checkOnce(label);
      // The proposal needs the parent when it would change a controlled value, or move the
      // country away from the one the precedence requires under a controlled code.
      const needsParent =
        (props.value !== undefined && value !== null) ||
        (props.countryCode !== undefined && country !== (named(props) ?? resolve(props, props.countryCode)));
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
  }

  const code = fc.constantFrom<Code>("FI", "NO", "SE", "SJ");
  const catalog = fc.subarray<Code>(["FI", "NO", "SE", "SJ"], { minLength: 1 });
  // The parent echoes the exact string the field proposed, so every output format takes part;
  // the contracts compare formatted values through the decoder, by their digits.
  const format = fc.constantFrom<Format>("e164", "raw", "international", "national");
  // Numbers as a parent writes them: e164, spaced and dashed international entries, and
  // countryless national digits.
  const number = fc.constantFrom(
    "",
    "+4741234567",
    "+47 41 23 45 67",
    "+46 70-123 45 67",
    // Forms libphonenumber normalizes: a bracketed trunk zero, and the `00` prefix.
    "+46 (0)70-123 45 67",
    "0046 70 123 45 67",
    "+4779123456",
    "+46701234567",
    "+358401234567",
    "41234567",
    "41 23 45 67",
    "701234567",
    // Partial countryless drafts: a lone trunk zero, a trunk zero and a digit, a short number.
    "0",
    "07",
    "070123",
    // Partial international values, and trunk prefixes repeated after the calling code, which
    // libphonenumber strips once per parse.
    "+46",
    "+4600",
    "+467",
    "+4600701234567",
    "+46 (0)0 70 123 45 67"
  );
  const initialProps = fc.record({
    value: fc.option(number, { nil: undefined }),
    defaultValue: fc.option(number, { nil: undefined }),
    defaultCountryCode: fc.option(code, { nil: undefined }),
    // Half the traces start without country control, so starting it is as common as changing it.
    countryCode: fc.option(code, { nil: undefined, freq: 2 }),
    countries: catalog,
    outputFormat: format,
    preserveOnCountryChange: fc.boolean(),
    international: fc.boolean(),
    formatOnType: fc.boolean(),
    autoDetectCountry: fc.boolean(),
    metadata: fc.constantFrom<MetadataKind>("min", "min copy", "max"),
  });
  const userAction: fc.Arbitrary<UserAction> = fc.oneof(
    code.map((country) => ({ kind: "pick" as const, country })),
    fc
      .tuple(code, fc.constantFrom<PasteForm>("plain", "trunk", "national"))
      .map(([country, form]) => ({ kind: "paste" as const, country, form })),
    fc.constantFrom("", ...Object.values(NATIONAL)).map((digits) => ({ kind: "edit" as const, digits }))
  );
  /**
   * Any subset of the props a render can change at once, `countryCode` included: several reach
   * `reconcile` together, as a value with a new catalog, or a format while a proposal waits.
   */
  const compoundChange: fc.Arbitrary<Partial<Props>> = fc.record(
    {
      value: number,
      defaultValue: number,
      defaultCountryCode: code,
      countryCode: code,
      countries: catalog,
      outputFormat: format,
      preserveOnCountryChange: fc.boolean(),
      international: fc.boolean(),
      formatOnType: fc.boolean(),
      autoDetectCountry: fc.boolean(),
      metadata: fc.constantFrom<MetadataKind>("min", "min copy", "max"),
    },
    { requiredKeys: [] }
  );
  /** A compound change, with the releases of country and value control it carries. */
  function withReleases(
    change: Partial<Props>,
    releaseCountry: boolean,
    releaseValue: boolean
  ): Partial<Props> & { readonly release?: true; readonly releaseValue?: true } {
    if (releaseCountry && releaseValue) return { ...change, release: true, releaseValue: true };
    if (releaseCountry) return { ...change, release: true };
    if (releaseValue) return { ...change, releaseValue: true };
    return change;
  }
  /** A change of display settings alone, which steers nothing: format and the two flags. */
  const formattingChange: fc.Arbitrary<Partial<Props>> = fc.record(
    { outputFormat: format, international: fc.boolean(), formatOnType: fc.boolean() },
    { requiredKeys: [] }
  );
  const answer: fc.Arbitrary<Answer> = fc.oneof(
    {
      weight: 3,
      arbitrary: fc.record({
        value: fc.constantFrom("echo", "reject", "countryless", "national"),
        changeWith: fc.constantFrom("first", "last"),
        country: fc.constantFrom("echo", "reject"),
        order: fc.constantFrom("together", "country first", "value first"),
        change: fc.oneof({ weight: 4, arbitrary: fc.constant(null) }, compoundChange),
      }),
    },
    // A parent that takes the number first, in any form, with a formatting change of its own in
    // the same render, then the country.
    fc.record({
      value: fc.constantFrom("echo", "countryless", "national"),
      changeWith: fc.constant("first" as const),
      country: fc.constant("echo" as const),
      order: fc.constant("value first" as const),
      change: formattingChange,
    })
  );
  const step: fc.Arbitrary<Step> = fc.oneof(
    {
      weight: 3,
      arbitrary: fc.record({
        kind: fc.constant("user" as const),
        action: userAction,
        answer: fc.oneof({ weight: 3, arbitrary: answer }, fc.constant("later" as const)),
      }),
    },
    fc.record({ kind: fc.constant("answer" as const), answer }),
    fc.oneof(
      {
        weight: 3,
        arbitrary: code.map((countryCode) => ({ kind: "props" as const, change: { countryCode } })),
      },
      fc.constant({ kind: "props" as const, change: { release: true as const } }),
      fc.constant({ kind: "props" as const, change: { releaseValue: true as const } }),
      code.map((defaultCountryCode) => ({ kind: "props" as const, change: { defaultCountryCode } })),
      number.map((defaultValue) => ({ kind: "props" as const, change: { defaultValue } })),
      {
        weight: 3,
        arbitrary: fc
          .tuple(compoundChange, fc.boolean(), fc.boolean())
          .map(([change, releaseCountry, releaseValue]) => ({
            kind: "props" as const,
            change: withReleases(change, releaseCountry, releaseValue),
          })),
      },
      catalog.map((countries) => ({ kind: "props" as const, change: { countries } })),
      format.map((outputFormat) => ({ kind: "props" as const, change: { outputFormat } })),
      fc.boolean().map((international) => ({ kind: "props" as const, change: { international } })),
      fc.boolean().map((formatOnType) => ({ kind: "props" as const, change: { formatOnType } })),
      fc.boolean().map((autoDetectCountry) => ({ kind: "props" as const, change: { autoDetectCountry } })),
      fc
        .constantFrom<MetadataKind>("min", "min copy", "max")
        .map((metadata) => ({ kind: "props" as const, change: { metadata } })),
      catalog.map((keepingCode) => ({ kind: "props" as const, change: { keepingCode } })),
      fc
        .boolean()
        .map((preserveOnCountryChange) => ({ kind: "props" as const, change: { preserveOnCountryChange } })),
      // Taking control of the value, or replacing it.
      number.map((value) => ({ kind: "props" as const, change: { value } }))
    )
  );

  it("holds every contract after every step of generated traces", () => {
    fc.assert(
      fc.property(initialProps, fc.array(step, { maxLength: 12 }), (initial, steps) => {
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
      countries: catalog,
      outputFormat: format,
      preserveOnCountryChange: fc.boolean(),
      international: fc.boolean(),
      formatOnType: fc.boolean(),
      autoDetectCountry: fc.constant(false),
      metadata: fc.constantFrom<MetadataKind>("min", "max"),
    });
    const paste = fc
      .tuple(code, fc.constantFrom<PasteForm>("plain", "trunk", "national"))
      .map(([country, form]) => ({ kind: "paste" as const, country, form }));
    const toggle = fc
      .boolean()
      .map((autoDetectCountry) => ({ kind: "props" as const, change: { autoDetectCountry } }));
    const control = code.map((countryCode) => ({ kind: "props" as const, change: { countryCode } }));
    const then = fc
      .tuple(control, fc.option(fc.oneof(toggle, control), { nil: undefined }))
      .map(([set, more]) => [
        { kind: "props" as const, change: { autoDetectCountry: true } },
        set,
        ...(more === undefined ? [] : [more]),
      ]);
    fc.assert(
      fc.property(start, paste, answer, then, (initial, action, reply, after) => {
        run(initial, [{ kind: "user", action, answer: reply }, ...after]);
      }),
      { seed: 2, numRuns: 1000 }
    );
  });
});
