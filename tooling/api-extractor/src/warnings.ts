import { Schema } from "effect";

export const typeFlagNames = [
  "Any",
  "Unknown",
  "Undefined",
  "Null",
  "Void",
  "String",
  "Number",
  "BigInt",
  "Boolean",
  "ESSymbol",
  "StringLiteral",
  "NumberLiteral",
  "BigIntLiteral",
  "BooleanLiteral",
  "UniqueESSymbol",
  "EnumLiteral",
  "Enum",
  "NonPrimitive",
  "Never",
  "TypeParameter",
  "Object",
  "Index",
  "TemplateLiteral",
  "StringMapping",
  "Substitution",
  "IndexedAccess",
  "Conditional",
  "Union",
  "Intersection",
  "Other",
] as const;

export type TypeFlagName = (typeof typeFlagNames)[number];

const WarningLocationSchema = Schema.Struct({
  message: Schema.String,
  filePath: Schema.String,
  line: Schema.Number,
  column: Schema.Number,
  parsedSymbolStack: Schema.Array(Schema.String),
});

export type UnsupportedTypeFallbackWarning = {
  readonly code: "unsupported-type-fallback";
  readonly message: string;
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly parsedSymbolStack: readonly string[];
  readonly typeFlags: readonly TypeFlagName[];
  readonly typeText: string;
  readonly sourceText?: string;
};

export type MissingEnumDeclarationWarning = {
  readonly code: "missing-enum-declaration";
  readonly message: string;
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly parsedSymbolStack: readonly string[];
  readonly enumName: string;
  readonly memberName?: string;
};

export type MissingDefaultExportSymbolWarning = {
  readonly code: "missing-default-export-symbol";
  readonly message: string;
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly parsedSymbolStack: readonly string[];
  readonly sourceText: string;
};

/**
 * Why an index signature the type declares is missing from the model.
 *
 * `unrepresentable-key` is a key domain the semantic model has no encoding for —
 * a `symbol` key, or a template-literal pattern key. `additional-signature` is a
 * key that *is* representable but lost the model's single index-signature slot,
 * which is what happens to the legal `string` plus `number` pair.
 */
export type OmittedIndexSignatureReason = "unrepresentable-key" | "additional-signature";

export type OmittedIndexSignatureWarning = {
  readonly code: "omitted-index-signature";
  readonly message: string;
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly parsedSymbolStack: readonly string[];
  readonly reason: OmittedIndexSignatureReason;
  readonly keyTypes: readonly string[];
};

/**
 * A construct signature the model cannot carry because its owner is not a
 * class — an interface or object literal type that only declares `new (…)`.
 * Upstream reports such shapes as bare objects; the warning records what was
 * omitted and where in the semantic tree it would have lived.
 */
export type UnrepresentedConstructSignaturesWarning = {
  readonly code: "unrepresented-construct-signatures";
  readonly message: string;
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly parsedSymbolStack: readonly string[];
  readonly structuralPath: readonly string[];
  readonly signatureCount: number;
};

/**
 * Named members a callable shape carries besides its call signatures. A
 * function node has no member list, so an interface that merges call
 * signatures with properties keeps only the callable half; the warning names
 * the members that did not survive.
 */
export type OmittedCallableMembersWarning = {
  readonly code: "omitted-callable-members";
  readonly message: string;
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly parsedSymbolStack: readonly string[];
  readonly structuralPath: readonly string[];
  readonly memberNames: readonly string[];
};

/**
 * Why a re-export produced no export: its alias chain dead-ends
 * (`missing-target`) or returns to a namespace already being flattened
 * (`cycle`). A third condition, `ambiguous`, is detected above this union by
 * star-export collision analysis and reported with the same code.
 */
export type UnresolvedReExportReason = "missing-target" | "cycle" | "ambiguous";

/**
 * Why an export that looks like a React component was left untransformed.
 * `mixed-component-union` is a capitalized export whose union type holds some
 * arms returning React node types and at least one arm that does not: the
 * component heuristic cannot confirm the export describes one component, so
 * the resolved union kind stands and this warning records the uncertainty
 * instead of silently changing the semantic kind.
 */
