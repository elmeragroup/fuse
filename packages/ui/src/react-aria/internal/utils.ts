import { composeRenderProps } from "react-aria-components";
import { twMerge } from "tailwind-merge";

/**
 * RAC's `className` accepts a string or a render-prop function. This resolves either
 * shape and merges the recipe classes underneath the caller's, so a consumer class
 * always wins the Tailwind conflict. Package-private (date-picker.md §2).
 */
export function composeTailwindRenderProps<T>(
  className: string | ((renderProps: T) => string) | undefined,
  twClasses: string
): string | ((renderProps: T) => string) {
  return composeRenderProps(className, (resolved: string | undefined) => twMerge(twClasses, resolved));
}
