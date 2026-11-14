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
type TriggerPrimitiveProps = ComponentProps<typeof NavigationMenuPrimitive.Trigger>;
type ContentPrimitiveProps = ComponentProps<typeof NavigationMenuPrimitive.Content>;
type LinkPrimitiveProps = ComponentProps<typeof NavigationMenuPrimitive.Link>;
type IndicatorPrimitiveProps = ComponentProps<typeof NavigationMenuPrimitive.Icon>;

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
  /** How the shared popup lines up with the open trigger along the trigger's edge. */
  align?: PositionerProps["align"];
  /**
   * The side of the open trigger the shared popup opens on. Every `NavigationMenu.Content` of
   * this Root opens into that one popup, which resizes as the pointer moves between triggers.
   * Keep `bottom` for a bar. A submenu nested in a `NavigationMenu.Content` opens to the side,
   * usually with `side="right"`, `orientation="vertical"` and `align="end"`, and the outer panel
   * stays open.
   */
  side?: PositionerProps["side"];
  /** A Root that renders its own popup is never inline. */
  inline?: false;
};

/** An inline Root renders no popup, so the popup placement props cannot reach it. */
type NavigationMenuInlineProps = {
  /**
   * Renders no popup. The open item's content shows in a `NavigationMenu.Viewport` that you place
   * inside this Root, beside its `NavigationMenu.List`. Use it for a submenu in a
   * `NavigationMenu.Content` that swaps the panel beside its list as the pointer moves down it.
   * The arrow keys move focus between its triggers, and Enter or Space shows the focused
   * trigger's content. Its triggers have no caret. Pass `defaultValue` to open the first item
   * together with the outer panel. Stack the list above the viewport on narrow screens.
   */
  inline: true;
  align?: never;
  side?: never;
  container?: never;
};

/** Props for `NavigationMenu.Root`. */
export type NavigationMenuRootProps<Value = unknown> = Omit<
  NavigationMenuPrimitive.Root.Props<Value>,
  "aria-label"
> & {
  /**
   * The navigation landmark's name, such as "Main". Give every top-level Root one. A Root nested
   * in a `NavigationMenu.Content` renders a `<div>`, not a second landmark, and needs none.
   */
  "aria-label"?: NavigationMenuPrimitive.Root.Props<Value>["aria-label"];
} & (NavigationMenuPopupPlacementProps | NavigationMenuInlineProps);

/**
 * The `<nav>` landmark of a site navigation menu, or a `<div>` when nested in a
 * `NavigationMenu.Content`. It renders the popup every `NavigationMenu.Content` opens into, so a
 * menu needs no portal or positioner of its own. An `inline` Root renders none.
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

/** The button that opens its item's content. */
export function NavigationMenuTrigger({
  className,
  children,
  ...props
}: Omit<TriggerPrimitiveProps, "children"> & {
  /**
   * The trigger's label. The trigger opens its item's content on hover, on click, and on Enter
   * or ArrowDown, and Escape closes it and returns focus to the trigger. A caret after the label
   * points to the Root's `side`. In a bar it points down and turns while the content is open. A
   * trigger in an `inline` Root has no caret.
   */
  children?: TriggerPrimitiveProps["children"];
}): ReactElement {
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
 * its rows inside the popup's corner and publishes `--inner-corner`. In an `inline` Root on the
 * page its rows keep `rounded-sm`.
 */
export function NavigationMenuContent({
  className,
  ...props
}: Omit<ContentPrimitiveProps, "children"> & {
  /**
   * The item's links, or a nested `NavigationMenu.Root` for a submenu. Lay several links out in a
   * plain `<ul>`, such as a grid. In the popup, the links and the triggers of a nested Root round
   * with the popup's corner. Give a block of your own `rounded-inner` to do the same.
   */
  children?: ContentPrimitiveProps["children"];
}): ReactElement {
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

/** A navigation link, at the top level or in a content panel. It renders an `<a>`. */
export function NavigationMenuLink({
  active = false,
  className,
  ...props
}: Omit<LinkPrimitiveProps, "active" | "render" | "children"> & {
  /** Marks the link to the current page, which sets `aria-current="page"`. */
  active?: LinkPrimitiveProps["active"];
  /**
   * Your router's link element, such as `<NextLink href="/pricing" />`, for client-side routing.
   * The link keeps its `active` state and `aria-current`.
   */
  render?: LinkPrimitiveProps["render"];
  /** The link's label, or a title and a one-line description in a column of plain spans. */
  children?: LinkPrimitiveProps["children"];
}): ReactElement {
  const box = useContext(NavigationMenuLinkBoxContext);
  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      active={active}
      className={mergeClassName(className, slots.link({ box }))}
      {...props}
    />
  );
}

/**
 * Where an `inline` Root shows its open item's content. A Root that renders its own popup already
 * has one.
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
 * An arrow under the trigger that points at the open popup. It is hidden from assistive
 * technology.
 */
export function NavigationMenuIndicator({
  className,
  children = <span className={slots.indicatorArrow()} />,
  ...props
}: Omit<IndicatorPrimitiveProps, "children"> & {
  /**
   * The arrow. Unset, it is a small triangle. Place the indicator inside a
   * `NavigationMenu.Trigger`, where it shows only while that item is open.
   */
  children?: IndicatorPrimitiveProps["children"];
}): ReactElement {
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
