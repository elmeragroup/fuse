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
  const resolvingText =
    warning.sourceText !== undefined && warning.sourceText !== warning.typeText
      ? ` while resolving "${warning.sourceText}"`
      : "";
  return {
    ...warning,
    message: `Type extraction warning: Unable to handle type "${warning.typeText}" with flag "${warning.typeFlags.join(" | ")}"${resolvingText} at "${warning.filePath}:${warning.line}:${warning.column}". Using any instead.`,
  };
}

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
