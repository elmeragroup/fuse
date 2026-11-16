"use client";

import { createContext, isValidElement, useContext } from "react";
import type { ComponentProps, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { ariaDisabledGuard } from "../../internal/aria-disabled-guard";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { Separator } from "../separator/separator";
import { itemGroupVariants } from "./item-group-variants";
import type { ItemGroupVariant } from "./item-group-variants";
import { itemRootProps } from "./item-root-props";
import type { itemVariants } from "./item-variants";

/** Resolved once at module scope; each call passes the group's own axes. */
const { root: groupRoot, separator: groupSeparator, item: groupItem } = itemGroupVariants();

/** The enclosing group's variant, or `undefined` outside `Item.Group`. */
const ItemGroupContext = createContext<ItemGroupVariant | undefined>(undefined);

/** `Item.Group` takes a native `div`'s props and the group's `variant`. */
type ItemGroupProps = ComponentProps<"div"> & {
  /**
   * The group's look. `compact` draws the rows as one connected list: no gap, tighter rows, flush
   * separators, and outline rows joined under one border with rounded outer corners. Every
   * `Item.Root` and `Item.Separator` inside reads it, so the rows need no props of their own.
   */
  variant?: VariantProps<typeof itemGroupVariants>["variant"];
  /**
   * The rows, each an `Item.Root` as a direct child, with or without a `render` element. A
   * `default` group tightens its gap when one of its rows is `sm` or `xs`. An Item wrapped in
   * another element or nested inside a row does not count as a row.
   */
  children?: ComponentProps<"div">["children"];
  /** Extra classes, merged after the group's own. A `gap-*` class replaces the gap between rows. */
  className?: ComponentProps<"div">["className"];
};

/**
 * A list of Item rows.
 *
 * @param props - The group's `variant`, its rows and the native `div` props.
 * @returns The rendered list, with `role="list"`.
 */
export function ItemGroup({ className, variant = "default", ...props }: ItemGroupProps): ReactElement {
  return (
    <ItemGroupContext.Provider value={variant}>
      <div
        role="list"
        data-slot="item-group"
        data-variant={variant}
        className={cn(groupRoot({ variant }), className)}
        {...props}
      />
    </ItemGroupContext.Provider>
  );
}

/** `Item.Separator` takes Separator's props. */
type ItemSeparatorProps = Omit<ComponentProps<typeof Separator>, "aria-hidden"> & {
  /**
   * Hides the rule from assistive technology. Inside `Item.Group` it defaults to `true`, because
   * a list may own only list items. Pass `false` to expose the rule there. Outside a group it is
   * a `separator`.
   */
  "aria-hidden"?: ComponentProps<typeof Separator>["aria-hidden"];
};

/**
 * A rule between Item rows.
 *
 * @param props - Separator's props.
 * @returns The rendered rule.
 */
export function ItemSeparator({ className, ...props }: ItemSeparatorProps): ReactElement {
  const variant = useContext(ItemGroupContext);
  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      {...definedProps({ "aria-hidden": variant === undefined ? undefined : true })}
      className={mergeClassName(className, groupSeparator({ variant }))}
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

/** `Item.Root` takes a native `div`'s props, `render` and the row's `variant` and `size`. */
type ItemRootPartProps = Omit<useRender.ComponentProps<"div">, "render" | "aria-disabled"> &
  VariantProps<typeof itemVariants> & {
    /**
     * Replaces the host `div`, such as `render={<a href="/orders" />}` for a link row or
     * `render={<button type="button" />}` for a button row. Inside `Item.Group` the rendered
     * element keeps its own role inside a list item wrapper. An explicit `role` on the row
     * replaces that and skips the wrapper.
     */
    render?: useRender.ComponentProps<"div">["render"];
    /**
     * Marks an unavailable row. A link row takes no `disabled`, so mark it `aria-disabled="true"`.
     * Any row marked so dims with the `not-allowed` cursor. A `render` row also drops its hover
     * fill, and a click or Enter neither follows the link nor runs `onClick`. A middle-click
     * neither opens a new tab nor runs `onAuxClick`. A plain row keeps the clicks of the controls
     * inside it.
     */
    "aria-disabled"?: useRender.ComponentProps<"div">["aria-disabled"];
  };

/**
 * One Item row. Inside `Item.Group` a plain row takes `role="listitem"` itself, and a row with a
 * `render` element sits in an `item-listitem` wrapper, like `<li><a/></li>`. The wrapper follows
 * the `hidden` and `aria-hidden` the rendered element ends up with, whether they come from the
 * root or the render element.
 *
 * It publishes `--inner-corner`, its corner less its border and padding, for parts that round with
 * `rounded-inner`.
 *
 * @param props - The row's axes, the host element and the native `div` props.
 * @returns The rendered row, wrapped in a list item when a group needs one.
 */
export function ItemRoot({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: ItemRootPartProps): ReactElement {
  const groupVariant = useContext(ItemGroupContext);
  const inGroup = groupVariant !== undefined;
  const groupClassName = inGroup ? groupItem({ variant: groupVariant, size }) : undefined;
  const wrapInListItem = inGroup && render !== undefined && props.role === undefined;
  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      itemRootProps({ variant, size, className: cn(groupClassName, className) }),
      inGroup && render === undefined ? { role: "listitem" } : undefined,
      props,
      // Only a `render` row (a link or button) activates; a plain row may hold its own controls,
      // whose bubbled clicks the guard would cancel.
      render === undefined ? undefined : ariaDisabledGuard
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
