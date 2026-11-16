import type { ReactNode } from "react";

/**
 * Narrows a consumer-supplied `ReactNode` to the plain string case.
 *
 * Several components take a `ReactNode` that renders intact but gets extra treatment when it is
 * text, such as Checkbox's `describedBy` note and ConfirmButton's announcement chain. This is the
 * one place that asks the question of a `ReactNode`, replacing the local spellings as each
 * component migrates.
 *
 * It does not cover every "is this a string" check in the package. Toast's manager adapter narrows
 * `string | ToastManagerUpdateOptions`, and an options object is not a `ReactNode`, so
 * `isShorthandDescription` in `toast.tsx` cannot call this and keeps its own `typeof` with a named
 * disable. The same goes for the `promise()` factory arm, which no shared guard narrows. Those two
 * were the `Object.prototype.toString` spellings that evaded the lint rule. They are plain
 * `typeof` checks now, not callers of this helper.
 */
export function isTextNode(node: ReactNode): node is string {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned ReactNode I/O: the string arm is a documented public contract, not an internal type guess
  return typeof node === "string";
}

/**
 * Narrows a consumer-supplied `ReactNode` to the values that render as their own text: a string or
 * a number.
 *
 * This is a different question from {@link isTextNode}, so it is a second helper on purpose.
 * `isTextNode` answers "is this the documented string arm of a `string | ReactNode` prop", where
 * the number case is not part of the contract. This one answers "can I read this node's label
 * without rendering it". Combobox's chip label, `isChipText`, is the caller that needs the wider
 * narrowing. Widening `isTextNode` instead would pull numbers into Checkbox's `describedBy` and
 * ConfirmButton's announcement chain, a behavior change their specs do not ask for.
 */
export function isTextValueNode(node: ReactNode): node is string | number {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned ReactNode I/O: "renders as its own text" is a documented public contract, not an internal type guess
  return typeof node === "string" || typeof node === "number";
}
