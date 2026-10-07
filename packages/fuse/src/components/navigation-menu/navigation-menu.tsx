"use client";

import { createContext, useContext, useMemo } from "react";
import type { ComponentProps, ReactElement } from "react";

import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu";

import { CaretDown } from "../../icons/generated/caret-down";
import { mergeClassName } from "../../styles/merge-class-name";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps } from "../overlay/overlay-props";
import { navigationMenuVariants } from "./navigation-menu-variants";

/** Resolved once at module scope; the Trigger and Link resolve their slots per call. */
const slots = navigationMenuVariants();

type PositionerProps = ComponentProps<typeof NavigationMenuPrimitive.Positioner>;

type NavigationMenuOrientation = NonNullable<
  ComponentProps<typeof NavigationMenuPrimitive.Root>["orientation"]
>;

/**
 * Where the nearest Root lays out its list and opens its content. Each Root provides its
 * own, so a List or Trigger styles from its own Root rather than from any ancestor Root a
 * group variant would match. `caret` is the popup's side, or `"none"` for an inline Root.
 */
type NavigationMenuPlacement = {
  readonly orientation: NavigationMenuOrientation;
  readonly caret: NonNullable<PositionerProps["side"]> | "none";
};

const NavigationMenuPlacementContext = createContext<NavigationMenuPlacement | null>(null);

function useNavigationMenuPlacement(part: string): NavigationMenuPlacement {
  const placement = useContext(NavigationMenuPlacementContext);
  if (placement === null) {
    throw new Error(`NavigationMenu.${part} must be used within NavigationMenu.Root`);
  }
  return placement;
}

/**
 * Which box a link takes: `"bar"` directly in a horizontal List, `"row"` anywhere else. Each
 * List provides its own and each Content resets it, because context crosses the popup's
 * portal and a link in a bar's Content would otherwise read the bar's.
 */
type NavigationMenuLinkBox = "bar" | "row";

const NavigationMenuLinkBoxContext = createContext<NavigationMenuLinkBox>("row");

/** Placement of the built-in popup, which only a Root that renders one takes. */
type NavigationMenuPopupPlacementProps = OverlayContainerProps & {
  /**
   * How the shared popup aligns to the open trigger on the cross axis.
   */
  align?: PositionerProps["align"];
  /**
   * Which side of the open trigger the shared popup opens on. Keep the default `"bottom"`
   * for a bar; a submenu nested in a `NavigationMenu.Content` opens to the side, usually
   * `side="right"` with `orientation="vertical"` and `align="end"`.
   */
  side?: PositionerProps["side"];
  /** A Root that renders its own popup is never inline. */
  inline?: false;
};

/** An inline Root renders no popup, so the popup placement props cannot reach it. */
type NavigationMenuInlineProps = {
  /**
   * Render no popup and show the open item's content in the `NavigationMenu.Viewport` you
   * place inside this Root instead. Use it for a submenu nested in a
   * `NavigationMenu.Content` that swaps the panel beside its list, such as a list of
   * audiences with each audience's links next to it.
   */
  inline: true;
  align?: never;
  side?: never;
  container?: never;
};

/** Props for `NavigationMenu.Root`. */
export type NavigationMenuRootProps<Value = unknown> = NavigationMenuPrimitive.Root.Props<Value> &
  (NavigationMenuPopupPlacementProps | NavigationMenuInlineProps);

/**
 * The `<nav>` landmark of a site navigation menu, or a `<div>` when nested in a
 * `NavigationMenu.Content`. It renders the one popup every `NavigationMenu.Content` opens
 * into, placed on `side` of the open trigger, so a menu needs no portal or positioner of
 * its own. An `inline` Root renders none and shows its content in a `NavigationMenu.Viewport`.
 * Name the landmark with `aria-label`.
 */
