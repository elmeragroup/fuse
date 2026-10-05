"use client";

import { createContext, isValidElement, useContext } from "react";
import type { ComponentProps, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { Separator } from "../separator/separator";
import { itemRootProps } from "./item-root-props";
import type { itemVariants } from "./item-variants";

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

type Visibility = Pick<ComponentProps<"div">, "hidden" | "aria-hidden">;

/**
 * Reads `hidden` and `aria-hidden` from the element `useRender` returned. Its props are the
 * root's props with the render element's merged over them, or whatever a render function
 * chose, so they are the visibility the DOM element ends up with. Those props are always
 * HTML attributes, because the default element is a `div` and Base UI hands a render element
 * or render function `HTMLAttributes`.
 */
function renderedVisibility(element: ReactElement): Visibility {
  const props: Visibility = isValidElement<Visibility>(element) ? element.props : {};
  return definedProps({ hidden: props.hidden, "aria-hidden": props["aria-hidden"] });
}

/**
 * One Item row. Inside `Item.Group` it is a list item: a plain root takes
 * `role="listitem"` itself, while a `render` element (a link or button) keeps its own
 * role inside an `item-listitem` wrapper, like `<li><a/></li>`. The wrapper follows the
 * `hidden` and `aria-hidden` the rendered element ends up with, whether they come from the
 * root or the render element. An explicit `role` replaces both and skips the wrapper.
 */
export function ItemRoot({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof itemVariants>): ReactElement {
  const inGroup = useContext(ItemGroupContext);
  const wrapInListItem = inGroup && render !== undefined && props.role === undefined;
  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      itemRootProps({ variant, size, className }),
      inGroup && render === undefined ? { role: "listitem" } : undefined,
      props
    ),
    render,
  });
  // A block child of the group's flex column already stretches, so the wrapper needs no classes.
  // The wrapper copies the rendered element's visibility, so a hidden item leaves no listitem or
  // gap and a render element that overrides the root's `hidden` stays listed.
  return wrapInListItem ? (
    <div role="listitem" data-slot="item-listitem" {...renderedVisibility(element)}>
      {element}
    </div>
  ) : (
    element
  );
}

ItemRoot.displayName = "Item.Root";
ItemGroup.displayName = "Item.Group";
ItemSeparator.displayName = "Item.Separator";
