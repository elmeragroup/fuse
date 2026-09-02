import { Schema } from "effect";

export const ProvenanceEntrySchema = Schema.Struct({
  path: Schema.Array(Schema.String),
  declarationPaths: Schema.Array(Schema.String),
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
