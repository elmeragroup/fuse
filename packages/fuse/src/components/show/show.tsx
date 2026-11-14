import type { ReactElement, ReactNode } from "react";

/** `Show` takes the condition and the children it renders. */
export type ShowProps = {
  /**
   * The render condition, a strict boolean. Coerce it yourself, as in `items.length > 0`.
   */
  when: boolean;
  /**
   * Rendered when `when` is true. The parent evaluates this JSX before `Show` decides, and only
   * rendering is skipped, so an expression that throws when the condition is false, such as
   * `data!.name`, still throws here. Use an inline ternary or optional chaining for it instead.
   */
  children?: ReactNode;
};

/**
 * A render helper with no DOM of its own. It returns its children in a fragment when `when` is
 * true, otherwise `null`.
 *
 * @param props - The condition and the children.
 * @returns The children, or `null`.
 */
export function Show({ children, when }: ShowProps): ReactElement | null {
  return when ? <>{children}</> : null;
}

Show.displayName = "Show";
