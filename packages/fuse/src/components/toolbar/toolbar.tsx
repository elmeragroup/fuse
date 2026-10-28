"use client";

import type { ComponentProps, ReactElement } from "react";

import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar";

import { mergeClassName } from "../../styles/merge-class-name";
import { toolbarVariants } from "./toolbar-variants";

const slots = toolbarVariants();

/** The props of `Toolbar.Root`: Base UI's toolbar root, with `orientation`, `loopFocus` and `disabled`. */
export type ToolbarRootProps = ComponentProps<typeof ToolbarPrimitive.Root>;

/** The props of `Toolbar.Button`: Base UI's toolbar button, with `render`, `disabled` and `focusableWhenDisabled`. */
export type ToolbarButtonProps = ComponentProps<typeof ToolbarPrimitive.Button>;

/** The props of `Toolbar.Link`: Base UI's toolbar link, an anchor with `render`. */
export type ToolbarLinkProps = ComponentProps<typeof ToolbarPrimitive.Link>;

/** The props of `Toolbar.Input`: Base UI's toolbar input, with `render`, `disabled` and `focusableWhenDisabled`. */
export type ToolbarInputProps = ComponentProps<typeof ToolbarPrimitive.Input>;

/** The props of `Toolbar.Group`: Base UI's toolbar group, with `disabled`. */
export type ToolbarGroupProps = ComponentProps<typeof ToolbarPrimitive.Group>;

/** The props of `Toolbar.Separator`: Base UI's toolbar separator, perpendicular to the toolbar by default. */
export type ToolbarSeparatorProps = ComponentProps<typeof ToolbarPrimitive.Separator>;

/**
 * A row of controls that is one Tab stop, the arrow keys moving focus between its items and
 * wrapping at the ends unless `loopFocus` is false. It is the bar's surface: a bordered popover
 * fill with `p-1` and a small gap, a column when `orientation="vertical"`. It rounds with
 * `rounded-lg` and publishes `--inner-corner`, that corner less its border and padding, so an item
 * that rounds with `rounded-inner` sits concentric in it.
 */
export function ToolbarRoot({ className, ...props }: ToolbarRootProps): ReactElement {
  return (
    <ToolbarPrimitive.Root
      data-slot="toolbar"
      className={mergeClassName(className, slots.root())}
      {...props}
    />
  );
}

/**
 * A button in the toolbar's focus order. It has no look of its own: render the control that
 * shows it, such as `render={<Button variant="ghost" size="sm" />}`, a `ToggleGroup.Item`, or a
 * `Popover.Trigger` or `DropdownMenu.Trigger`. A tooltip goes the other way round: pass the
 * `Toolbar.Button` to `Tooltip.Trigger`'s `render`. A disabled button stays focusable, so the
 * arrow keys still reach it, unless `focusableWhenDisabled` is false.
 */
export function ToolbarButton(props: ToolbarButtonProps): ReactElement {
  return <ToolbarPrimitive.Button data-slot="toolbar-button" {...props} />;
}

/** A link in the toolbar's focus order. It has no look of its own; style the anchor it renders. */
export function ToolbarLink(props: ToolbarLinkProps): ReactElement {
  return <ToolbarPrimitive.Link data-slot="toolbar-link" {...props} />;
}

/**
 * A text input in the toolbar's focus order, such as `render={<Input />}`. It has no look of its
 * own. The arrow keys move its caret as well as the toolbar's focus, so a horizontal toolbar takes
 * one input, as its last item.
 */
export function ToolbarInput(props: ToolbarInputProps): ReactElement {
  return <ToolbarPrimitive.Input data-slot="toolbar-input" {...props} />;
}

/**
 * Items that belong together, laid out in a row with a small gap, a column in a vertical toolbar.
 * `disabled` disables every item in it. Name it with `aria-label`.
 */
export function ToolbarGroup({ className, ...props }: ToolbarGroupProps): ReactElement {
  return (
    <ToolbarPrimitive.Group
      data-slot="toolbar-group"
      className={mergeClassName(className, slots.group())}
      {...props}
    />
  );
}

/**
 * Separator's hairline between items, across the toolbar: vertical in a horizontal toolbar and
 * horizontal in a vertical one, 4px short of the items' edges at each end.
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
