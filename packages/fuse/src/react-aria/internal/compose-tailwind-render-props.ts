import { composeRenderProps } from "react-aria-components";

import { cn } from "../../styles/cn";

/**
 * RAC's `className` accepts a string or a render-prop function. This resolves either
 * shape and merges the recipe classes underneath the caller's, so a consumer class
 * always wins the Tailwind conflict. Package-private.
 *
 * It stays separate from `mergeClassName` because it always returns a callback, even for
 * a string or omitted `className`. RAC's `useContextProps` merges context props in with
 * `mergeProps`, where two strings concatenate but a callback replaces the context's
 * `className`, so the callback keeps context-supplied classes off Fuse parts.
 */
export function composeTailwindRenderProps<T>(
  className: string | ((renderProps: T) => string) | undefined,
  twClasses: string
): string | ((renderProps: T) => string) {
  return composeRenderProps(className, (resolved: string | undefined) => cn(twClasses, resolved));
}
