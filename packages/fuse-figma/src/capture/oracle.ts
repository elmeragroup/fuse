/**
 * The checked-in classification of a switched set's differential: each field and coverage row the
 * capture build differs on from the recipe build, as `spec-diff.ts` finds them, matched to an entry
 * of `oracles/<set>.json` that says what the difference is. A `row-value` entry classifies a
 * lost row and an added row that differ only in their value's text as one rewritten row. The oracle fails on a difference
 * no entry matches, and on an entry that matches nothing, which a fixed difference leaves behind.
 */

import { Result, Schema } from "effect";

import type { CoverageRow } from "../components/coverage.ts";
import type { FieldDifference } from "./spec-diff.ts";

/**
 * What a difference is: a defect of the recipe build the capture fixes, a value the recipe build
 * got wrong that the spec never showed, or a loss the capture build accepts.
 */
const VerdictSchema = Schema.Literals(["fix-in-new", "old-was-wrong", "accepted-loss"]);

/** A pattern: an exact text, where each `*` stands for any run of characters. */
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
    kind: Schema.Literals(["row-lost", "row-added", "row-value"]),
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
  return Result.mapError(decode(value), (error) => new OracleUnreadable(error.message));
}

/** Whether a text matches a pattern, each `*` of which stands for any run of characters. */
function matches(pattern: string, text: string): boolean {
  const parts = pattern.split("*").map((part) => part.replaceAll(/[.+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${parts.join(".*")}$`, "s").test(text);
}

/** Whether a row matches each field an entry names. */
function rowMatches(
  entry: OracleEntry & { readonly kind: "row-lost" | "row-added" | "row-value" },
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
  // A lost row and an added row that differ only in their value's text are one rewritten row.
  const sameButValue = (row: CoverageRow) =>
    JSON.stringify([row.part, row.className, row.property, row.outcome, row.detail]);
  const addedByKey = new Map<string, CoverageRow[]>();
  for (const row of differential.added) {
    addedByKey.set(sameButValue(row), [...(addedByKey.get(sameButValue(row)) ?? []), row]);
  }
  const rewritten = new Set<CoverageRow>();
  for (const row of differential.lost) {
    const twin = addedByKey.get(sameButValue(row))?.find((candidate) => !rewritten.has(candidate));
    const entry = oracle.entries.find(
      (candidate) => candidate.kind === "row-value" && rowMatches(candidate, row)
    );
    if (twin !== undefined && entry !== undefined) {
      rewritten.add(row);
      rewritten.add(twin);
      used.add(entry);
    }
  }
  const lost = covered(
    differential.lost.filter((row) => !rewritten.has(row)),
    (entry, row) => entry.kind === "row-lost" && rowMatches(entry, row)
  );
  const added = covered(
    differential.added.filter((row) => !rewritten.has(row)),
    (entry, row) => entry.kind === "row-added" && rowMatches(entry, row)
  );
  return { fields, lost, added, stale: oracle.entries.filter((entry) => !used.has(entry)) };
}
