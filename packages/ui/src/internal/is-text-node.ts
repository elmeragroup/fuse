import type { ReactNode } from "react";

/**
 * Narrows a consumer-supplied `ReactNode` to the plain string case.
 *
 * Several components take a `ReactNode` that renders intact but gets extra treatment
 * when it is text — Checkbox's `describedBy` note, ConfirmButton's announcement chain,
 * GridList's string children, Toast's shorthand description. This is the one place
 * that asks the question, so there is one justified disable instead of five spellings
 * (two of which evaded the rule through `Object.prototype.toString`).
 */
export function isTextNode(node: ReactNode): node is string {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned ReactNode I/O: the string arm is a documented public contract, not an internal type guess
  return typeof node === "string";
}
