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

export type ExtractWarning =
  | UnsupportedTypeFallbackWarning
  | MissingEnumDeclarationWarning
  | MissingDefaultExportSymbolWarning;

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

export const ExtractWarningSchema = Schema.Union([
  UnsupportedTypeFallbackWarningSchema,
  MissingEnumDeclarationWarningSchema,
  MissingDefaultExportSymbolWarningSchema,
]);
