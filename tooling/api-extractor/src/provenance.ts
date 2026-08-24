import { Schema } from "effect";

export type ProvenanceEntry = {
  readonly path: readonly string[];
  readonly declarationPaths: readonly string[];
  readonly synthesized: boolean;
  /** Readonly declaration state kept out of the upstream semantic JSON model. */
  readonly readonly?: boolean;
  readonly defaultInitializer?: string;
};

export const ProvenanceEntrySchema = Schema.Struct({
  path: Schema.Array(Schema.String),
  declarationPaths: Schema.Array(Schema.String),
  synthesized: Schema.Boolean,
  readonly: Schema.optionalKey(Schema.Boolean),
  defaultInitializer: Schema.optionalKey(Schema.String),
});

export const ProvenanceSchema = Schema.Array(ProvenanceEntrySchema);
