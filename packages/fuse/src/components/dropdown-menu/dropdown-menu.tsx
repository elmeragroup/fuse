"use client";

import type { ComponentProps, ReactElement } from "react";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { MenuRadioGroupChangeEventDetails } from "@base-ui/react/menu";

import { CaretRight } from "../../icons/generated/caret-right";
import { Check } from "../../icons/generated/check";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { selfFocusRingClass } from "../../styles/utils";
import {
  menuGroupLabelClass,
  menuItemIndicatorClass,
  menuSeparatorClass,
  overlayPositionerClass,
  overlayTimedPopupClass,
} from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps, OverlayPositionerProps } from "../overlay/overlay-props";
import { dropdownMenuVariants } from "./dropdown-menu-variants";

const dropdownMenuSlots = dropdownMenuVariants();
/** Shared item face. Module-private — Item, LinkItem, CheckboxItem, RadioItem, and SubTrigger compose it. */
const dropdownMenuItemClassName = dropdownMenuSlots.item();

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
        // oxlint-disable-next-line elmera/no-local-focus-ring -- positioner is not a focus target
        className={cn(overlayPositionerClass, "outline-none")}
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}>
        <MenuPrimitive.Popup
          data-slot={dataSlot}
          className={mergeClassName(className, overlayTimedPopupClass, popupClassName)}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </OverlayPortal>
  );
}

export function DropdownMenuRoot(props: ComponentProps<typeof MenuPrimitive.Root>): ReactElement {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

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
   * How the popup aligns to the trigger on the cross axis. Menus lead from the trigger
   * edge (unlike Popover/Tooltip, which default to `"center"`).
   */
  align?: ComponentProps<typeof MenuPrimitive.Positioner>["align"];
} & Omit<OverlayPositionerProps<ComponentProps<typeof MenuPrimitive.Positioner>>, "align"> &
  OverlayContainerProps;

/** Popup chrome specific to the root menu; the surface and motion are shared. */
const dropdownMenuContentClassName = dropdownMenuSlots.content();

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

export function DropdownMenuGroup(props: ComponentProps<typeof MenuPrimitive.Group>): ReactElement {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

export type DropdownMenuLabelProps = ComponentProps<typeof MenuPrimitive.GroupLabel> & {
  /**
   * Pads the label to align with indicator-bearing items. Emitted as `data-inset`.
   */
  inset?: boolean;
};

export function DropdownMenuLabel({ className, inset, ...props }: DropdownMenuLabelProps): ReactElement {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset ? true : undefined}
      className={mergeClassName(className, menuGroupLabelClass, "font-medium data-inset:pl-8")}
      {...props}
    />
  );
}

export type DropdownMenuItemProps = ComponentProps<typeof MenuPrimitive.Item> & {
  /**
   * Pads the item to align with indicator-bearing items. Emitted as `data-inset`.
   */
  inset?: boolean;
  /**
   * Visual tone. The value stays `"destructive"` for consumer compat; classes use
   * `error` tokens.
   * @default "default"
   */
  variant?: "default" | "destructive";
};

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
   * Pads the item to align with indicator-bearing items. Emitted as `data-inset`.
   */
  inset?: boolean;
};

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
      className={mergeClassName(className, dropdownMenuItemClassName, "pr-8")}
      checked={checked}
      {...props}>
      <span className={menuItemIndicatorClass} data-slot="dropdown-menu-checkbox-item-indicator">
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
 * `onValueChange` as `any`; the generic ties the group's three props together, not the
 * items — `RadioItem.value` stays `any`, so membership is still checked at runtime.
 */
export type DropdownMenuRadioGroupProps<T extends string> = Omit<
  ComponentProps<typeof MenuPrimitive.RadioGroup>,
  "value" | "defaultValue" | "onValueChange"
> &
  (
    | {
        /** Controlled selected value: one member of the group's string union. */
        value?: T;
        /** Uncontrolled initially selected value: one member of the group's string union. */
        defaultValue?: never;
      }
    | {
        /** Controlled selected value: one member of the group's string union. */
        value?: never;
        /** Uncontrolled initially selected value: one member of the group's string union. */
        defaultValue?: T;
      }
  ) & {
    /** Called with the selected value, narrowed to `T`, and base-ui's change details. */
    onValueChange?: (value: T, eventDetails: MenuRadioGroupChangeEventDetails) => void;
  };

export function DropdownMenuRadioGroup<T extends string>(
  props: DropdownMenuRadioGroupProps<T>
): ReactElement {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

export type DropdownMenuRadioItemProps = ComponentProps<typeof MenuPrimitive.RadioItem> & {
  /**
   * Pads the item to align with indicator-bearing items. Emitted as `data-inset`.
   */
  inset?: boolean;
};

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
      className={mergeClassName(className, dropdownMenuItemClassName, "pr-8")}
      {...props}>
      <span className={menuItemIndicatorClass} data-slot="dropdown-menu-radio-item-indicator">
        <MenuPrimitive.RadioItemIndicator>
          <Check />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>): ReactElement {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={mergeClassName(className, menuSeparatorClass)}
      {...props}
    />
  );
}

export function DropdownMenuShortcut({ className, ...props }: ComponentProps<"span">): ReactElement {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "text-xs tracking-widest ml-auto text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground",
        className
      )}
      {...props}
    />
  );
}

export function DropdownMenuSub(props: ComponentProps<typeof MenuPrimitive.SubmenuRoot>): ReactElement {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" closeParentOnEsc {...props} />;
}

export type DropdownMenuSubTriggerProps = ComponentProps<typeof MenuPrimitive.SubmenuTrigger> & {
  /**
   * Pads the trigger to align with indicator-bearing items. Emitted as `data-inset`.
   */
  inset?: boolean;
};

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
      className={mergeClassName(
        className,
        dropdownMenuItemClassName,
        "data-popup-open:bg-accent data-popup-open:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground"
      )}
      {...props}>
      {children}
      <CaretRight className="ml-auto" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

export type DropdownMenuSubContentProps = ComponentProps<typeof MenuPrimitive.Popup> & {
  /**
   * How the popup aligns to its SubTrigger on the cross axis.
   */
  align?: ComponentProps<typeof MenuPrimitive.Positioner>["align"];
  /**
   * Offset along the alignment axis, in pixels. Negative tucks the submenu's first
   * item level with its trigger.
   */
  alignOffset?: ComponentProps<typeof MenuPrimitive.Positioner>["alignOffset"];
  /**
   * Which side of the SubTrigger the popup is placed on.
   */
  side?: ComponentProps<typeof MenuPrimitive.Positioner>["side"];
  /**
   * Distance from the SubTrigger, in pixels. Flush against the parent menu by default.
   */
  sideOffset?: ComponentProps<typeof MenuPrimitive.Positioner>["sideOffset"];
} & OverlayContainerProps;

/** Popup chrome specific to a submenu; the surface and motion are shared. */
const dropdownMenuSubContentClassName = dropdownMenuSlots.subContent();

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

// Client callers import this object from the implementation module.
// The package entry rebuilds the same parts in index.ts, which has no directive,
// so a server component can read each part.
export const DropdownMenu = {
  Root: DropdownMenuRoot,
  Trigger: DropdownMenuTrigger,
  Portal: DropdownMenuPortal,
  Content: DropdownMenuContent,
  Group: DropdownMenuGroup,
  Label: DropdownMenuLabel,
  Item: DropdownMenuItem,
  LinkItem: DropdownMenuLinkItem,
  CheckboxItem: DropdownMenuCheckboxItem,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  Separator: DropdownMenuSeparator,
  Shortcut: DropdownMenuShortcut,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};
