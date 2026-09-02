import type {
  BackendCompilerOperations,
  BackendNodeReference,
  BackendSymbolHandle,
  BackendTypeHandle,
  BackendWarningFact,
} from "../backend/contracts.ts";
import type { SemanticType } from "../model.ts";
import type { ExtractorOptions } from "../options.ts";
import type { ProvenanceEntry } from "../provenance.ts";
import type { ExternalTypeSelection } from "./external-type-selection.ts";

/** Resolver state shared by the synchronous semantic resolver modules. */
export type ResolverContext = {
  readonly operations: BackendCompilerOperations;
  readonly filePath: string;
  readonly warnings: BackendWarningFact[];
  readonly provenance: ProvenanceEntry[];
  /** Structural path in the final semantic model; never use diagnostics here. */
  readonly provenancePath: readonly string[];
  /** Selects the final collection shape for properties at the current node. */
  readonly provenancePropertyContainer: "object" | "componentProps";
  readonly symbolStack: readonly string[];
  readonly options: Pick<ExtractorOptions, "shouldInclude" | "shouldResolveObject">;
  readonly externalTypes: ExternalTypeSelection;
  readonly substitutions: ReadonlyMap<BackendSymbolHandle, BackendTypeHandle>;
  readonly active: ReadonlySet<BackendTypeHandle>;
  readonly propertyDepth: number;
  /** True only while resolving the root of a pure type-only export. */
  readonly pureTypeExport: boolean;
  /** True for anonymous members of an authored intersection shape. */
  readonly authoredIntersectionMember: boolean;
  /** Defaults authored in an object-binding parameter, keyed by public property name. */
  readonly bindingDefaults?: ReadonlyMap<string, string>;
  /** Namespaces inherited only while descending into checker-generated type arguments. */
  readonly generatedTypeArgumentNamespaces?: readonly string[];
};

/**
 * The location fields every resolver warning carries: the declaration's own
 * position when one is known, otherwise the module being extracted, plus the
 * resolver's symbol breadcrumb rooted at that module.
 */
export function warningLocation(
  context: ResolverContext,
  declaration: BackendNodeReference | undefined
): Pick<BackendWarningFact, "filePath" | "line" | "column" | "parsedSymbolStack"> {
  const location = declaration === undefined ? undefined : context.operations.nodeFacts(declaration);
  return {
    filePath: location?.filePath ?? context.filePath,
    line: location?.line ?? 1,
    column: location?.column ?? 1,
    parsedSymbolStack: [context.filePath, ...context.symbolStack],
  };
}

export type ResolveSemanticType = (
  type: BackendTypeHandle | undefined,
  sourceNode: BackendNodeReference | undefined,
  symbol: BackendSymbolHandle | undefined,
  context: ResolverContext
) => SemanticType;

/**
 * Whether a name is one of TypeScript's internal `__`-prefixed symbol names,
 * which never describe a public API name.
 *
 * Policy owner for the compiler-free resolver modules (`resolver.ts`,
 * `object-resolver.ts`). Deliberately NOT the backend fact reader's closed
 * allowlist (`internalSymbolNames` in `backend/ts7/facts.ts`, which also
 * admits "VoidOrUndefinedOnly" — no `__` prefix): unifying either direction
 * would change which names are refused, so the layers stay apart on purpose.
 */
export function isInternalSymbolName(name: string): boolean {
  return name.startsWith("__");
}
