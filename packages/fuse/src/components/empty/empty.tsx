import type { ComponentProps, ReactElement } from "react";

import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { emptyMediaVariants, emptyVariants } from "./empty-variants";

type EmptyRootProps = ComponentProps<"div"> & VariantProps<typeof emptyVariants>;
type EmptyMediaProps = ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>;

const styles = emptyVariants();

/**
 * Centered empty-state layout. Server component — it owns no state,
 * no handlers, and no browser APIs.
 *
 * It publishes `--inner-corner`, its corner less its border and padding, for parts that round with
 * `rounded-inner`.
 */
function EmptyRoot({ className, variant = "default", ...props }: EmptyRootProps): ReactElement {
  return <div data-slot="empty" className={cn(emptyVariants({ variant }).root(), className)} {...props} />;
}

function EmptyHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="empty-header" className={cn(styles.header(), className)} {...props} />;
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
  return <div data-slot="empty-title" className={cn(styles.title(), className)} {...props} />;
}

function EmptyDescription({ className, ...props }: ComponentProps<"p">): ReactElement {
  return <p data-slot="empty-description" className={cn(styles.description(), className)} {...props} />;
}

function EmptyContent({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="empty-content" className={cn(styles.content(), className)} {...props} />;
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
