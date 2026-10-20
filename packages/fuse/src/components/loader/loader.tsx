import type { HTMLAttributes, ReactElement } from "react";

import type { VariantProps } from "tailwind-variants";

import { SpinnerGap } from "../../icons/generated/spinner-gap";
import { cn } from "../../styles/cn";
import { LoaderDefaultLabel } from "./loader-default-label";
import { loaderVariants } from "./loader-variants";

export type LoaderProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof loaderVariants> & {
    /**
     * The text the status region announces, rendered visually hidden inside it. Defaults to the
     * `aria-label`, then to the locale dictionary's "Loading".
     */
    label?: string;
  };

/**
 * Server spinner: a polite `role="status"` region around a decorative spinning `SpinnerGap` and
 * visually hidden text. A live region announces changes to its text, so the text is `label`,
 * then the `aria-label`, then the locale dictionary's "Loading". Mount the Loader where it stays
 * mounted while loading runs, or render it inside a region that already is, so the text arrives
 * as a change. It owns no state, handlers or browser APIs; only the dictionary default renders
 * through a small client child.
 */
export function Loader({ className, variant, size, label, ...props }: LoaderProps): ReactElement {
  const { base, icon } = loaderVariants({ variant, size });
  const text = label ?? props["aria-label"];

  return (
    <div data-slot="loader" role="status" className={cn(base(), className)} {...props}>
      <SpinnerGap aria-hidden="true" className={icon()} />
      {text === undefined ? <LoaderDefaultLabel /> : <span className="sr-only">{text}</span>}
    </div>
  );
}

Loader.displayName = "Loader";
