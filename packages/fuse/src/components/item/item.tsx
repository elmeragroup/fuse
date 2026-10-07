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
import { itemGroupVariants } from "./item-group-variants";
import type { ItemGroupVariant } from "./item-group-variants";
import { itemRootProps } from "./item-root-props";
import type { itemVariants } from "./item-variants";

/** The enclosing group's variant, or `undefined` outside `Item.Group`. */
const ItemGroupContext = createContext<ItemGroupVariant | undefined>(undefined);

/**
 * Props for `Item.Group`. `variant="compact"` draws the rows as one connected list: no gap,
 * tighter rows, flush separators, and outline rows joined under one border with rounded
 * outer corners.
 */
type ItemGroupProps = ComponentProps<"div"> & Pick<VariantProps<typeof itemGroupVariants>, "variant">;

/**
 * A list of Item rows. Every `Item.Root` and `Item.Separator` inside reads the group's
 * `variant`, so the compact look needs no props on the rows.
 */
export function ItemGroup({ className, variant = "default", ...props }: ItemGroupProps): ReactElement {
  return (
    <ItemGroupContext.Provider value={variant}>
      <div
        role="list"
        data-slot="item-group"
        data-variant={variant}
        className={cn(itemGroupVariants({ variant }).root(), className)}
        {...props}
      />
    </ItemGroupContext.Provider>
  );
}

export function ItemSeparator({ className, ...props }: ComponentProps<typeof Separator>): ReactElement {
  const variant = useContext(ItemGroupContext);
  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      className={mergeClassName(className, itemGroupVariants({ variant }).separator())}
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
 *
 * It publishes `--inner-corner`, its corner less its border and padding, for parts that round with
 * `rounded-inner`.
 */
export function ItemRoot({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof itemVariants>): ReactElement {
  const groupVariant = useContext(ItemGroupContext);
  const inGroup = groupVariant !== undefined;
  const groupClassName = inGroup ? itemGroupVariants({ variant: groupVariant, size }).item() : undefined;
  const wrapInListItem = inGroup && render !== undefined && props.role === undefined;
  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      itemRootProps({ variant, size, className: cn(groupClassName, className) }),
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
