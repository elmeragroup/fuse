"use client";

import type { ComponentProps, ReactElement, RefObject } from "react";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { CaretRight } from "../../icons/generated/caret-right";
import { Check } from "../../icons/generated/check";
import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";
import { useThemeScopeContainer } from "../../theme/theme-scope-container";
import { overlayLayer } from "../overlay/overlay-classes";

/** Resolved once at module scope — the recipe below does the same (no per-render work). */
const selfFocusRing = focusRing({ target: "self" }).root();

/**
 * Shared item face (dropdown-menu.md §4). Module-private — Item, LinkItem, CheckboxItem,
 * RadioItem, and SubTrigger compose it; it is not a public recipe.
 */
const dropdownMenuItemClassName = cn(
  selfFocusRing,
  "group/dropdown-menu-item text-sm relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-8 data-[variant=destructive]:text-error data-[variant=destructive]:focus:bg-error/10 data-[variant=destructive]:focus:text-error data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-error"
);

/** Open/close animation set shared by Content and SubContent (dropdown-menu.md §6/§8). */
const popupMotionClassName =
  "origin-(--transform-origin) duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95";

function DropdownMenuRoot(props: ComponentProps<typeof MenuPrimitive.Root>): ReactElement {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Trigger>): ReactElement {
  return (
    <MenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      className={cn(selfFocusRing, className)}
      {...props}
    />
  );
}

