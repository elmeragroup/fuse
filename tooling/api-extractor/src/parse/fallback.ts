import type {
  BackendNodeReference,
  BackendSymbolHandle,
  BackendTypeFacts,
  BackendTypeHandle,
  BackendWarningFact,
} from "../backend/contracts.ts";
import type { SemanticType } from "../model.ts";
import type { ExtractWarning, TypeFlagName } from "../warnings.ts";
import type { ResolverContext } from "./contracts.ts";

type FallbackWarning = {
  code: "unsupported-type-fallback";
  filePath: string;
  line: number;
  column: number;
  parsedSymbolStack: string[];
  typeFlags: readonly TypeFlagName[];
  typeText: string;
  sourceText?: string;
};

export function warningMessage(warning: BackendWarningFact): ExtractWarning {
  if (warning.code === "missing-enum-declaration") {
    return {
      ...warning,
      message: `Type extraction warning: Unable to resolve enum declaration "${warning.enumName}"${warning.memberName === undefined ? "" : ` member "${warning.memberName}"`} at "${warning.filePath}:${warning.line}:${warning.column}". The unavailable enum member or declaration was omitted.`,
    };
  }
  if (warning.code === "missing-default-export-symbol") {
    return {
      ...warning,
      message: `Type extraction warning: Could not find the symbol of default export "${warning.sourceText}" at "${warning.filePath}:${warning.line}:${warning.column}". Skipping this export.`,
    };
  }
  if (warning.code === "unresolved-re-export") {
    const reasonText =
      warning.reason === "cycle"
        ? "following the re-export chain returned to its starting namespace"
        : warning.reason === "ambiguous"
          ? "more than one starred module exports the same name and TypeScript excludes ambiguous star re-exports"
          : "the re-export target could not be resolved";
    return {
      ...warning,
      message: `Type extraction warning: Could not include re-export "${warning.name}" at "${warning.filePath}:${warning.line}:${warning.column}" because ${reasonText}. Skipping this export.`,
    };
  }
  if (warning.code === "omitted-index-signature") {
    return {
      ...warning,
      message:
        warning.reason === "additional-signature"
          ? `Type extraction warning: Unable to represent more than one index signature at "${warning.filePath}:${warning.line}:${warning.column}". The index signature with key type "${warning.keyTypes.join(" | ")}" was omitted.`
          : `Type extraction warning: Unable to represent index signature key type "${warning.keyTypes.join(" | ")}" at "${warning.filePath}:${warning.line}:${warning.column}". The index signature was omitted.`,
    };
  }
  if (warning.code === "unrepresented-construct-signatures") {
    return {
      ...warning,
      message: `Type extraction warning: Unable to represent ${warning.signatureCount} construct signature${warning.signatureCount === 1 ? "" : "s"} at "${warning.filePath}:${warning.line}:${warning.column}". The construct signatures at ${warning.structuralPath.join("/")} were omitted because the shape is not a class.`,
    };
  }
  if (warning.code === "omitted-callable-members") {
    return {
      ...warning,
      message: `Type extraction warning: Unable to represent named members alongside the call signature at "${warning.filePath}:${warning.line}:${warning.column}". The members ${warning.memberNames.map((name) => `"${name}"`).join(", ")} of ${warning.structuralPath.join("/")} were omitted.`,
    };
  }
  if (warning.code === "uncertain-component-recognition") {
    return {
      ...warning,
      message: `Type extraction warning: Could not confirm that "${warning.name}" is a React component at "${warning.filePath}:${warning.line}:${warning.column}". Some arms of its union type do not return React node types, so the export kept its resolved type instead of becoming a component.`,
    };
  }
  const resolvingText =
    warning.sourceText !== undefined && warning.sourceText !== warning.typeText
      ? ` while resolving "${warning.sourceText}"`
      : "";
  return {
    ...warning,
    message: `Type extraction warning: Unable to handle type "${warning.typeText}" with flag "${warning.typeFlags.join(" | ")}"${resolvingText} at "${warning.filePath}:${warning.line}:${warning.column}". Using any instead.`,
  };
}

/**
 * Degrades a type the resolver cannot represent to `any`, pushing the
 * structured `unsupported-type-fallback` warning.
 *
 * Location anchoring prefers the AUTHORED node under resolution and falls
 * back to the symbol's first declaration — the same precedence
 * `recordMissingEnumWarning` applies. When an authored node is available,
 * its source text is recorded on the warning as `sourceText`; structured
 * assertions key on it and the rendered message gains its
 * `while resolving "…"` clause. The field stays optional because callers
 * without any node anchor none.
 */
export function unsupported(
  context: ResolverContext,
  type: BackendTypeHandle | undefined,
  symbol: BackendSymbolHandle | undefined,
  sourceNode: BackendNodeReference | undefined
): SemanticType {
  const facts: BackendTypeFacts | undefined =
    type === undefined ? undefined : context.operations.typeFacts(type);
  const symbolInfo = symbol === undefined ? undefined : context.operations.symbolFacts(symbol);
  const locationNode = sourceNode ?? symbolInfo?.declarations[0];
  const location = locationNode === undefined ? undefined : context.operations.nodeFacts(locationNode);
  const filePath = location?.filePath ?? context.filePath;
  const fallbackFlags: readonly TypeFlagName[] = ["Other"];
  const warning: FallbackWarning = {
    code: "unsupported-type-fallback" as const,
    filePath,
    line: location?.line ?? 1,
    column: location?.column ?? 1,
    parsedSymbolStack: [context.filePath, ...context.symbolStack],
    typeFlags: facts?.flags ?? fallbackFlags,
    typeText: facts?.typeText ?? "<missing type>",
  };
  if (sourceNode !== undefined && location?.text !== undefined) warning.sourceText = location.text;
  context.warnings.push(warning);
  return { kind: "intrinsic", intrinsic: "any" };
}
