import type { TypeFlagName } from "../warnings.ts";

declare const backendHandleBrand: unique symbol;

/**
 * Compiler entities never cross the backend boundary as compiler objects.
 * Handles are created and dereferenced by one extraction session only.
 */
export type BackendHandle<Tag extends string> = {
  readonly [backendHandleBrand]: Tag;
  readonly kind: Tag;
  readonly id: number;
  readonly session: symbol;
};

export type BackendSymbolHandle = BackendHandle<"symbol">;
export type BackendTypeHandle = BackendHandle<"type">;
export type BackendNodeHandle = BackendHandle<"node">;
export type BackendTypeNodeHandle = BackendHandle<"type-node">;
export type BackendSignatureHandle = BackendHandle<"signature">;
export type BackendNodeReference = BackendNodeHandle | BackendTypeNodeHandle;

export type BackendSymbolFlag = "alias" | "typeParameter" | "optional";

/** A normalized compiler observation. It has no semantic model values. */
export type BackendTypeFacts = {
  readonly typeText: string;
  readonly flags: readonly TypeFlagName[];
  readonly intrinsic?: BackendIntrinsicName;
  readonly literal?: string | number | boolean;
  readonly isError?: boolean;
  readonly isTypeParameter?: boolean;
  readonly isUnion?: boolean;
  readonly isIntersection?: boolean;
  readonly isIndex?: boolean;
  readonly isTuple?: boolean;
  readonly isArray?: boolean;
  readonly isObject?: boolean;
  readonly isTypeReference?: boolean;
  readonly isEnum?: boolean;
  readonly symbol?: BackendSymbolHandle;
  readonly aliasSymbol?: BackendSymbolHandle;
  readonly unionOrIntersectionTypes?: readonly BackendTypeHandle[];
  readonly indexTarget?: BackendTypeHandle;
  readonly typeArguments?: readonly BackendTypeHandle[];
  readonly aliasTypeArguments?: readonly BackendTypeHandle[];
};

export type BackendEnumMemberFacts = {
  readonly name: string;
  readonly value: string | number;
  readonly symbol: BackendSymbolHandle;
  readonly declaration?: BackendNodeHandle;
  readonly documentation?: BackendDocumentation;
};

export type BackendEnumFacts = {
  readonly name: string;
  readonly namespaces: readonly string[];
  readonly members: readonly BackendEnumMemberFacts[];
  readonly documentation?: BackendDocumentation;
  /** Recoverable enum members/declarations that could not be normalized. */
  readonly warnings?: readonly BackendWarningFact[];
};

export type BackendSymbolFacts = {
  readonly name: string;
  readonly flags: readonly BackendSymbolFlag[];
  readonly declarationPaths: readonly string[];
  /** Repository-relative declaration paths for durable provenance output. */
  readonly repositoryRelativeDeclarationPaths?: readonly string[];
  readonly declarations: readonly BackendNodeHandle[];
  readonly valueDeclaration?: BackendNodeHandle;
};

export type BackendTypeNameFacts = {
  readonly name: string;
  readonly namespaces: readonly string[];
  readonly authoredArguments?: readonly BackendTypeNodeHandle[];
  readonly authoredSymbol?: BackendSymbolHandle;
};

export type BackendNodeFacts = {
  readonly kind:
    | "unknown"
    | "type"
    | "typeAlias"
    | "interface"
    | "class"
    | "enum"
    | "enumMember"
    | "function"
    | "parameter"
    | "property"
    | "variable"
    | "callExpression"
    | "exportSpecifier"
    | "exportDeclaration"
    | "typeReference"
    | "union"
    | "intersection"
    | "typeOperator"
    | "mapped"
    | "parenthesized"
    | "typeParameter"
    | "functionLike"
    | "indexSignature"
    | "array"
    | "tuple";
  readonly text: string;
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  /** A declaration's authored type node, if it has one. */
  /** A declaration's authored type node. This is deliberately not a generic node handle. */
  readonly type?: BackendTypeNodeHandle;
  readonly children?: readonly BackendNodeReference[];
  readonly typeName?: BackendTypeNameFacts;
  readonly operator?: "keyof";
  readonly optional?: boolean;
  readonly name?: string;
  readonly initializerText?: string;
  readonly initializer?: BackendNodeHandle;
  readonly arguments?: readonly BackendNodeHandle[];
  readonly constraint?: BackendTypeNodeHandle;
  readonly defaultType?: BackendTypeNodeHandle;
  readonly typeParameters?: readonly BackendNodeHandle[];
  readonly parameters?: readonly BackendNodeHandle[];
  readonly returnType?: BackendTypeNodeHandle;
  readonly valueType?: BackendTypeNodeHandle;
  readonly keyName?: string;
  readonly keyType?: "string" | "number";
  readonly mappedOptional?: boolean;
  readonly mappedValueType?: BackendTypeNodeHandle;
  readonly heritageTypes?: readonly BackendNodeReference[];
  readonly declarationFlags?: readonly ("readonly" | "private" | "protected" | "static")[];
  /** Defaults authored on object-binding elements, normalized at the backend seam. */
  readonly bindingDefaults?: readonly BackendBindingDefaultFact[];
};

export type BackendBindingDefaultFact = {
  readonly name: string;
  readonly initializerText: string;
};

export type BackendSignatureFacts = {
  readonly parameters: readonly BackendSymbolHandle[];
  readonly returnType?: BackendTypeHandle;
  readonly typeParameters: readonly BackendTypeHandle[];
  readonly declaration?: BackendNodeHandle;
};

