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

/**
 * The row's leading media. `icon` sizes a bare glyph to 16px, and `image` frames a picture in a
 * rounded square. Beside a description, `default` and `image` media top-align with the content,
 * and `icon` media centres its glyph on the title's first line. A height or size class sets the
 * box of `default` and `icon` media. `image` media takes its size from the row's size, so resizing
 * it takes a size class under the matching row-size group variant.
 */
export function ItemMedia({
  className,
  variant = "default",
  ...props
}: ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>): ReactElement {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn(itemMediaVariants({ variant }), className)}
      {...props}
    />
  );
}

export function ItemContent({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="item-content" className={cn(itemContentClass, className)} {...props} />;
}

export function ItemTitle({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="item-title" className={cn(ITEM_TITLE_CLASSES, className)} {...props} />;
}

export function ItemDescription({ className, ...props }: ComponentProps<"p">): ReactElement {
  return <p data-slot="item-description" className={cn(itemDescriptionClass, className)} {...props} />;
}

export function ItemActions({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="item-actions" className={cn(itemActionsClass, className)} {...props} />;
}

export function ItemHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="item-header" className={cn(itemHeaderClass, className)} {...props} />;
}

export function ItemFooter({
  children,
  className,
  mode = "default",
  inert,
  ...props
}: ComponentProps<"div"> &
  VariantProps<typeof itemFooterVariants> & {
    /**
     * Footer content, wrapped in the inner `item-footer-content` element. `mode="hidden"`
     * collapses its grid row to zero, clips it and makes it inert. Switching between `hidden`
     * and `visible` animates the row's height with a fade and a short slide, so content below
     * the footer moves smoothly instead of jumping. Both modes clip content that reaches more
     * than 0.25rem (4px at the default 16px root) past the footer's content box. That ring room
     * is part of the content element's box, so a zero-inset item flush against a scroll
     * container's edge should keep 0.25rem of inset there or the room scrolls. A `default`
     * footer never clips, and switching to it snaps.
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
