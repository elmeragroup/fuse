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
  readonly options: Required<Pick<ExtractorOptions, "includeExternalTypes" | "typeOperatorOutput">> &
    Pick<ExtractorOptions, "shouldInclude" | "shouldResolveObject">;
  readonly substitutions: ReadonlyMap<BackendSymbolHandle, BackendTypeHandle>;
  readonly active: ReadonlySet<BackendTypeHandle>;
  readonly propertyDepth: number;
  /** True only while resolving the root of a pure type-only export. */
  readonly pureTypeExport: boolean;
  /** True for anonymous members of an authored intersection shape. */
  readonly authoredIntersectionMember: boolean;
  /** Defaults authored in an object-binding parameter, keyed by public property name. */
  readonly bindingDefaults?: ReadonlyMap<string, string>;
};

export type ResolveSemanticType = (
  type: BackendTypeHandle | undefined,
  sourceNode: BackendNodeReference | undefined,
  symbol: BackendSymbolHandle | undefined,
  context: ResolverContext
) => SemanticType;
