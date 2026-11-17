/**
 * The checked-in classification of a switched set's differential: each field and coverage row the
 * capture build differs on from the recipe build, as `spec-diff.ts` finds them, matched to an entry
 * of `oracles/<set>.json` that says what the difference is. Two rows whose values differ only in
 * notation are one row already, as `spec-diff.ts` keys them, so every value an entry classifies
 * differs in meaning. The oracle fails on a difference no entry matches, and on an entry that
 * matches nothing, which a fixed difference leaves behind.
 */

import { Result, Schema } from "effect";

import plan from "../../oracles/plan.json" with { type: "json" };
import type { CoverageRow } from "../components/coverage.ts";
import type { FieldDifference } from "./spec-diff.ts";

/**
 * What a difference is: a defect of the recipe build the capture fixes, a value the recipe build
 * got wrong that the spec never showed, or a loss the capture build accepts.
 */
const VerdictSchema = Schema.Literals(["fix-in-new", "old-was-wrong", "accepted-loss"]);

/**
 * A pattern: an exact text, where each `*` stands for any run of characters and `\\*` for a `*`, as
 * Tailwind's `*:` variant writes one.
 */
const PatternSchema = Schema.String;

const RowMatchSchema = Schema.Struct({
  part: Schema.optionalKey(PatternSchema),
  className: Schema.optionalKey(PatternSchema),
  property: Schema.optionalKey(PatternSchema),
  value: Schema.optionalKey(PatternSchema),
  outcome: Schema.optionalKey(PatternSchema),
  detail: Schema.optionalKey(PatternSchema),
});

const EntrySchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("field"),
    path: PatternSchema,
    verdict: VerdictSchema,
    reason: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("probe"),
    slot: PatternSchema,
    inferred: Schema.String,
    mapped: Schema.String,
    verdict: VerdictSchema,
    reason: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literals(["row-lost", "row-added"]),
    match: RowMatchSchema,
    verdict: VerdictSchema,
    reason: Schema.String,
  }),
]);

/** One classification entry. */
export type OracleEntry = typeof EntrySchema.Type;

const SetOracleSchema = Schema.Struct({ set: Schema.String, entries: Schema.Array(EntrySchema) });

/** The classification of one set's differential. */
export type SetOracle = typeof SetOracleSchema.Type;

/** An oracle file the schema rejects. */
export class OracleUnreadable extends Error {
  readonly _tag = "OracleUnreadable" as const;
}

const decode = Schema.decodeUnknownResult(SetOracleSchema);

/**
 * Parse an oracle file that a JSON import already read.
 *
 * @param value - The file's value.
 * @returns The oracle, or `OracleUnreadable`.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- JSON boundary: an oracle file's parsed value has no type yet, which the schema parses here
export function decodeOracle(value: unknown): Result.Result<SetOracle, OracleUnreadable> {
  return Result.flatMap(
    Result.mapError(decode(value), (error) => new OracleUnreadable(error.message)),
    (oracle) => {
      // A row entry names what it classifies: a match on its outcome or value alone would absorb any
      // row, as a wildcard does.
      const vague = oracle.entries.find(
        (entry) =>
          (entry.kind === "row-lost" || entry.kind === "row-added") &&
          NAMING_FIELDS.every((field) => entry.match[field] === undefined)
      );
      return vague === undefined
        ? Result.succeed(oracle)
        : Result.fail(
            new OracleUnreadable(
              `${oracle.set}: a ${vague.kind} entry names none of ${NAMING_FIELDS.join(", ")}, so it would match any row`
            )
          );
    }
  );
}

/** The fields one of which a row entry's match must name. */
const NAMING_FIELDS = ["part", "className", "property", "detail"] as const;

