import type { HTMLAttributes, ReactElement } from "react";

import type { VariantProps } from "tailwind-variants";

import { SpinnerGap } from "../../icons/generated/spinner-gap";
import { cn } from "../../styles/cn";
import { LoaderDefaultLabel } from "./loader-default-label";
import { loaderVariants } from "./loader-variants";

/** `Loader` takes a native `div`'s props, the recipe's axes and the announced `label`. */
export type LoaderProps = HTMLAttributes<HTMLDivElement> & {
  /** The colour. `default` is the only value. */
  variant?: VariantProps<typeof loaderVariants>["variant"];
  /** The spinner's size. The padding around it stays the same. */
  size?: VariantProps<typeof loaderVariants>["size"];
  /**
   * The text the Loader's polite status region announces, visually hidden. Without it, the region
   * reads the `aria-label`, then "Loading" in the reader's locale. A live region announces only a
   * change to its text, so keep the Loader mounted while loading runs, or render it inside a live
   * region that is already mounted.
   */
  label?: string;
};

/** A spinner in a polite status region, for a pending state. */
export function Loader({
  className,
  // Restates the recipe's defaults so the API extractor records them, until it reads recipe
  // defaults itself (elmeragroup/internal#39).
  variant = "default",
  size = "default",
  label,
  ...props
}: LoaderProps): ReactElement {
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
