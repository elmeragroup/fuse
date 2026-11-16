"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { MenuRadioGroupChangeEventDetails } from "@base-ui/react/menu";

import { CaretRight } from "../../icons/generated/caret-right";
import { Check } from "../../icons/generated/check";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { selfFocusRingClass } from "../../styles/utils";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps, OverlayPositionerProps } from "../overlay/overlay-props";
import { dropdownMenuVariants } from "./dropdown-menu-variants";

const dropdownMenuSlots = dropdownMenuVariants();
/** The shared item face, module-private, which Item and LinkItem render. */
const dropdownMenuItemClassName = dropdownMenuSlots.item();
/** CheckboxItem's and RadioItem's face: the item with room for the trailing indicator. */
const dropdownMenuCheckableItemClassName = dropdownMenuSlots.checkableItem();
const dropdownMenuItemIndicatorClassName = dropdownMenuSlots.itemIndicator();
const dropdownMenuSeparatorClassName = dropdownMenuSlots.separator();

/** Renders the menu popup in a portal. `DropdownMenu.Content` renders one for you. */
export function DropdownMenuPortal(props: ComponentProps<typeof MenuPrimitive.Portal>): ReactElement {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

/**
 * The one menu popup. Content and SubContent are the same
 * `Portal > Positioner > Popup` with different defaults, a different `data-slot`, and a
 * different popup-chrome extra. SubContent calls this helper directly, keeping one popup
 * and one class string. Both callers resolve their own positioner defaults.
 */
function DropdownMenuPopup({
  className,
  popupClassName,
  dataSlot,
  align,
  alignOffset,
  side,
  sideOffset,
  container,
  ...props
}: ComponentProps<typeof MenuPrimitive.Popup> &
  Pick<ComponentProps<typeof MenuPrimitive.Positioner>, "align" | "alignOffset" | "side" | "sideOffset"> &
  OverlayContainerProps & {
    popupClassName: string;
    dataSlot: "dropdown-menu-content" | "dropdown-menu-sub-content";
  }): ReactElement | null {
  return (
    <OverlayPortal portal={DropdownMenuPortal} container={container}>
      <MenuPrimitive.Positioner
        className={dropdownMenuSlots.positioner()}
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}>
        <MenuPrimitive.Popup
          data-slot={dataSlot}
          className={mergeClassName(className, popupClassName)}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </OverlayPortal>
  );
}

/** Holds the menu's open state and connects its trigger to its popup. */
export function DropdownMenuRoot(props: ComponentProps<typeof MenuPrimitive.Root>): ReactElement {
  return <MenuPrimitive.Root {...props} />;
}

/** Opens the menu. It renders a plain `button`; pass `render` to render another element. */
export function DropdownMenuTrigger({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Trigger>): ReactElement {
  return (
    <MenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      className={mergeClassName(className, selfFocusRingClass)}
      {...props}
    />
  );
}

export type DropdownMenuContentProps = ComponentProps<typeof MenuPrimitive.Popup> & {
  /**
   * How the popup lines up with the trigger along the side it opens on. A menu defaults to
   * `start`, where Popover and Tooltip default to `center`.
   */
  align?: ComponentProps<typeof MenuPrimitive.Positioner>["align"];
} & Omit<OverlayPositionerProps<ComponentProps<typeof MenuPrimitive.Positioner>>, "align"> &
  OverlayContainerProps;

/** The root menu's popup: the shared surface and motion with this menu's chrome. */
const dropdownMenuContentClassName = dropdownMenuSlots.content();

/**
 * The menu popup. It pads its items and publishes `--inner-corner`, so a custom block placed
 * in it with `rounded-inner` rounds like the items.
 */
export function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  ...props
}: DropdownMenuContentProps): ReactElement | null {
  return (
    <DropdownMenuPopup
      dataSlot="dropdown-menu-content"
      popupClassName={dropdownMenuContentClassName}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

type DropdownMenuGroupProps = ComponentProps<typeof MenuPrimitive.Group> & {
  /**
   * The group's items, with an optional `DropdownMenu.Label` that names them. A label names
   * the items of the group it sits in, so render it inside a group.
   */
  children?: ReactNode;
};

/** Groups related items. */
export function DropdownMenuGroup(props: DropdownMenuGroupProps): ReactElement {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

export type DropdownMenuLabelProps = ComponentProps<typeof MenuPrimitive.GroupLabel> & {
  /**
   * Pads the label's start by the width of a 16px icon and its gap, so its text lines up with
   * items that start with an icon. It sets `data-inset`.
   */
  inset?: boolean;
};

/** Names the items of the `DropdownMenu.Group` it sits in. */
export function DropdownMenuLabel({ className, inset, ...props }: DropdownMenuLabelProps): ReactElement {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset ? true : undefined}
      className={mergeClassName(className, dropdownMenuSlots.label())}
      {...props}
    />
  );
}

export type DropdownMenuItemProps = ComponentProps<typeof MenuPrimitive.Item> & {
  /**
   * Pads the item's start by the width of a 16px icon and its gap, so its text lines up with
   * items that start with an icon. It sets `data-inset`.
   */
  inset?: boolean;
  /** The item's colour. `destructive` paints it in the `error` colour, for an action such as Delete. */
  variant?: "default" | "destructive";
};

/** A menu action. */
export function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: DropdownMenuItemProps): ReactElement {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset ? true : undefined}
      data-variant={variant}
      className={mergeClassName(className, dropdownMenuItemClassName)}
      {...props}
    />
  );
}