export function NavigationMenuRoot<Value = unknown>({
  align = "start",
  side = "bottom",
  inline = false,
  container,
  orientation = "horizontal",
  className,
  children,
  ...props
}: NavigationMenuRootProps<Value>): ReactElement {
  const caret = inline ? "none" : side;
  const placement = useMemo((): NavigationMenuPlacement => ({ orientation, caret }), [orientation, caret]);
  return (
    <NavigationMenuPlacementContext.Provider value={placement}>
      <NavigationMenuPrimitive.Root
        data-slot="navigation-menu"
        // Base UI writes no orientation attribute. Root and List write their own Root's, so a
        // horizontal Root nested in a vertical one keeps its bar styles.
        data-orientation={orientation}
        orientation={orientation}
        className={mergeClassName(className, slots.root())}
        {...props}>
        {children}
        {inline ? null : (
          <OverlayPortal portal={NavigationMenuPrimitive.Portal} container={container}>
            <NavigationMenuPrimitive.Positioner
              side={side}
              sideOffset={8}
              align={align}
              className={slots.positioner()}>
              <NavigationMenuPrimitive.Popup data-slot="navigation-menu-popup" className={slots.popup()}>
                <NavigationMenuPrimitive.Viewport className={slots.viewport()} />
              </NavigationMenuPrimitive.Popup>
            </NavigationMenuPrimitive.Positioner>
          </OverlayPortal>
        )}
      </NavigationMenuPrimitive.Root>
    </NavigationMenuPlacementContext.Provider>
  );
}

/** The list of top-level items. Renders a `<ul>`. */
export function NavigationMenuList({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.List>): ReactElement {
  const { orientation } = useNavigationMenuPlacement("List");
  return (
    <NavigationMenuLinkBoxContext.Provider value={orientation === "horizontal" ? "bar" : "row"}>
      <NavigationMenuPrimitive.List
        data-slot="navigation-menu-list"
        data-orientation={orientation}
        className={mergeClassName(className, slots.list())}
        {...props}
      />
    </NavigationMenuLinkBoxContext.Provider>
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
 * after the label points to the Root's `side`: in a bar it points down and turns while the
 * content is open, and in a submenu it points to where the popup opens. A trigger in an
 * `inline` Root has no caret, because its content already shows beside or below the list.
 */
export function NavigationMenuTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Trigger>): ReactElement {
  const { orientation, caret } = useNavigationMenuPlacement("Trigger");
  return (
    <NavigationMenuPrimitive.Trigger
      data-slot="navigation-menu-trigger"
      className={mergeClassName(className, slots.trigger({ orientation }))}
      {...props}>
      {children}
      {caret === "none" ? null : (
        <CaretDown aria-hidden="true" data-side={caret} className={slots.triggerIcon()} />
      )}
    </NavigationMenuPrimitive.Trigger>
  );
}

/**
 * The panel an item shows in the shared popup while its trigger is open. In the popup it pads
 * its rows inside the popup's corner and publishes `--inner-corner`, so its links, the triggers
 * of a Root nested in it and a custom block placed in it with `rounded-inner` round
 * concentrically with the popup. In an `inline` Root on the page its rows keep `rounded-sm`.
 */
export function NavigationMenuContent({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Content>): ReactElement {
  return (
    <NavigationMenuLinkBoxContext.Provider value="row">
      <NavigationMenuPrimitive.Content
        data-slot="navigation-menu-content"
        className={mergeClassName(className, slots.content())}
        {...props}
      />
    </NavigationMenuLinkBoxContext.Provider>
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
  const box = useContext(NavigationMenuLinkBoxContext);
  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      className={mergeClassName(className, slots.link({ box }))}
      {...props}
    />
  );
}

/**
 * Where an `inline` Root shows its open item's content. Place it inside that Root, beside
 * its `NavigationMenu.List`; a Root that renders its own popup already has one.
 */
export function NavigationMenuViewport({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Viewport>): ReactElement {
  return (
    <NavigationMenuPrimitive.Viewport
      data-slot="navigation-menu-viewport"
      className={mergeClassName(className, slots.inlineViewport())}
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
NavigationMenuViewport.displayName = "NavigationMenu.Viewport";
NavigationMenuIndicator.displayName = "NavigationMenu.Indicator";
