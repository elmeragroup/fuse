"use client";

import type { ComponentProps, ReactElement } from "react";

import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu";

import { CaretDown } from "../../icons/generated/caret-down";
import { mergeClassName } from "../../styles/merge-class-name";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps } from "../overlay/overlay-props";
import { navigationMenuVariants } from "./navigation-menu-variants";

/** Resolved once at module scope — the recipe has no axes (no per-render work). */
const slots = navigationMenuVariants();

/** Props for `NavigationMenu.Root`. */
export type NavigationMenuRootProps = ComponentProps<typeof NavigationMenuPrimitive.Root> &
  OverlayContainerProps & {
    /**
     * How the shared popup aligns to the open trigger on the cross axis.
     */
    align?: ComponentProps<typeof NavigationMenuPrimitive.Positioner>["align"];
  };

/**
 * The `<nav>` landmark of a site navigation menu. It renders the one popup every
 * `NavigationMenu.Content` opens into, placed under the open trigger, so a menu needs no
 * portal or positioner of its own. Name the landmark with `aria-label`.
 */
export function NavigationMenuRoot({
  align = "start",
  container,
  className,
  children,
  ...props
}: NavigationMenuRootProps): ReactElement {
  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      className={mergeClassName(className, slots.root())}
      {...props}>
      {children}
      <OverlayPortal portal={NavigationMenuPrimitive.Portal} container={container}>
        <NavigationMenuPrimitive.Positioner
          side="bottom"
          sideOffset={8}
          align={align}
          className={slots.positioner()}>
          <NavigationMenuPrimitive.Popup className={slots.popup()}>
            <NavigationMenuPrimitive.Viewport className={slots.viewport()} />
          </NavigationMenuPrimitive.Popup>
        </NavigationMenuPrimitive.Positioner>
      </OverlayPortal>
    </NavigationMenuPrimitive.Root>
  );
}

/** The list of top-level items. Renders a `<ul>`. */
export function NavigationMenuList({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.List>): ReactElement {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={mergeClassName(className, slots.list())}
      {...props}
    />
  );
}

/** One top-level entry: a trigger with its content, or a single link. Renders an `<li>`. */
export function NavigationMenuItem({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Item>): ReactElement {
  return (
    <NavigationMenuPrimitive.Item
      data-slot="navigation-menu-item"
      className={mergeClassName(className, slots.item())}
      {...props}
    />
  );
}

/**
 * The button that opens its item's content on hover, click, Enter or ArrowDown. A caret
 * after the label turns while the content is open.
 */
export function NavigationMenuTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Trigger>): ReactElement {
  return (
    <NavigationMenuPrimitive.Trigger
      data-slot="navigation-menu-trigger"
      className={mergeClassName(className, slots.trigger())}
      {...props}>
      {children}
      <CaretDown aria-hidden="true" className={slots.triggerIcon()} />
    </NavigationMenuPrimitive.Trigger>
  );
}

/** The panel an item shows in the shared popup while its trigger is open. */
export function NavigationMenuContent({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Content>): ReactElement {
  return (
    <NavigationMenuPrimitive.Content
      data-slot="navigation-menu-content"
      className={mergeClassName(className, slots.content())}
      {...props}
    />
  );
}

/**
 * A navigation link, at the top level or inside a content panel. `active` marks the
 * current page with `aria-current="page"`. Renders an `<a>`; compose a router link
 * through `render`.
 */
export function NavigationMenuLink({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Link>): ReactElement {
  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      className={mergeClassName(className, slots.link())}
      {...props}
    />
  );
}

/**
 * An arrow under the trigger that points at the open popup. Place it inside a
 * `NavigationMenu.Trigger`; it is hidden from assistive technology and shows only while
 * that item is open. `children` replaces the default arrow.
 */
export function NavigationMenuIndicator({
  className,
  children = <span className={slots.indicatorArrow()} />,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Icon>): ReactElement {
  return (
    <NavigationMenuPrimitive.Icon
      data-slot="navigation-menu-indicator"
      className={mergeClassName(className, slots.indicator())}
      {...props}>
      {children}
    </NavigationMenuPrimitive.Icon>
  );
}

NavigationMenuRoot.displayName = "NavigationMenu.Root";
NavigationMenuList.displayName = "NavigationMenu.List";
NavigationMenuItem.displayName = "NavigationMenu.Item";
NavigationMenuTrigger.displayName = "NavigationMenu.Trigger";
NavigationMenuContent.displayName = "NavigationMenu.Content";
NavigationMenuLink.displayName = "NavigationMenu.Link";
NavigationMenuIndicator.displayName = "NavigationMenu.Indicator";
