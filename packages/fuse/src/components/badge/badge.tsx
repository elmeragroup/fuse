import type { HTMLAttributes, ReactElement, ReactNode } from "react";

import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { badgeVariants } from "./badge-variants";

/** `Badge` takes a native `span`'s props plus the recipe's `variant` and `size`. */
export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  /**
   * The fill and text colour. The status colours come filled, as `soft-*` on a tinted surface,
   * and as `outline-*` in the border and text. `destructive` draws the theme's error colour.
   */
  variant?: VariantProps<typeof badgeVariants>["variant"];
  /** The text size and padding. */
  size?: VariantProps<typeof badgeVariants>["size"];
  /**
   * The label. Badge is a `<span>` and takes no focus or hover state, so it can sit inside a
   * sentence's `<p>`, such as `Item.Description`.
   */
  children?: ReactNode;
};

/** A non-interactive label for a status, a count or a tag. */
export function Badge({
  className,
  variant = "default",
  size = "default",
  ...props
}: BadgeProps): ReactElement {
  return <span data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

Badge.displayName = "Badge";
