import type { ComponentProps, ReactElement } from "react";

import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { emptyMediaVariants, emptyVariants } from "./empty-variants";

type EmptyRootProps = ComponentProps<"div"> & VariantProps<typeof emptyVariants>;
type EmptyMediaProps = ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>;

/**
 * Centered empty-state layout. Server component — it owns no state,
 * no handlers, and no browser APIs (performance.md §RSC classification).
 */
function EmptyRoot({ className, variant = "default", ...props }: EmptyRootProps): ReactElement {
  return <div data-slot="empty" className={cn(emptyVariants({ variant }), className)} {...props} />;
}

function EmptyHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      data-slot="empty-header"
      className={cn("max-w-sm flex flex-col items-center gap-2 text-center", className)}
      {...props}
    />
  );
}

function EmptyMedia({ className, variant = "default", ...props }: EmptyMediaProps): ReactElement {
  return (
    <div
      data-slot="empty-media"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant }), className)}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div data-slot="empty-title" className={cn("text-lg font-medium tracking-tight", className)} {...props} />
  );
}

function EmptyDescription({ className, ...props }: ComponentProps<"p">): ReactElement {
  return (
    <p
      data-slot="empty-description"
      className={cn(
        "text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "max-w-sm text-sm flex w-full min-w-0 flex-col items-center gap-4 text-balance",
        className
      )}
      {...props}
    />
  );
}

EmptyRoot.displayName = "Empty.Root";
EmptyHeader.displayName = "Empty.Header";
EmptyMedia.displayName = "Empty.Media";
EmptyTitle.displayName = "Empty.Title";
EmptyDescription.displayName = "Empty.Description";
EmptyContent.displayName = "Empty.Content";

export const Empty = {
  Root: EmptyRoot,
  Header: EmptyHeader,
  Media: EmptyMedia,
  Title: EmptyTitle,
  Description: EmptyDescription,
  Content: EmptyContent,
};
