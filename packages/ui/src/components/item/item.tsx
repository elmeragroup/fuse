"use client";

import { createContext, useContext } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { tv } from "tailwind-variants";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { Separator } from "../separator/separator";
import { itemVariants } from "./item-variants";

const ItemGroupContext = createContext(false);

function ItemGroup({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <ItemGroupContext.Provider value={true}>
      <div
        role="list"
        data-slot="item-group"
        className={cn(
          "group/item-group flex w-full flex-col gap-4 has-data-[size=sm]:gap-2.5 has-data-[size=xs]:gap-2",
          className
        )}
        {...props}
      />
    </ItemGroupContext.Provider>
  );
}

function ItemSeparator({ className, ...props }: ComponentProps<typeof Separator>): ReactElement {
  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      className={cn("my-2", className)}
      {...props}
    />
  );
}

function ItemRoot({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof itemVariants>): ReactElement {
  const inGroup = useContext(ItemGroupContext);
  const hostProps: ComponentProps<"div"> = {
    className: cn(itemVariants({ variant, size }), className),
  };
  if (inGroup) {
    hostProps.role = "listitem";
  }
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(hostProps, props),
    render,
    state: {
      slot: "item",
      variant,
      size,
    },
  });
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

function ItemMedia({
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

function ItemContent({ className, ...props }: ComponentProps<"div">): ReactElement {
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

function ItemTitle({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      data-slot="item-title"
      className={cn(
        "text-sm leading-snug font-medium line-clamp-1 flex w-fit items-center gap-2 underline-offset-4",
        className
      )}
      {...props}
    />
  );
}

function ItemDescription({ className, ...props }: ComponentProps<"p">): ReactElement {
  return (
    <p
      data-slot="item-description"
      className={cn(
        "text-sm leading-normal font-normal group-data-[size=xs]/item:text-xs line-clamp-2 text-left text-pretty text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  );
}

function ItemActions({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="item-actions" className={cn("flex items-center gap-2", className)} {...props} />;
}

function ItemHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
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
      hidden: [
        "pointer-events-none -translate-y-1.5 grid-rows-[minmax(0,0fr)] pt-0 opacity-0",
        "ease-out transition-[opacity,transform] duration-150",
      ],
    },
  },
  defaultVariants: {
    mode: "default",
  },
});

function ItemFooter({
  children,
  className,
  mode = "default",
  ...props
}: ComponentProps<"div"> &
  VariantProps<typeof itemFooterVariants> & {
    /**
     * Footer content, wrapped in the inner `item-footer-content` element that `mode`
     * reveals or collapses via the grid-row animation.
     */
    children?: ReactNode;
  }): ReactElement {
  return (
    <div
      data-slot="item-footer"
      data-mode={mode}
      className={cn(itemFooterVariants({ mode }), className)}
      {...props}>
      <div data-slot="item-footer-content" className="flex min-h-0 flex-col gap-3">
        {children}
      </div>
    </div>
  );
}

ItemRoot.displayName = "Item.Root";
ItemMedia.displayName = "Item.Media";
ItemContent.displayName = "Item.Content";
ItemActions.displayName = "Item.Actions";
ItemGroup.displayName = "Item.Group";
ItemSeparator.displayName = "Item.Separator";
ItemTitle.displayName = "Item.Title";
ItemDescription.displayName = "Item.Description";
ItemHeader.displayName = "Item.Header";
ItemFooter.displayName = "Item.Footer";

export const Item = {
  Root: ItemRoot,
  Media: ItemMedia,
  Content: ItemContent,
  Actions: ItemActions,
  Group: ItemGroup,
  Separator: ItemSeparator,
  Title: ItemTitle,
  Description: ItemDescription,
  Header: ItemHeader,
  Footer: ItemFooter,
};
