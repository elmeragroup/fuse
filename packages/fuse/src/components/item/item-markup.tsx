import type { ComponentProps, ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { ITEM_DESCRIPTION_CLASSES } from "./item-description-classes";
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

const itemMediaVariants = tv({
  base: "flex shrink-0 items-center justify-center gap-2 group-has-data-[slot=item-description]/item:translate-y-0.5 group-has-data-[slot=item-description]/item:self-start [&_svg]:pointer-events-none",
  variants: {
    variant: {
      default: "bg-transparent",
      icon: "[&_svg:not([class*='size-'])]:size-4",
      image:
        "outline-black/10 size-10 overflow-hidden rounded-sm outline outline-1 -outline-offset-1 group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_img]:size-full [&_img]:object-cover",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

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
  return (
    <div
      data-slot="item-content"
      className={cn(
        "flex flex-1 flex-col gap-1 group-data-[size=xs]/item:gap-0 [&+[data-slot=item-content]]:flex-none",
        className
      )}
      {...props}
    />
  );
}

export function ItemTitle({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="item-title" className={cn(ITEM_TITLE_CLASSES, className)} {...props} />;
}

export function ItemDescription({ className, ...props }: ComponentProps<"p">): ReactElement {
  return (
    <p
      data-slot="item-description"
      className={cn(ITEM_DESCRIPTION_CLASSES, "line-clamp-2", className)}
      {...props}
    />
  );
}

export function ItemActions({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="item-actions" className={cn("flex items-center gap-2", className)} {...props} />;
}

export function ItemHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      data-slot="item-header"
      className={cn("flex basis-full items-center justify-between gap-2", className)}
      {...props}
    />
  );
}

const itemFooterVariants = tv({
  base: "grid",
  variants: {
    mode: {
      default: "grid-rows-[minmax(0,1fr)] pt-3 opacity-100",
      visible: [
        "translate-y-0 grid-rows-[minmax(0,1fr)] pt-3 opacity-100",
        "ease-out transition-[opacity,transform] duration-150",
        "starting:-translate-y-1.5 starting:opacity-0",
      ],
      // The collapsed row is 0px but its content keeps its height, so `overflow-clip` keeps it
      // out of the page and any scroll container. The row size does not transition, so the
      // clip only ever applies to a collapsed footer and a visible one never clips a focus ring.
      // Hiding collapses and clips in one frame, so this arm has no transition of its own: it is
      // the reveal's start state.
      hidden: "pointer-events-none -translate-y-1.5 grid-rows-[minmax(0,0fr)] overflow-clip pt-0 opacity-0",
    },
  },
  defaultVariants: {
    mode: "default",
  },
});

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
     * collapses its grid row to zero, clips it and makes it inert. The row snaps both ways;
     * a footer switched to `visible` fades and slides its content in.
     */
    children?: ReactNode;
  }): ReactElement {
  return (
    <div
      data-slot="item-footer"
      data-mode={mode}
      className={cn(itemFooterVariants({ mode }), className)}
      {...props}
      inert={mode === "hidden" || Boolean(inert)}>
      <div data-slot="item-footer-content" className="flex min-h-0 flex-col gap-3">
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
