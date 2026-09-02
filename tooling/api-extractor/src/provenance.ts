import { Schema } from "effect";

/**
 * Who owns one declaration file, as the backend classified it: the extracted
 * project, a dependency package, an external file with no package owner, or
 * TypeScript's own library or toolchain files.
 */
export const DeclarationOwnerSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("project") }),
  Schema.Struct({ kind: Schema.Literal("dependency"), packageName: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("external") }),
  Schema.Struct({
    kind: Schema.Literal("typescript"),
    library: Schema.Literals(["standard-library", "toolchain"] as const),
  }),
]);
export type DeclarationOwner = typeof DeclarationOwnerSchema.Type;

export const ProvenanceEntrySchema = Schema.Struct({
  path: Schema.Array(Schema.String),
  declarationPaths: Schema.Array(Schema.String),
  /**
   * The owner of each `declarationPaths` entry, in the same order. Present
   * whenever the backend reported a declaration handle for every path, so a
   * consumer can ask "is this project-owned?" or "which package declares it?"
   * without parsing paths.
   */
  owners: Schema.optionalKey(Schema.Array(DeclarationOwnerSchema)),
  synthesized: Schema.Boolean,
  /** Readonly declaration state kept out of the upstream semantic JSON model. */
  readonly: Schema.optionalKey(Schema.Boolean),
  defaultInitializer: Schema.optionalKey(Schema.String),
  /**
   * Repository-relative files of each intermediate re-export declaration that
   * forwarded this export, outermost first. The original declaration site is
   * carried by `declarationPaths`; a directly declared export has no chain.
   */
  reexportChain: Schema.optionalKey(Schema.Array(Schema.String)),
});
export type ProvenanceEntry = typeof ProvenanceEntrySchema.Type;

export const ProvenanceSchema = Schema.Array(ProvenanceEntrySchema);
