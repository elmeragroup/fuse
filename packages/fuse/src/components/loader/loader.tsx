import type { HTMLAttributes, ReactElement } from "react";

import type { VariantProps } from "tailwind-variants";

import { SpinnerGap } from "../../icons/generated/spinner-gap";
import { cn } from "../../styles/cn";
import { loaderVariants } from "./loader-variants";

export type LoaderProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof loaderVariants>;

/**
 * Server spinner: a polite `role="status"` wrapper around a decorative spinning
 * `SpinnerGap`. Consumers pass a translated `aria-label`, since there is no built-in
 * English name. It owns no state, handlers or browser APIs.
 */
export function Loader({ className, variant, size, ...props }: LoaderProps): ReactElement {
  const { base, icon } = loaderVariants({ variant, size });

  return (
    <div data-slot="loader" role="status" className={cn(base(), className)} {...props}>
      <SpinnerGap aria-hidden="true" className={icon()} />
    </div>
  );
}

Loader.displayName = "Loader";
