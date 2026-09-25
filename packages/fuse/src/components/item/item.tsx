"use client";

import { createContext, useContext } from "react";
import type { ComponentProps, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { Separator } from "../separator/separator";
import { itemVariants } from "./item-variants";

const ItemGroupContext = createContext(false);

export function ItemGroup({ className, ...props }: ComponentProps<"div">): ReactElement {
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

export function ItemSeparator({ className, ...props }: ComponentProps<typeof Separator>): ReactElement {
  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      className={mergeClassName(className, "my-2")}
      {...props}
    />
  );
}

export function ItemRoot({
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

ItemRoot.displayName = "Item.Root";
ItemGroup.displayName = "Item.Group";
ItemSeparator.displayName = "Item.Separator";