/** Whether a text matches a pattern, each `*` of which stands for any run of characters. */
function matches(pattern: string, text: string): boolean {
  const parts = pattern
    .split(/(?<!\\)\*/)
    .map((part) => part.replaceAll("\\*", "*").replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${parts.join(".*")}$`, "s").test(text);
}

/**
 * Whether a pattern names one text exactly: it holds no wildcard `*`.
 *
 * @param pattern - The pattern.
 * @returns True where only one text matches it.
 */
export function isExact(pattern: string): boolean {
  return !/(?<!\\)\*/.test(pattern);
}

/** Whether a row matches each field an entry names. */
function rowMatches(
  entry: OracleEntry & { readonly kind: "row-lost" | "row-added" },
  row: CoverageRow
): boolean {
  return ROW_FIELDS.every((field) => {
    const pattern = entry.match[field];
    return pattern === undefined || matches(pattern, row[field]);
  });
}

/** The fields of a coverage row an entry can match. */
const ROW_FIELDS = ["part", "className", "property", "value", "outcome", "detail"] as const;

/** What a set's differential leaves once its oracle classified it. */
export type Classified = {
  readonly fields: readonly FieldDifference[];
  readonly lost: readonly CoverageRow[];
  readonly added: readonly CoverageRow[];
  /** The entries that matched no difference. */
  readonly stale: readonly OracleEntry[];
};

/**
 * Classify a set's differential.
 *
 * @param differential - The fields and the rows the builds differ on.
 * @param oracle - The set's entries.
 * @returns The differences no entry matches, and the entries that match no difference.
 */
export function classify(
  differential: {
    readonly fields: readonly FieldDifference[];
    readonly lost: readonly CoverageRow[];
    readonly added: readonly CoverageRow[];
  },
  oracle: SetOracle
): Classified {
  const used = new Set<OracleEntry>();
  const covered = <Item>(items: readonly Item[], test: (entry: OracleEntry, item: Item) => boolean): Item[] =>
    items.filter((item) => {
      const entry = oracle.entries.find((candidate) => test(candidate, item));
      if (entry !== undefined) {
        used.add(entry);
      }
      return entry === undefined;
    });
  const fields = covered(
    differential.fields,
    (entry, field) => entry.kind === "field" && matches(entry.path, field.path)
  );
  const lost = covered(
    differential.lost,
    (entry, row) => entry.kind === "row-lost" && rowMatches(entry, row)
  );
  const added = covered(
    differential.added,
    (entry, row) => entry.kind === "row-added" && rowMatches(entry, row)
  );
  // The perturbation probe, which runs in the browser, judges the `probe` entries.
  return {
    fields,
    lost,
    added,
    stale: oracle.entries.filter((entry) => entry.kind !== "probe" && !used.has(entry)),
  };
}

/**
 * Whether a set's oracle classifies a contradiction the perturbation probe found: an entry names the
 * box's `data-slot`, what the probe inferred and the kind the spec maps.
 *
 * @param oracle - The set's entries.
 * @param found - The contradiction's box, inference and mapped kind.
 * @returns True where an entry classifies it.
 */
export function classifiesProbe(
  oracle: SetOracle,
  found: { readonly slot: string; readonly inferred: string; readonly mapped: string }
): boolean {
  return oracle.entries.some(
    (entry) =>
      entry.kind === "probe" &&
      matches(entry.slot, found.slot) &&
      entry.inferred === found.inferred &&
      entry.mapped === found.mapped
  );
}

const PlanOracleSchema = Schema.Struct({
  set: Schema.Literal("plan"),
  entries: Schema.Array(
    Schema.Struct({ pattern: PatternSchema, verdict: VerdictSchema, reason: Schema.String })
  ),
});

/** The classification of the fake-file Plan differential: each line Plan lists, by pattern. */
export type PlanOracle = typeof PlanOracleSchema.Type;

/**
 * Parse `oracles/plan.json`, which a JSON import already read.
 *
 * @param value - The file's value.
 * @returns The oracle, or `OracleUnreadable`.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- JSON boundary: the plan oracle's parsed value has no type yet, which the schema parses here
export function decodePlanOracle(value: unknown): Result.Result<PlanOracle, OracleUnreadable> {
  return Result.mapError(
    Schema.decodeUnknownResult(PlanOracleSchema)(value),
    (error) => new OracleUnreadable(error.message)
  );
}

/** What a Plan run leaves once its oracle classified it: the lines no entry matches, and the stale entries. */
export type PlanClassified = { readonly lines: readonly string[]; readonly stale: readonly string[] };

/**
 * Classify the lines of a Plan run: the lines no entry matches, and the entries that match no line.
 *
 * @param lines - The changes Plan lists.
 * @param oracle - The plan's entries.
 * @returns What stays unclassified, and the stale entries.
 */
export function classifyPlan(lines: readonly string[], oracle: PlanOracle): PlanClassified {
  const used = new Set<string>();
  const left = lines.filter((line) => {
    const entry = oracle.entries.find((candidate) => matches(candidate.pattern, line));
    if (entry !== undefined) {
      used.add(entry.pattern);
    }
    return entry === undefined;
  });
  return {
    lines: left,
    stale: oracle.entries.flatMap(({ pattern }) => (used.has(pattern) ? [] : [pattern])),
  };
}

/**
 * The kept `oracles/plan.json`.
 *
 * @returns The plan oracle, or `OracleUnreadable` for a file the schema rejects.
 */
export function keptPlanOracle(): Result.Result<PlanOracle, OracleUnreadable> {
  return decodePlanOracle(plan);
}
