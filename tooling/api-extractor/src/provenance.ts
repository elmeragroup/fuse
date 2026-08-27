import { Schema } from "effect";

export type ProvenanceEntry = {
  readonly path: readonly string[];
  readonly declarationPaths: readonly string[];
  readonly synthesized: boolean;
  /** Readonly declaration state kept out of the upstream semantic JSON model. */
  readonly readonly?: boolean;
  readonly defaultInitializer?: string;
  /**
   * Repository-relative files of each intermediate re-export declaration that
   * forwarded this export, outermost first. The original declaration site is
   * carried by `declarationPaths`; a directly declared export has no chain.
   */
  readonly reexportChain?: readonly string[];
};

export const ProvenanceEntrySchema = Schema.Struct({
  path: Schema.Array(Schema.String),
  declarationPaths: Schema.Array(Schema.String),
  synthesized: Schema.Boolean,
  readonly: Schema.optionalKey(Schema.Boolean),
  defaultInitializer: Schema.optionalKey(Schema.String),
  reexportChain: Schema.optionalKey(Schema.Array(Schema.String)),
});

export const ProvenanceSchema = Schema.Array(ProvenanceEntrySchema);
