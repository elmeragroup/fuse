import type { ComponentProps, ReactElement, ReactNode } from "react";

import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { tv } from "../../styles/tv";
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

// Beside a description the media and Item.Content both align to the row's top, so media taller than
// the content shares its top edge, and `--item-media-line` becomes one Item.Title line, `text-sm` at
// `leading-snug` as ITEM_TITLE_CLASSES sets it. Icon media is exactly that tall and centres its
// glyph, so a glyph of any size centres on the title's first line. Default and image media keep
// their content's own height and so top-align with the content. Elsewhere the property is `auto`
// and the row centres the media. A plain utility reads the property, so tailwind-merge drops it for
// a consumer's own height or size, and that size wins. A minimum of one line on default media would
// override a smaller consumer height, which CSS cannot tell apart without the class attribute.
const itemMediaVariants = tv({
  base: "flex shrink-0 items-center justify-center gap-2 [--item-media-line:auto] group-has-data-[slot=item-description]/item:self-start group-has-data-[slot=item-description]/item:[--item-media-line:calc(var(--text-sm)*var(--leading-snug))] group-has-data-[slot=selection-item-description]/item:self-start group-has-data-[slot=selection-item-description]/item:[--item-media-line:calc(var(--text-sm)*var(--leading-snug))] [&_svg]:pointer-events-none",
  variants: {
    variant: {
      default: "bg-transparent",
      icon: "h-(--item-media-line) [&_svg:not([class*='size-'])]:size-4",
      // An image is taller than a title line, so beside a description it tops flush with the
      // content.
      image:
        "outline-black/10 size-10 overflow-hidden rounded-sm outline outline-1 -outline-offset-1 group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_img]:size-full [&_img]:object-cover",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

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
  return (
    <div
      data-slot="item-content"
      className={cn(
        "flex flex-1 flex-col gap-1 group-has-data-[slot=item-description]/item:self-start group-has-data-[slot=selection-item-description]/item:self-start group-data-[size=xs]/item:gap-0 [&+[data-slot=item-content]]:flex-none",
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

// The two switchable modes share one 150 ms ease-out transition of the row size, the top
// padding, the fade and the slide, the duration and curve of `panelHeightTransition`, so a
// reveal expands and fades in and a hide collapses and fades out. `minmax(0,0fr)` to
// `minmax(0,1fr)` interpolates without measuring, so the footer stays a server part, and a
// mode change mid-tween reverses from the current value. `@starting-style` covers only the fade
// and the slide, so a footer that renders visible does not grow on first paint. The central
// reduced-motion rule keeps only the fade.
const itemFooterMotionClass = cn(
  "ease-out transition-[grid-template-rows,padding-top,opacity,translate] duration-150"
);

// The content overflows its row while the row is shorter than it, so the content element clips
// in both switchable modes. It is the footer's grid item, and a stretched grid item's margin box
// fills its cell, so `-m-1 p-1` grows its clip edge, the padding box, 0.25rem past the cell on
// every side while its content box stays the cell, and the footer's own box is unchanged. That
// room is 4px at the default 16px root. The shared focus ring, a flush 2px ring, paints whole on
// content at any edge. The focused invalid face reaches 4px, so it paints whole at the default
// root, and a smaller root clips a fraction of its halo.
const itemFooterClipClass = cn("-m-1 overflow-clip p-1");

const itemFooterVariants = tv({
  slots: {
    root: "grid",
    content: "flex min-h-0 flex-col gap-3",
  },
  variants: {
    mode: {
      default: { root: "grid-rows-[minmax(0,1fr)] pt-3 opacity-100" },
      visible: {
        root: cn(
          "translate-y-0 grid-rows-[minmax(0,1fr)] pt-3 opacity-100",
          itemFooterMotionClass,
          "starting:-translate-y-1.5 starting:opacity-0"
        ),
        content: itemFooterClipClass,
      },
      // The collapsed row is 0px but its content keeps its height, so the clip keeps it out of
      // the page and any scroll container.
      hidden: {
        root: cn(
          "pointer-events-none -translate-y-1.5 grid-rows-[minmax(0,0fr)] pt-0 opacity-0",
          itemFooterMotionClass
        ),
        content: itemFooterClipClass,
      },
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
