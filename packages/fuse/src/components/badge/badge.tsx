import type { HTMLAttributes, ReactElement } from "react";

import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { badgeVariants } from "./badge-variants";

export type BadgeProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

/**
 * Non-interactive status pill. Server component — it owns no state,
 * no handlers, and no browser APIs.
 */
export function Badge({ className, variant, size, ...props }: BadgeProps): ReactElement {
  return <div data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

Badge.displayName = "Badge";