function DropdownMenuPortal(props: ComponentProps<typeof MenuPrimitive.Portal>): ReactElement {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

export type DropdownMenuContentProps = ComponentProps<typeof MenuPrimitive.Popup> & {
  /**
   * How the popup aligns to the trigger on the cross axis. Menus lead from the trigger
   * edge (unlike Popover/Tooltip, which default to `"center"`).
   * @default "start"
   */
  align?: ComponentProps<typeof MenuPrimitive.Positioner>["align"];
  /**
   * Offset along the alignment axis, in pixels.
   * @default 0
   */
  alignOffset?: ComponentProps<typeof MenuPrimitive.Positioner>["alignOffset"];
  /**
   * Which side of the trigger the popup is placed on.
   * @default "bottom"
   */
  side?: ComponentProps<typeof MenuPrimitive.Positioner>["side"];
  /**
   * Distance from the trigger, in pixels.
   * @default 4
   */
  sideOffset?: ComponentProps<typeof MenuPrimitive.Positioner>["sideOffset"];
  /**
   * Portal target for the popup. Defaults to the nearest enclosing `ThemeScope`
   * element, so an overlay never escapes the theme that opened it.
   */
  container?: HTMLElement | RefObject<HTMLElement | null>;
};

function DropdownMenuContent({
  className,
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  container,
  ...props
}: DropdownMenuContentProps): ReactElement | null {
  const resolvedContainer = useThemeScopeContainer(container);

  // theming.md §7.4: an explicit ref or an enclosing ThemeScope whose element is not
  // attached yet means wait — never a brief escape to the document body. Only an absent
  // scope (`undefined`) leaves the primitive default in place.
  if (resolvedContainer === null) {
    return null;
  }

  return (
    <MenuPrimitive.Portal data-slot="dropdown-menu-portal" container={resolvedContainer}>
      <MenuPrimitive.Positioner
        className={cn("isolate outline-none", overlayLayer)}
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}>
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "shadow-md max-h-(--available-height) min-w-32 overflow-x-hidden overflow-y-auto rounded-md bg-popover p-1 text-popover-foreground ring-1 ring-foreground/10 outline-none data-closed:overflow-hidden",
            popupMotionClassName,
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuGroup(props: ComponentProps<typeof MenuPrimitive.Group>): ReactElement {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

export type DropdownMenuLabelProps = ComponentProps<typeof MenuPrimitive.GroupLabel> & {
  /**
   * Pads the label to align with indicator-bearing items. Emitted as `data-inset`.
   */
  inset?: boolean;
};

function DropdownMenuLabel({ className, inset, ...props }: DropdownMenuLabelProps): ReactElement {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset ? true : undefined}
      className={cn("text-xs font-medium px-2 py-1.5 text-muted-foreground data-inset:pl-8", className)}
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
   * `error` tokens (dropdown-menu.md §8).
   * @default "default"
   */
  variant?: "default" | "destructive";
};

function DropdownMenuItem({
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
      className={cn(dropdownMenuItemClassName, className)}
      {...props}
    />
  );
}

function DropdownMenuLinkItem({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.LinkItem>): ReactElement {
  return (
    <MenuPrimitive.LinkItem
      data-slot="dropdown-menu-link-item"
      className={cn(dropdownMenuItemClassName, className)}
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

function DropdownMenuCheckboxItem({
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
      className={cn(dropdownMenuItemClassName, "pr-8", className)}
      checked={checked}
      {...props}>
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator">
        <MenuPrimitive.CheckboxItemIndicator>
          <Check />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup(props: ComponentProps<typeof MenuPrimitive.RadioGroup>): ReactElement {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

export type DropdownMenuRadioItemProps = ComponentProps<typeof MenuPrimitive.RadioItem> & {
  /**
   * Pads the item to align with indicator-bearing items. Emitted as `data-inset`.
   */
  inset?: boolean;
};

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: DropdownMenuRadioItemProps): ReactElement {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset ? true : undefined}
      className={cn(dropdownMenuItemClassName, "pr-8", className)}
      {...props}>
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator">
        <MenuPrimitive.RadioItemIndicator>
          <Check />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>): ReactElement {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({ className, ...props }: ComponentProps<"span">): ReactElement {
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

function DropdownMenuSub(props: ComponentProps<typeof MenuPrimitive.SubmenuRoot>): ReactElement {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" closeParentOnEsc {...props} />;
}

export type DropdownMenuSubTriggerProps = ComponentProps<typeof MenuPrimitive.SubmenuTrigger> & {
  /**
   * Pads the trigger to align with indicator-bearing items. Emitted as `data-inset`.
   */
  inset?: boolean;
};

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: DropdownMenuSubTriggerProps): ReactElement {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset ? true : undefined}
      className={cn(
        dropdownMenuItemClassName,
        "data-popup-open:bg-accent data-popup-open:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground",
        className
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
   * @default "start"
   */
  align?: ComponentProps<typeof MenuPrimitive.Positioner>["align"];
  /**
   * Offset along the alignment axis, in pixels. Negative tucks the submenu's first
   * item level with its trigger.
   * @default -3
   */
  alignOffset?: ComponentProps<typeof MenuPrimitive.Positioner>["alignOffset"];
  /**
   * Which side of the SubTrigger the popup is placed on.
   * @default "right"
   */
  side?: ComponentProps<typeof MenuPrimitive.Positioner>["side"];
  /**
   * Distance from the SubTrigger, in pixels. Flush against the parent menu by default.
   * @default 0
   */
  sideOffset?: ComponentProps<typeof MenuPrimitive.Positioner>["sideOffset"];
  /**
   * Portal target for the submenu. Defaults to the nearest enclosing `ThemeScope`
   * element, so an overlay never escapes the theme that opened it.
   */
  container?: HTMLElement | RefObject<HTMLElement | null>;
};

function DropdownMenuSubContent({
  className,
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  container,
  ...props
}: DropdownMenuSubContentProps): ReactElement | null {
  const resolvedContainer = useThemeScopeContainer(container);

  // theming.md §7.4: an explicit ref or an enclosing ThemeScope whose element is not
  // attached yet means wait — never a brief escape to the document body. Only an absent
  // scope (`undefined`) leaves the primitive default in place.
  if (resolvedContainer === null) {
    return null;
  }

  return (
    <MenuPrimitive.Portal data-slot="dropdown-menu-portal" container={resolvedContainer}>
      <MenuPrimitive.Positioner
        className={cn("isolate outline-none", overlayLayer)}
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}>
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-sub-content"
          className={cn(
            "shadow-lg w-auto min-w-[96px] rounded-md bg-popover p-1 text-popover-foreground ring-1 ring-foreground/10",
            popupMotionClassName,
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
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
