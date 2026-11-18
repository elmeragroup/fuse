import type { VariableIndex } from "./css-values";
/**
 * A literal limit beside a length bound to a synced variable, as Tabs list's
 * `min-h-[calc(max(1.5rem,24px)+1px+2*max(var(--spacing),4px))]`, 33px, beside its
 * `h-(--control-h-md)`, 36px dense and 44px comfortable. CSS raises a fixed length to its minimum
 * and lowers it to its maximum (CSS 2.1 §10.4, §10.7), so a minimum no greater than the variable's
 * least value across its modes, and a maximum no less than its greatest, never moves the length in
 * any mode, and drops. The variable's values come from the theme catalog the sync writes, so they
 * hold in every mode a designer can pick. A limit that could bind in some mode stays unmapped.
 */
import type { NumberSpec } from "./kit-spec";

/** A limit beside the length, as `resolveLimits` in `box-sizing.ts` holds it. */
type LiteralBound = { readonly side: "min" | "max"; readonly value: NumberSpec | undefined };

/**
 * Whether every limit beside a length bound to a variable is a literal that never moves it, as the
 * module doc says.
 *
 * @param length - The fixed length.
 * @param bounds - Its limits.
 * @param variables - The synced variables, with the least and greatest value each holds.
 * @returns True where each limit is literal and the variable's range keeps every one from binding.
 */
export function limitsNeverMoveVariable(
  length: NumberSpec,
  bounds: readonly LiteralBound[],
  variables: VariableIndex
): boolean {
  if (length.kind !== "variable" || bounds.length === 0) {
    return false;
  }
  const least = variables.minimum(length.variable);
  const most = variables.maximum(length.variable);
  return bounds.every(({ side, value }) => {
    if (value?.kind !== "literal") {
      return false;
    }
    return side === "min"
      ? least !== undefined && value.value <= least
      : most !== undefined && value.value >= most;
  });
}
