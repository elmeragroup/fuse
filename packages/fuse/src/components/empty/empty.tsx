import type { ComponentProps, ReactElement } from "react";

import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { emptyMediaVariants, emptyVariants } from "./empty-variants";

type EmptyRootProps = ComponentProps<"div"> & {
  /** The frame. `outline` draws a border around the empty state, and `outline-dashed` a dashed one. */
  variant?: VariantProps<typeof emptyVariants>["variant"];
};
type EmptyMediaProps = ComponentProps<"div"> & {
  /**
   * The media's box. `default` is a frameless box for an illustration, and `icon` a muted
   * square that sizes a bare glyph to 24px.
   */
  variant?: VariantProps<typeof emptyMediaVariants>["variant"];
};

const styles = emptyVariants();

/**
 * A centred empty state. It is a server component with no state, handlers or browser APIs.
 *
 * It publishes `--inner-corner`, its corner less its border and padding, for parts that round with
 * `rounded-inner`.
 */
function EmptyRoot({ className, variant = "default", ...props }: EmptyRootProps): ReactElement {
  return <div data-slot="empty" className={cn(emptyVariants({ variant }).root(), className)} {...props} />;
}

/** The media, title and description, centred above the content. */
function EmptyHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="empty-header" className={cn(styles.header(), className)} {...props} />;
}

/** The illustration or icon above the title. */
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

/** The empty state's title. */
function EmptyTitle({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="empty-title" className={cn(styles.title(), className)} {...props} />;
}

/** The empty state's description. A link inside is underlined. */
function EmptyDescription({ className, ...props }: ComponentProps<"p">): ReactElement {
  return <p data-slot="empty-description" className={cn(styles.description(), className)} {...props} />;
}

/** The actions below the header, such as a button that creates the first item. */
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
