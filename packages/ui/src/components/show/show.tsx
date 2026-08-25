import type { ReactElement, ReactNode } from "react";

export type ShowProps = {
  /**
   * Render condition. Strict boolean — callers coerce (for example `items.length > 0`);
   * the helper does not.
   */
  when: boolean;
  /**
   * Rendered inside a fragment when `when` is true. `children` is an ordinary prop: the
   * JSX is evaluated by the parent before `Show` decides anything; only rendering is
   * skipped. Guarding expressions that throw when the condition is false (`data!.name`)
   * is not safe here — use an inline ternary or optional chaining.
   */
  children?: ReactNode;
};

/**
 * Server render helper with no DOM of its own (show.md §2/§7). Returns children in a
 * fragment when `when` is true, otherwise `null`.
 */
export function Show({ children, when }: ShowProps): ReactElement | null {
  return when ? <>{children}</> : null;
}

Show.displayName = "Show";
