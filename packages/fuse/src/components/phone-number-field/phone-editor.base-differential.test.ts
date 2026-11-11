import fc from "fast-check";
import maxMetadata from "libphonenumber-js/metadata.max.json";
import { describe, expect, it } from "vitest";

import * as BaseEditor from "../../../test/phone-base/phone-editor";
import * as PhoneEditor from "./phone-editor";
import type { PhoneEditorProps, PhoneEditorState } from "./phone-editor";
import { defaultMetadata } from "./phone-engine";

/**
 * Without `countryCode` the field behaves exactly as it did before controlled country. The oracle
 * is that editor itself, frozen in `test/phone-base` as #586 left it: every generated trace runs
 * through both, with the same props and parent answers, and after every step what the field shows
 * (display, output, country and caret) and what `onChange` hears must agree. Metadata comes as
 * distinct min and max documents only: a shallow copy of one is the same catalog since the
 * structural metadata key, a deliberate change from the base, which compared by identity.
 */
describe("PhoneEditor without countryCode, against the base editor", () => {
  type Code = "FI" | "NO" | "SE" | "SJ";
  type Format = "e164" | "raw" | "international" | "national";
  const DIAL = { FI: "358", NO: "47", SE: "46", SJ: "47" } as const satisfies Record<Code, string>;
  const NATIONAL = {
    FI: "401234567",
    NO: "41234567",
    SE: "701234567",
    SJ: "79123456",
  } as const satisfies Record<Code, string>;

  type Props = {
    readonly value?: string;
    readonly defaultValue?: string;
    readonly defaultCountryCode?: Code;
    readonly countries: readonly Code[];
    readonly outputFormat: Format;
    readonly preserveOnCountryChange: boolean;
    readonly international: boolean;
    readonly formatOnType: boolean;
    readonly autoDetectCountry: boolean;
    readonly metadata: "min" | "max";
  };
  type UserAction =
    | { readonly kind: "pick"; readonly country: Code }
    | { readonly kind: "paste"; readonly country: Code }
    | { readonly kind: "edit"; readonly digits: string };
  type Answer = "echo" | "reject" | "countryless" | "later";
  type Step =
    | { readonly kind: "user"; readonly action: UserAction; readonly answer: Answer }
    | {
        readonly kind: "answer";
        readonly answer: Exclude<Answer, "later">;
        /** Props the parent changes in the same render as its answer. */
        readonly change: Partial<Props>;
      }
    | { readonly kind: "reset" }
    | {
        readonly kind: "props";
        readonly change: Partial<Props>;
        /** The parent gives up control of the value in the same render. */
        readonly releaseValue: boolean;
      };

  /** Both editors' props for `props`; the live one never sees `countryCode`. */
  function editorProps({ metadata, ...rest }: Props): PhoneEditorProps {
    return { ...rest, metadata: metadata === "max" ? maxMetadata : defaultMetadata };
  }

  /** What a parent observes of a state, as plain data. */
  function observed(view: BaseEditor.PhoneEditorView | PhoneEditor.PhoneEditorView) {
    const { displayValue, outputValue, country, selection } = view;
    return {
      display: displayValue,
      output: outputValue,
      country: country.code,
      selection: selection && { start: selection.start, end: selection.end, direction: selection.direction },
    };
  }

  function act(action: UserAction) {
    const fill = (value: string) => ({
      value,
      selectionStart: value.length,
      selectionEnd: value.length,
      selectionDirection: "none" as const,
      inputType: "insertText",
    });
    switch (action.kind) {
      case "pick":
        return {
          live: (state: PhoneEditorState) => PhoneEditor.selectCountry(state, action.country),
          base: (state: BaseEditor.PhoneEditorState) => BaseEditor.selectCountry(state, action.country),
        };
      case "paste": {
        const text = `+${DIAL[action.country]}${NATIONAL[action.country]}`;
        return {
          live: (state: PhoneEditorState) => PhoneEditor.paste(state, text),
          base: (state: BaseEditor.PhoneEditorState) => BaseEditor.paste(state, text),
        };
      }
      case "edit":
        return {
          live: (state: PhoneEditorState) => PhoneEditor.edit(state, fill(action.digits)),
          base: (state: BaseEditor.PhoneEditorState) => BaseEditor.edit(state, fill(action.digits)),
        };
      default:
        return unhandled(action);
    }
  }

  function unhandled(unexpected: never): never {
    throw new Error(`unhandled ${JSON.stringify(unexpected)}`);
  }

  function run(initial: Props, steps: readonly Step[]): void {
    let props = initial;
    let live = PhoneEditor.create(editorProps(props));
    let base = BaseEditor.create(editorProps(props));
    let heard: string | null = null;
    const compare = (label: string) => {
      expect(observed(PhoneEditor.view(live)), label).toEqual(observed(BaseEditor.view(base)));
      expect(PhoneEditor.steeredValue(live), `no steering without countryCode, ${label}`).toBeNull();
    };
    const render = (next: Props, label: string) => {
      props = next;
      live = PhoneEditor.reconcile(live, editorProps(props));
      base = BaseEditor.reconcile(base, editorProps(props));
      compare(label);
    };
    const answer = (kind: Exclude<Answer, "later">, label: string, change: Partial<Props> = {}) => {
      const value = heard;
      heard = null;
      if (props.value === undefined || value === null || kind === "reject") {
        render({ ...props, ...change }, label);
        return;
      }
      const digits = value.replace(/[^\d+]/g, "");
      const answered = kind === "echo" ? value : digits.replace(/^\+\d{2,3}/, "");
      render({ ...props, value: answered, ...change }, label);
    };
    compare("mount");
    for (const [index, step] of steps.entries()) {
      const label = `step ${index + 1}: ${JSON.stringify(step)}`;
      switch (step.kind) {
        case "user": {
          const { live: liveAct, base: baseAct } = act(step.action);
          live = liveAct(live);
          base = baseAct(base);
          const said = PhoneEditor.proposalNotice(live)?.value ?? null;
          expect(said, `onChange hears the same, ${label}`).toBe(BaseEditor.proposedValue(base));
          compare(label);
          heard = said;
          if (step.answer === "later") {
            render(props, `${label} (unanswered)`);
          } else {
            answer(step.answer, label);
          }
          break;
        }
        case "answer":
          answer(step.answer, label, step.change);
          break;
        case "reset":
          if (props.value === undefined) {
            live = PhoneEditor.reset(live);
            base = BaseEditor.reset(base);
            compare(label);
          }
          break;
        case "props": {
          const merged: Props = { ...props, ...step.change };
          render(step.releaseValue ? (({ value: _released, ...rest }) => rest)(merged) : merged, label);
          break;
        }
        default:
          unhandled(step);
      }
    }
  }

  const code = fc.constantFrom<Code>("FI", "NO", "SE", "SJ");
  const catalog = fc.subarray<Code>(["FI", "NO", "SE", "SJ"], { minLength: 1 });
  const format = fc.constantFrom<Format>("e164", "raw", "international", "national");
  const number = fc.constantFrom(
    "",
    "+4741234567",
    "+46701234567",
    "+4779123456",
    "41234567",
    "070-123 45 67",
    // International entries written with spacing and dashes, kept as typed.
    "+47 41 23 45 67",
    "+46 70-123 45 67",
    // Forms libphonenumber normalizes: a bracketed trunk zero, and the `00` prefix.
    "+46 (0)70-123 45 67",
    "0046 70 123 45 67",
    // Partial international values, and trunk prefixes repeated after the calling code, which
    // libphonenumber strips once per parse.
    "+46",
    "+4600",
    "+467",
    "+4600701234567",
    "+44 (0)0 20 7946 0958"
  );
  const initialProps: fc.Arbitrary<Props> = fc.record(
    {
      value: number,
      defaultValue: number,
      defaultCountryCode: code,
      countries: catalog,
      outputFormat: format,
      preserveOnCountryChange: fc.boolean(),
      international: fc.boolean(),
      formatOnType: fc.boolean(),
      autoDetectCountry: fc.boolean(),
      metadata: fc.constantFrom<"min" | "max">("min", "max"),
    },
    {
      requiredKeys: [
        "countries",
        "outputFormat",
        "preserveOnCountryChange",
        "international",
        "formatOnType",
        "autoDetectCountry",
        "metadata",
      ],
    }
  );
  const userAction: fc.Arbitrary<UserAction> = fc.oneof(
    code.map((country) => ({ kind: "pick" as const, country })),
    code.map((country) => ({ kind: "paste" as const, country })),
    fc.constantFrom("", ...Object.values(NATIONAL)).map((digits) => ({ kind: "edit" as const, digits }))
  );
  /**
   * Any subset of the props a render can change at once: the value (taking control), the
   * defaults, the catalog, the format, the flags, detection and the metadata. Several at once
   * reach `reconcile` together, as a value with a new catalog, or a format while a proposal waits.
   */
  const compoundChange: fc.Arbitrary<Partial<Props>> = fc.record(
    {
      value: number,
      defaultValue: number,
      defaultCountryCode: code,
      countries: catalog,
      outputFormat: format,
      preserveOnCountryChange: fc.boolean(),
      international: fc.boolean(),
      formatOnType: fc.boolean(),
      autoDetectCountry: fc.boolean(),
      metadata: fc.constantFrom<"min" | "max">("min", "max"),
    },
    { requiredKeys: [] }
  );
  const propsStep = (change: Partial<Props>, releaseValue = false) => ({
    kind: "props" as const,
    change,
    releaseValue,
  });
  const step: fc.Arbitrary<Step> = fc.oneof(
    {
      weight: 3,
      arbitrary: fc.record({
        kind: fc.constant("user" as const),
        action: userAction,
        answer: fc.constantFrom<Answer>("echo", "reject", "countryless", "later"),
      }),
    },
    fc.record({
      kind: fc.constant("answer" as const),
      answer: fc.constantFrom("echo", "reject", "countryless"),
      change: fc.oneof({ weight: 3, arbitrary: fc.constant({}) }, compoundChange),
    }),
    fc.constant({ kind: "reset" as const }),
    fc.oneof(
      code.map((defaultCountryCode) => propsStep({ defaultCountryCode })),
      number.map((defaultValue) => propsStep({ defaultValue })),
      fc.boolean().map((preserveOnCountryChange) => propsStep({ preserveOnCountryChange })),
      catalog.map((countries) => propsStep({ countries })),
      format.map((outputFormat) => propsStep({ outputFormat })),
      fc.boolean().map((international) => propsStep({ international })),
      fc.boolean().map((formatOnType) => propsStep({ formatOnType })),
      fc.boolean().map((autoDetectCountry) => propsStep({ autoDetectCountry })),
      fc.constantFrom<"min" | "max">("min", "max").map((metadata) => propsStep({ metadata })),
      number.map((value) => propsStep({ value })),
      // The parent gives up control of the value, alone or with other changes.
      fc.constant(propsStep({}, true)),
      fc.tuple(compoundChange, fc.boolean()).map(([change, release]) => propsStep(change, release))
    )
  );

  it("shows and reports what the base editor does, after every step", () => {
    fc.assert(
      fc.property(initialProps, fc.array(step, { maxLength: 12 }), (initial, steps) => {
        run(initial, steps);
      }),
      { seed: 20261112, numRuns: 1000 }
    );
  });
});
