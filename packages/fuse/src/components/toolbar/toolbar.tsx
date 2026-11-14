"use client";

import type { ComponentProps, ReactElement } from "react";

import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar";

import { mergeClassName } from "../../styles/merge-class-name";
import { toolbarVariants } from "./toolbar-variants";

const slots = toolbarVariants();

type RootPrimitiveProps = ComponentProps<typeof ToolbarPrimitive.Root>;
type ButtonPrimitiveProps = ComponentProps<typeof ToolbarPrimitive.Button>;
type LinkPrimitiveProps = ComponentProps<typeof ToolbarPrimitive.Link>;
type InputPrimitiveProps = ComponentProps<typeof ToolbarPrimitive.Input>;
type GroupPrimitiveProps = ComponentProps<typeof ToolbarPrimitive.Group>;

/** The props of `Toolbar.Root`: Base UI's toolbar root, with `orientation`, `loopFocus` and `disabled`. */
export type ToolbarRootProps = Omit<
  RootPrimitiveProps,
  "aria-label" | "children" | "orientation" | "loopFocus" | "disabled"
> & {
  /** The toolbar's name, such as "Invoice". Give every toolbar one. */
  "aria-label"?: RootPrimitiveProps["aria-label"];
  /**
   * The items: `Toolbar.Button`, `Toolbar.Link`, `Toolbar.Input`, `Toolbar.Group` and
   * `Toolbar.Separator`. A `ToggleGroup` joins the toolbar's arrow-key order instead of keeping its
   * own. The bar publishes `--inner-corner`, so a block of your own with `rounded-inner` rounds with
   * it. For a bar that only switches between options, use `ToggleGroup` on its own.
   */
  children?: RootPrimitiveProps["children"];
  /**
   * The direction of the bar. `vertical` stacks the items, the up and down arrow keys move between
   * them, and separators turn horizontal.
   */
  orientation?: RootPrimitiveProps["orientation"];
  /**
   * Whether the arrow keys wrap from the last item to the first. Tab moves focus into the bar and
   * out again. Pass `false` to stop at the ends.
   */
  loopFocus?: RootPrimitiveProps["loopFocus"];
  /**
   * Disables every button and input in the bar. They stay in the arrow-key order, so a keyboard
   * user still finds them. A `Toolbar.Link` cannot be disabled.
   */
  disabled?: RootPrimitiveProps["disabled"];
};

/** The props of `Toolbar.Button`: Base UI's toolbar button, with `render`, `disabled` and `focusableWhenDisabled`. */
export type ToolbarButtonProps = Omit<ButtonPrimitiveProps, "render" | "disabled"> & {
  /**
   * The control that shows the button, such as `<Button variant="ghost" size="sm" />` or
   * `<Toggle size="sm" />`. A `Popover.Trigger` or `DropdownMenu.Trigger` goes here too, with the
   * Button in its own `render`. A tooltip goes the other way round: pass the `Toolbar.Button` to
   * `Tooltip.Trigger`'s `render`. Unset, the button is a native `<button>` with no styles.
   */
  render?: ButtonPrimitiveProps["render"];
  /**
   * Disables the button. It stays focusable, so the arrow keys still reach it, unless
   * `focusableWhenDisabled` is `false`.
   */
  disabled?: ButtonPrimitiveProps["disabled"];
};

/** The props of `Toolbar.Link`: Base UI's toolbar link, an anchor with `render`. */
export type ToolbarLinkProps = Omit<LinkPrimitiveProps, "className"> & {
  /**
   * Classes for the anchor, which has no styles of its own, such as
   * `buttonVariants({ variant: "link", size: "sm" })`.
   */
  className?: LinkPrimitiveProps["className"];
};

/** The props of `Toolbar.Input`: Base UI's toolbar input, with `render`, `disabled` and `focusableWhenDisabled`. */
export type ToolbarInputProps = Omit<InputPrimitiveProps, "render"> & {
  /**
   * The control that shows the input, such as `<Input aria-label="Search" />`. Unset, it is a
   * native `<input>` with no styles. The arrow keys move its caret as well as the toolbar's focus,
   * so put at most one input in a horizontal toolbar, as its last item.
   */
  render?: InputPrimitiveProps["render"];
};

/** The props of `Toolbar.Group`: Base UI's toolbar group, with `disabled`. */
export type ToolbarGroupProps = Omit<GroupPrimitiveProps, "aria-label" | "disabled"> & {
  /** The group's name, such as "File". */
  "aria-label"?: GroupPrimitiveProps["aria-label"];
  /**
   * Disables every button and input in the group. They stay in the arrow-key order. A
   * `Toolbar.Link` cannot be disabled.
   */
  disabled?: GroupPrimitiveProps["disabled"];
};

/** The props of `Toolbar.Separator`: Base UI's toolbar separator, perpendicular to the toolbar by default. */
export type ToolbarSeparatorProps = ComponentProps<typeof ToolbarPrimitive.Separator>;

/**
 * A bar of controls that is one Tab stop. It draws the bar, a bordered popover fill with `p-1`
 * and a small gap, and a column when `orientation="vertical"`. It rounds with `rounded-lg` and
 * publishes `--inner-corner`, that corner less its border and padding.
 */
export function ToolbarRoot({
  orientation = "horizontal",
  loopFocus = true,
  disabled = false,
  className,
  ...props
}: ToolbarRootProps): ReactElement {
  return (
    <ToolbarPrimitive.Root
      data-slot="toolbar"
      orientation={orientation}
      loopFocus={loopFocus}
      disabled={disabled}
      className={mergeClassName(className, slots.root())}
      {...props}
    />
  );
}

/** A button in the toolbar's focus order. It has no styles of its own. */
export function ToolbarButton({ disabled = false, ...props }: ToolbarButtonProps): ReactElement {
  return <ToolbarPrimitive.Button data-slot="toolbar-button" disabled={disabled} {...props} />;
}

/** A link in the toolbar's focus order. It has no styles of its own. */
export function ToolbarLink(props: ToolbarLinkProps): ReactElement {
  return <ToolbarPrimitive.Link data-slot="toolbar-link" {...props} />;
}

/** A text input in the toolbar's focus order. It has no styles of its own. */
export function ToolbarInput(props: ToolbarInputProps): ReactElement {
  return <ToolbarPrimitive.Input data-slot="toolbar-input" {...props} />;
}

/** Items that belong together, in a row with a small gap, or a column in a vertical toolbar. */
export function ToolbarGroup({ disabled = false, className, ...props }: ToolbarGroupProps): ReactElement {
  return (
    <ToolbarPrimitive.Group
      data-slot="toolbar-group"
      disabled={disabled}
      className={mergeClassName(className, slots.group())}
      {...props}
    />
  );
}

/**
 * Separator's hairline across the toolbar, between items or groups. It is vertical in a
 * horizontal toolbar and horizontal in a vertical one, 4px short of the items' edges at each end.
 */
export function ToolbarSeparator({ className, ...props }: ToolbarSeparatorProps): ReactElement {
  return (
    <ToolbarPrimitive.Separator
      data-slot="toolbar-separator"
      className={mergeClassName(className, slots.separator())}
      {...props}
    />
  );
}

ToolbarRoot.displayName = "Toolbar.Root";
ToolbarButton.displayName = "Toolbar.Button";
ToolbarLink.displayName = "Toolbar.Link";
ToolbarInput.displayName = "Toolbar.Input";
ToolbarGroup.displayName = "Toolbar.Group";
ToolbarSeparator.displayName = "Toolbar.Separator";
