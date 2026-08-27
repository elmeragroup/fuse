import type { BackendModuleOrigin, BackendSymbolFacts, BackendSymbolIdentity } from "../backend/contracts.ts";

/** The small set of React declarations whose public identity affects parsing. */
const reactWrapperNames = new Set([
  "MemoExoticComponent",
  "NamedExoticComponent",
  "FC",
  "FunctionComponent",
  "ForwardRefExoticComponent",
]);

const reactWrapperCallNames = new Set(["memo", "forwardRef"]);

/** The backend supplies neutral identity and origin; React policy lives here. */
export type ParserSymbolOrigin = {
  readonly identity?: BackendSymbolIdentity;
  readonly moduleOrigin?: BackendModuleOrigin;
};

/**
 * Recognizes a React API only when both its canonical symbol identity and its
 * package origin agree. A dependency that merely exports `FC` or `memo` is
 * intentionally not React: names alone are not a framework contract.
 */
export function isReactApiSymbol(
  facts: ParserSymbolOrigin | undefined,
  names: ReadonlySet<string> | string
): boolean {
  if (facts === undefined) return false;
  const identity = facts.identity;
  const origin = facts.moduleOrigin;
  const expected = names instanceof Set ? undefined : names;
  return (
    identity?.namespaces.length === 1 &&
    identity.namespaces[0] === "React" &&
    (expected === undefined ? reactWrapperNames.has(identity.name) : identity.name === expected) &&
    origin?.moduleSpecifier === "react" &&
    origin.packageName === "react" &&
    origin.external
  );
}

/** React's `memo` and `forwardRef` are the only supported wrapper calls. */
export function isReactWrapperCall(facts: ParserSymbolOrigin | undefined): boolean {
  if (facts?.identity === undefined) return false;
  return reactWrapperCallNames.has(facts.identity.name) && isReactApiSymbol(facts, facts.identity.name);
}

/** Applies the same identity/origin policy to a normalized backend symbol. */
export function isReactWrapperType(symbol: BackendSymbolFacts): boolean {
  return isReactApiSymbol(symbol, reactWrapperNames);
}