export type BackendIndexSignatureFacts = {
  readonly keyName?: string;
  readonly keyType: "string" | "number";
  readonly valueType: BackendTypeHandle;
  readonly declaration?: BackendNodeHandle;
};

export type BackendExportDraft = {
  readonly name: string;
  readonly symbol: BackendSymbolHandle;
  readonly symbolStack?: readonly string[];
  readonly documentation?: BackendDocumentation;
  readonly declarationSourcePath?: string;
  readonly pureType?: boolean;
  readonly explicitValueReExport?: boolean;
  readonly extendsTypes?: readonly { readonly name: string; readonly resolvedName?: string }[];
};

/** Operations expressed solely in package-owned handles and primitive facts. */
export type BackendCompilerOperations = {
  /** Updates breadcrumbs included in backend failures for this extraction. */
  readonly setErrorContext?: (symbolStack: readonly string[]) => void;
  readonly typeOfSymbol: (symbol: BackendSymbolHandle, declared: boolean) => BackendTypeHandle | undefined;
  readonly typeAtNode: (node: BackendNodeReference) => BackendTypeHandle | undefined;
  readonly typeFacts: (type: BackendTypeHandle) => BackendTypeFacts;
  readonly symbolFacts: (symbol: BackendSymbolHandle) => BackendSymbolFacts;
  readonly documentationOfSymbol?: (symbol: BackendSymbolHandle) => BackendDocumentation | undefined;
  readonly enumFacts?: (type: BackendTypeHandle) => BackendEnumFacts | undefined;
  readonly nodeFacts: (node: BackendNodeReference) => BackendNodeFacts;
  readonly typeNameFacts: (
    type: BackendTypeHandle,
    sourceNode: BackendNodeReference | undefined,
    includeArguments: boolean
  ) => BackendTypeNameFacts | undefined;
  readonly signaturesOfType: (type: BackendTypeHandle) => readonly BackendSignatureHandle[];
  readonly signatureFacts: (signature: BackendSignatureHandle) => BackendSignatureFacts;
  readonly propertiesOfType: (type: BackendTypeHandle) => readonly BackendSymbolHandle[];
  readonly propertyType: (property: BackendSymbolHandle) => BackendTypeHandle | undefined;
  readonly indexSignatureOfType: (type: BackendTypeHandle) => BackendIndexSignatureFacts | undefined;
  readonly baseConstraintOfType: (type: BackendTypeHandle) => BackendTypeHandle | undefined;
  readonly isArrayType: (type: BackendTypeHandle) => boolean;
  readonly isReadonlyType: (type: BackendTypeHandle) => boolean;
  readonly typeToString: (type: BackendTypeHandle) => string;
};

export type BackendWarningFact =
  | {
      readonly code: "unsupported-type-fallback";
      readonly filePath: string;
      readonly line: number;
      readonly column: number;
      readonly parsedSymbolStack: readonly string[];
      readonly typeFlags: readonly TypeFlagName[];
      readonly typeText: string;
      readonly sourceText?: string;
    }
  | {
      readonly code: "missing-enum-declaration";
      readonly filePath: string;
      readonly line: number;
      readonly column: number;
      readonly parsedSymbolStack: readonly string[];
      readonly enumName: string;
      readonly memberName?: string;
    };

export type BackendIntrinsicName =
  | "any"
  | "bigint"
  | "boolean"
  | "never"
  | "null"
  | "number"
  | "string"
  | "symbol"
  | "undefined"
  | "unknown"
  | "void";

export type BackendDocumentation = {
  readonly description?: string;
  readonly defaultValue?: string;
  readonly visibility?: "public" | "private" | "internal";
  readonly tags: readonly { readonly name: string; readonly value?: string }[];
};

export type BackendModuleDraft = {
  readonly name: string;
  readonly exports: readonly BackendExportDraft[];
  readonly imports?: readonly string[];
  readonly typeOnlyStarExports?: readonly string[];
};

export type BackendExtractionSession = {
  /** Validates project membership and module-ness before returning normalized facts. */
  readonly readModule: (filePath: string) => BackendModuleDraft;
  readonly compiler: BackendCompilerOperations;
  /** Uses the TS7 project's configured module-resolution rules. */
  readonly resolveModule: (
    moduleSpecifier: string,
    containingFile: string
  ) => BackendResolvedModule | undefined;
  readonly close: () => void;
};

export type BackendProject = {
  readonly openExtraction: () => BackendExtractionSession;
  readonly getTimingInfo?: () => BackendTiming;
  readonly close: () => void;
};

export type BackendResolvedModule = { readonly filePath: string };

export type BackendTimingRequest = {
  readonly method: string;
  readonly roundTripMs: number;
  readonly bytesSent: number;
  readonly bytesReceived: number;
  readonly serverTimeMs?: number;
  readonly transportOverheadMs?: number;
};

export type BackendTiming = {
  readonly enabled: boolean;
  readonly totals: {
    readonly requestCount: number;
    readonly roundTripMs: number;
    readonly bytesSent: number;
    readonly bytesReceived: number;
    readonly serverTimeMs: number;
    readonly transportOverheadMs: number;
    readonly nodesMaterialized: number;
    readonly sourceFilesFetched: number;
    readonly nodesFetched: number;
  };
  readonly recentRequests: readonly BackendTimingRequest[];
};