/** A menu item that is a link. Pass `href`, or a router link through `render`. */
export function DropdownMenuLinkItem({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.LinkItem>): ReactElement {
  return (
    <MenuPrimitive.LinkItem
      data-slot="dropdown-menu-link-item"
      className={mergeClassName(className, dropdownMenuItemClassName)}
      {...props}
    />
  );
}

export type DropdownMenuCheckboxItemProps = ComponentProps<typeof MenuPrimitive.CheckboxItem> & {
  /**
   * Pads the item's start by the width of a 16px icon and its gap, so its text lines up with
   * items that start with an icon. It sets `data-inset`.
   */
  inset?: boolean;
};

/** A menu item that toggles a setting, with a check mark at its end while checked. */
export function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: DropdownMenuCheckboxItemProps): ReactElement {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset ? true : undefined}
      className={mergeClassName(className, dropdownMenuCheckableItemClassName)}
      checked={checked}
      {...props}>
      <span className={dropdownMenuItemIndicatorClassName} data-slot="dropdown-menu-checkbox-item-indicator">
        <MenuPrimitive.CheckboxItemIndicator>
          <Check />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

/**
 * Narrows the group's selected value to one string union. Base UI types `value` and
 * `onValueChange` as `any`. The generic ties the group's three props together, but not the
 * items. `RadioItem.value` stays `any`, so only the runtime checks an item's value.
 */
export type DropdownMenuRadioGroupProps<T extends string> = Omit<
  ComponentProps<typeof MenuPrimitive.RadioGroup>,
  "value" | "defaultValue" | "onValueChange"
> &
  (
    | {
        /**
         * The selected value, one member of the group's string union `T`. The group does not
         * check `DropdownMenu.RadioItem` values against `T`, so a mistyped item value still
         * compiles.
         */
        value?: T;
        /** Not allowed with `value`. */
        defaultValue?: never;
      }
    | {
        /** Not allowed with `defaultValue`. */
        value?: never;
        /** The value selected at first, when the group holds its own state. One member of `T`. */
        defaultValue?: T;
      }
  ) & {
    /** Runs when the selection changes, with the new value as `T` and Base UI's change details. */
    onValueChange?: (value: T, eventDetails: MenuRadioGroupChangeEventDetails) => void;
  };

/** Groups radio items, of which one is selected. */
export function DropdownMenuRadioGroup<T extends string>(
  props: DropdownMenuRadioGroupProps<T>
): ReactElement {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

export type DropdownMenuRadioItemProps = ComponentProps<typeof MenuPrimitive.RadioItem> & {
  /**
   * Pads the item's start by the width of a 16px icon and its gap, so its text lines up with
   * items that start with an icon. It sets `data-inset`.
   */
  inset?: boolean;
};

/** A menu item in a radio group, with a check mark at its end while selected. */
export function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: DropdownMenuRadioItemProps): ReactElement {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset ? true : undefined}
      className={mergeClassName(className, dropdownMenuCheckableItemClassName)}
      {...props}>
      <span className={dropdownMenuItemIndicatorClassName} data-slot="dropdown-menu-radio-item-indicator">
        <MenuPrimitive.RadioItemIndicator>
          <Check />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

