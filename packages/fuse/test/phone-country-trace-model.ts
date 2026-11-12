import fc from "fast-check";

import type { TraceCode } from "./phone-number-oracle";
import { traceCatalog, traceCode, traceFormat, traceUserAction } from "./phone-trace-arbitraries";
import type { TraceFormat, TraceUserAction } from "./phone-trace-arbitraries";

/**
 * The trace model of the controlled-country contract suite: the props a parent renders, how it
 * answers a proposal, the steps of a trace, and their generators.
 */

/** min metadata; an equivalent copy of it, made anew on every render; or max metadata. */
export type MetadataKind = "min" | "min copy" | "max";

/** The props a parent renders the field with, in trace terms. */
export type CountryTraceProps = {
  readonly value?: string;
  readonly defaultValue?: string;
  readonly defaultCountryCode?: TraceCode;
  readonly countryCode?: TraceCode;
  readonly countries: readonly TraceCode[];
  readonly outputFormat: TraceFormat;
  readonly preserveOnCountryChange: boolean;
  readonly international: boolean;
  readonly formatOnType: boolean;
  readonly autoDetectCountry: boolean;
  /** Which metadata document the field gets. */
  readonly metadata: MetadataKind;
};

/** How a parent answers a user proposal. */
export type TraceAnswer = {
  /**
   * The value the parent stores: the output it heard, its old value, the national digits, or
   * the national number written with a trunk zero, as "070…" or "040…".
   */
  readonly value: "echo" | "reject" | "countryless" | "national";
  /** With which render of a split answer the parent's own change arrives. */
  readonly changeWith: "first" | "last";
  /** Whether the parent sets the country it heard, or keeps its own. */
  readonly country: "echo" | "reject";
  /** Props the parent changes of its own in the same render as its answer, or null. */
  readonly change: Partial<CountryTraceProps> | null;
  /**
   * How the parent's answer arrives: in one render, or the country and the value in two. An
   * immediate `country first` answer is synchronous: the parent commits the country inside
   * `onCountryChange`, before the proposal's `onChange` runs.
   */
  readonly order: "together" | "country first" | "value first";
};

/** A props change a parent makes of its own, with the releases and catalog it may carry. */
export type TracePropsChange = Partial<CountryTraceProps> & {
  /** The parent gives up control of the country. */
  readonly release?: true;
  /** The parent gives up control of the value. */
  readonly releaseValue?: true;
  /** A catalog that keeps the controlled code offered, when there is one. */
  readonly keepingCode?: readonly TraceCode[];
};

/** One step of a trace: a user action and its answer, a late answer, or a props change. */
export type TraceStep =
  | { readonly kind: "user"; readonly action: TraceUserAction; readonly answer: TraceAnswer | "later" }
  | { readonly kind: "answer"; readonly answer: TraceAnswer }
  | { readonly kind: "props"; readonly change: TracePropsChange };

/**
 * Numbers as a parent writes them: e164, spaced and dashed international entries, and
 * countryless national digits.
 */
export const traceNumber: fc.Arbitrary<string> = fc.constantFrom(
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

const metadataKind = fc.constantFrom<MetadataKind>("min", "min copy", "max");

/** A trace's first props; half the traces start without country control. */
export const initialTraceProps: fc.Arbitrary<CountryTraceProps> = fc.record({
  value: fc.option(traceNumber, { nil: undefined }),
  defaultValue: fc.option(traceNumber, { nil: undefined }),
  defaultCountryCode: fc.option(traceCode, { nil: undefined }),
  // Half the traces start without country control, so starting it is as common as changing it.
  countryCode: fc.option(traceCode, { nil: undefined, freq: 2 }),
  countries: traceCatalog,
  outputFormat: traceFormat,
  preserveOnCountryChange: fc.boolean(),
  international: fc.boolean(),
  formatOnType: fc.boolean(),
  autoDetectCountry: fc.boolean(),
  metadata: metadataKind,
});

/**
 * Any subset of the props a render can change at once, `countryCode` included: several reach
 * `reconcile` together, as a value with a new catalog, or a format while a proposal waits.
 */
const compoundChange: fc.Arbitrary<Partial<CountryTraceProps>> = fc.record(
  {
    value: traceNumber,
    defaultValue: traceNumber,
    defaultCountryCode: traceCode,
    countryCode: traceCode,
    countries: traceCatalog,
    outputFormat: traceFormat,
    preserveOnCountryChange: fc.boolean(),
    international: fc.boolean(),
    formatOnType: fc.boolean(),
    autoDetectCountry: fc.boolean(),
    metadata: metadataKind,
  },
  { requiredKeys: [] }
);

/** A compound change, with the releases of country and value control it carries. */
function withReleases(
  change: Partial<CountryTraceProps>,
  releaseCountry: boolean,
  releaseValue: boolean
): TracePropsChange {
  if (releaseCountry && releaseValue) return { ...change, release: true, releaseValue: true };
  if (releaseCountry) return { ...change, release: true };
  if (releaseValue) return { ...change, releaseValue: true };
  return change;
}

/** A change of display settings alone, which steers nothing: format and the two flags. */
const formattingChange: fc.Arbitrary<Partial<CountryTraceProps>> = fc.record(
  { outputFormat: traceFormat, international: fc.boolean(), formatOnType: fc.boolean() },
  { requiredKeys: [] }
);

/** Any answer, mostly without a change of the parent's own. */
export const traceAnswer: fc.Arbitrary<TraceAnswer> = fc.oneof(
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

const propsStep = (change: TracePropsChange): TraceStep => ({ kind: "props", change });

/** Any step: mostly user actions, then late answers and props changes of every kind. */
export const traceStep: fc.Arbitrary<TraceStep> = fc.oneof(
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant("user" as const),
      action: traceUserAction,
      answer: fc.oneof({ weight: 3, arbitrary: traceAnswer }, fc.constant("later" as const)),
    }),
  },
  fc.record({ kind: fc.constant("answer" as const), answer: traceAnswer }),
  fc.oneof(
    { weight: 3, arbitrary: traceCode.map((countryCode) => propsStep({ countryCode })) },
    fc.constant(propsStep({ release: true })),
    fc.constant(propsStep({ releaseValue: true })),
    traceCode.map((defaultCountryCode) => propsStep({ defaultCountryCode })),
    traceNumber.map((defaultValue) => propsStep({ defaultValue })),
    {
      weight: 3,
      arbitrary: fc
        .tuple(compoundChange, fc.boolean(), fc.boolean())
        .map(([change, releaseCountry, releaseValue]) =>
          propsStep(withReleases(change, releaseCountry, releaseValue))
        ),
    },
    traceCatalog.map((countries) => propsStep({ countries })),
    traceFormat.map((outputFormat) => propsStep({ outputFormat })),
    fc.boolean().map((international) => propsStep({ international })),
    fc.boolean().map((formatOnType) => propsStep({ formatOnType })),
    fc.boolean().map((autoDetectCountry) => propsStep({ autoDetectCountry })),
    metadataKind.map((metadata) => propsStep({ metadata })),
    traceCatalog.map((keepingCode) => propsStep({ keepingCode })),
    fc.boolean().map((preserveOnCountryChange) => propsStep({ preserveOnCountryChange })),
    // Taking control of the value, or replacing it.
    traceNumber.map((value) => propsStep({ value }))
  )
);
