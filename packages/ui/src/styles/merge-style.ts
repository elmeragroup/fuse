import type { CSSProperties } from "react";

/** Preserve Base UI's state-callback `style` while merging the library's custom properties underneath it. */
export function mergeStyle<State>(
  vars: CSSProperties,
  style: CSSProperties | ((state: State) => CSSProperties | undefined) | undefined
): CSSProperties | ((state: State) => CSSProperties) {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Base UI's public style contract explicitly accepts objects or state callbacks.
  if (typeof style === "function") {
    return (state) => ({ ...vars, ...style(state) });
  }
  return { ...vars, ...style };
}