export type UncertainComponentRecognitionReason = "mixed-component-union";

export type UncertainComponentRecognitionWarning = {
  readonly code: "uncertain-component-recognition";
  readonly message: string;
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly parsedSymbolStack: readonly string[];
  readonly reason: UncertainComponentRecognitionReason;
  readonly name: string;
};

/**
 * A re-export the module walk could not follow to an original declaration.
 * The export is skipped; the warning names it, says why, and anchors the
 * location at the re-exporting module.
 */
export type UnresolvedReExportWarning = {
  readonly code: "unresolved-re-export";
  readonly message: string;
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly parsedSymbolStack: readonly string[];
  readonly reason: UnresolvedReExportReason;
  readonly name: string;
};

export type ExtractWarning =
  | UnsupportedTypeFallbackWarning
  | MissingEnumDeclarationWarning
  | MissingDefaultExportSymbolWarning
  | OmittedIndexSignatureWarning
  | UnrepresentedConstructSignaturesWarning
  | OmittedCallableMembersWarning
  | UnresolvedReExportWarning
  | UncertainComponentRecognitionWarning;

export const UnsupportedTypeFallbackWarningSchema = Schema.Struct({
  ...WarningLocationSchema.fields,
  code: Schema.Literal("unsupported-type-fallback"),
  typeFlags: Schema.Array(Schema.Literals(typeFlagNames)),
  typeText: Schema.String,
  sourceText: Schema.optionalKey(Schema.String),
});

export const MissingEnumDeclarationWarningSchema = Schema.Struct({
  ...WarningLocationSchema.fields,
  code: Schema.Literal("missing-enum-declaration"),
  enumName: Schema.String,
  memberName: Schema.optionalKey(Schema.String),
});

export const MissingDefaultExportSymbolWarningSchema = Schema.Struct({
  ...WarningLocationSchema.fields,
  code: Schema.Literal("missing-default-export-symbol"),
  sourceText: Schema.String,
});

export const OmittedIndexSignatureWarningSchema = Schema.Struct({
  ...WarningLocationSchema.fields,
  code: Schema.Literal("omitted-index-signature"),
  reason: Schema.Literals(["unrepresentable-key", "additional-signature"] as const),
  keyTypes: Schema.Array(Schema.Literals(["string", "number", "symbol", "other"] as const)),
});

export const UnrepresentedConstructSignaturesWarningSchema = Schema.Struct({
  ...WarningLocationSchema.fields,
  code: Schema.Literal("unrepresented-construct-signatures"),
  structuralPath: Schema.Array(Schema.String),
  signatureCount: Schema.Natural,
});

export const OmittedCallableMembersWarningSchema = Schema.Struct({
  ...WarningLocationSchema.fields,
  code: Schema.Literal("omitted-callable-members"),
  structuralPath: Schema.Array(Schema.String),
  memberNames: Schema.Array(Schema.String),
});

export const UnresolvedReExportWarningSchema = Schema.Struct({
  ...WarningLocationSchema.fields,
  code: Schema.Literal("unresolved-re-export"),
  reason: Schema.Literals(["missing-target", "cycle", "ambiguous"] as const),
  name: Schema.String,
});

export const UncertainComponentRecognitionWarningSchema = Schema.Struct({
  ...WarningLocationSchema.fields,
  code: Schema.Literal("uncertain-component-recognition"),
  reason: Schema.Literals(["mixed-component-union"] as const),
  name: Schema.String,
});

export const ExtractWarningSchema = Schema.Union([
  UnsupportedTypeFallbackWarningSchema,
  MissingEnumDeclarationWarningSchema,
  MissingDefaultExportSymbolWarningSchema,
  OmittedIndexSignatureWarningSchema,
  UnrepresentedConstructSignaturesWarningSchema,
  OmittedCallableMembersWarningSchema,
  UnresolvedReExportWarningSchema,
  UncertainComponentRecognitionWarningSchema,
]);