/** A line between groups of items. */
export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>): ReactElement {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={mergeClassName(className, dropdownMenuSeparatorClassName)}
      {...props}
    />
  );
}

/** A keyboard shortcut at the end of an item. It is text only, and binds no key. */
export function DropdownMenuShortcut({ className, ...props }: ComponentProps<"span">): ReactElement {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(dropdownMenuSlots.shortcut(), className)}
      {...props}
    />
  );
}

/** Holds a submenu's open state. Escape in the submenu closes the parent menu too. */
export function DropdownMenuSub(props: ComponentProps<typeof MenuPrimitive.SubmenuRoot>): ReactElement {
  return <MenuPrimitive.SubmenuRoot closeParentOnEsc {...props} />;
}

export type DropdownMenuSubTriggerProps = ComponentProps<typeof MenuPrimitive.SubmenuTrigger> & {
  /**
   * Pads the trigger's start by the width of a 16px icon and its gap, so its text lines up with
   * items that start with an icon. It sets `data-inset`.
   */
  inset?: boolean;
};

/** The item that opens a submenu, with a caret at its end. */
export function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: DropdownMenuSubTriggerProps): ReactElement {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset ? true : undefined}
      className={mergeClassName(className, dropdownMenuSlots.subTrigger())}
      {...props}>
      {children}
      <CaretRight className={dropdownMenuSlots.subTriggerCaret()} />
    </MenuPrimitive.SubmenuTrigger>
  );
}

export type DropdownMenuSubContentProps = ComponentProps<typeof MenuPrimitive.Popup> & {
  /** How the submenu lines up with its `DropdownMenu.SubTrigger` along the side it opens on. */
  align?: ComponentProps<typeof MenuPrimitive.Positioner>["align"];
  /**
   * The submenu's shift along the side it opens on, in pixels. The default `-3` lines the
   * submenu's first item up with its trigger.
   */
  alignOffset?: ComponentProps<typeof MenuPrimitive.Positioner>["alignOffset"];
  /** The side of the `DropdownMenu.SubTrigger` the submenu opens on. */
  side?: ComponentProps<typeof MenuPrimitive.Positioner>["side"];
  /** The gap between the `DropdownMenu.SubTrigger` and the submenu, in pixels. The default `0` puts the submenu against the parent menu. */
  sideOffset?: ComponentProps<typeof MenuPrimitive.Positioner>["sideOffset"];
} & OverlayContainerProps;

/** A submenu's popup: the shared surface and motion with the submenu's chrome. */
const dropdownMenuSubContentClassName = dropdownMenuSlots.subContent();

/**
 * A submenu popup. Like `DropdownMenu.Content`, it pads its items and publishes
 * `--inner-corner` for parts that round with `rounded-inner`.
 */
export function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  ...props
}: DropdownMenuSubContentProps): ReactElement | null {
  return (
    <DropdownMenuPopup
      dataSlot="dropdown-menu-sub-content"
      popupClassName={dropdownMenuSubContentClassName}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

DropdownMenuRoot.displayName = "DropdownMenu.Root";
DropdownMenuTrigger.displayName = "DropdownMenu.Trigger";
DropdownMenuPortal.displayName = "DropdownMenu.Portal";
DropdownMenuContent.displayName = "DropdownMenu.Content";
DropdownMenuGroup.displayName = "DropdownMenu.Group";
DropdownMenuLabel.displayName = "DropdownMenu.Label";
DropdownMenuItem.displayName = "DropdownMenu.Item";
DropdownMenuLinkItem.displayName = "DropdownMenu.LinkItem";
DropdownMenuCheckboxItem.displayName = "DropdownMenu.CheckboxItem";
DropdownMenuRadioGroup.displayName = "DropdownMenu.RadioGroup";
DropdownMenuRadioItem.displayName = "DropdownMenu.RadioItem";
DropdownMenuSeparator.displayName = "DropdownMenu.Separator";
DropdownMenuShortcut.displayName = "DropdownMenu.Shortcut";
DropdownMenuSub.displayName = "DropdownMenu.Sub";
DropdownMenuSubTrigger.displayName = "DropdownMenu.SubTrigger";
DropdownMenuSubContent.displayName = "DropdownMenu.SubContent";
