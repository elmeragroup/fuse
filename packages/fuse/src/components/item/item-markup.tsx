import type { ComponentProps, ReactElement, ReactNode } from "react";

import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { itemActionsClass, itemContentClass, itemDescriptionClass, itemHeaderClass } from "./item-class";
import { itemFooterVariants } from "./item-footer-variants";
import { itemMediaVariants } from "./item-media-variants";
import { itemRootProps } from "./item-root-props";
import { ITEM_TITLE_CLASSES } from "./item-title-classes";
import type { itemVariants } from "./item-variants";

/**
 * Out-of-group `Item.Root` element. No hooks and no `render` prop, so Alert can
 * render it from a server component. Public `Item.Root` stays client: it reads
 * group context and forwards `render` through `useRender`. Both take their
 * attributes and classes from `itemRootProps`.
 */
export function ItemRootElement({
  className,
  variant = "default",
  size = "default",
  ...props
}: ComponentProps<"div"> & VariantProps<typeof itemVariants>): ReactElement {
  return <div {...itemRootProps({ variant, size, className })} {...props} />;
}

/** `Item.Media` takes a native `div`'s props and the media `variant`. */
type ItemMediaProps = ComponentProps<"div"> & {
  /**
   * The media's frame. `icon` sizes a bare glyph to 16px, and `image` frames a picture in a
   * rounded square sized by the row's `size`. Beside a description, `default` and `image` media
   * top-align with the content, and `icon` media centres its glyph on the title's first line.
   */
  variant?: VariantProps<typeof itemMediaVariants>["variant"];
  /**
   * Extra classes, merged after the media's own. A height or size class sets the box of `default`
   * and `icon` media. To resize `image` media, add a size class under the matching row size, such
   * as `group-data-[size=sm]/item:size-10`.
   */
  className?: ComponentProps<"div">["className"];
};

/** The row's leading media. */
export function ItemMedia({ className, variant = "default", ...props }: ItemMediaProps): ReactElement {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn(itemMediaVariants({ variant }), className)}
      {...props}
    />
  );
}

/** The column of the title and the description. It takes the row's spare width. */
export function ItemContent({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="item-content" className={cn(itemContentClass, className)} {...props} />;
}

/** The row's title, in the label type. */
export function ItemTitle({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="item-title" className={cn(ITEM_TITLE_CLASSES, className)} {...props} />;
}

/** The row's description, clamped to two lines. */
export function ItemDescription({ className, ...props }: ComponentProps<"p">): ReactElement {
  return <p data-slot="item-description" className={cn(itemDescriptionClass, className)} {...props} />;
}

/** The row's trailing controls, centred on the row. */
export function ItemActions({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="item-actions" className={cn(itemActionsClass, className)} {...props} />;
}

/** A full-width line above the row's media and content. */
export function ItemHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="item-header" className={cn(itemHeaderClass, className)} {...props} />;
}

/** A full-width line below the row's media and content, which can collapse. */
export function ItemFooter({
  children,
  className,
  mode = "default",
  inert,
  ...props
}: ComponentProps<"div"> & {
  /**
   * Whether the footer shows. `hidden` collapses its row to zero height, clips it and makes it
   * inert. Switching between `hidden` and `visible` animates the height with a fade and a short
   * slide, so content below moves instead of jumping. Switching to `default` snaps.
   */
  mode?: VariantProps<typeof itemFooterVariants>["mode"];
  /**
   * The footer's content, wrapped in an inner `item-footer-content` element. A `hidden` or
   * `visible` footer clips content that reaches more than 0.25rem past that element's box.
   * That includes absolutely positioned content with no positioned ancestor inside the footer,
   * which positions against the inner element. Keep 0.25rem of inset
   * on a zero-inset item flush against a scroll container's edge, or that room scrolls. A
   * `default` footer never clips.
   */
  children?: ReactNode;
}): ReactElement {
  const { root, content } = itemFooterVariants({ mode });
  return (
    <div
      data-slot="item-footer"
      data-mode={mode}
      className={cn(root(), className)}
      {...props}
      inert={mode === "hidden" || Boolean(inert)}>
      <div data-slot="item-footer-content" className={content()}>
        {children}
      </div>
    </div>
  );
}

ItemMedia.displayName = "Item.Media";
ItemContent.displayName = "Item.Content";
ItemActions.displayName = "Item.Actions";
ItemTitle.displayName = "Item.Title";
ItemDescription.displayName = "Item.Description";
ItemHeader.displayName = "Item.Header";
ItemFooter.displayName = "Item.Footer";
