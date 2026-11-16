"use client";

import { createContext, useContext, useMemo } from "react";
import type { ComponentProps, CSSProperties, ReactElement } from "react";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { toggleVariants } from "../toggle/toggle-variants";
import { segmentedItemInset, toggleGroupVariants } from "./toggle-group-variants";

const slots = toggleGroupVariants();

type ToggleVariantProps = VariantProps<typeof toggleVariants>;

type ToggleGroupContextValue = ToggleVariantProps & {
  spacing?: number;
  orientation?: "horizontal" | "vertical";
};

// All-undefined default: standalone items fall through to toggleVariants defaults.
// Do not copy the ref's non-undefined createContext values.
const ToggleGroupContext = createContext<ToggleGroupContextValue>({});

export type ToggleGroupRootProps = Omit<
  ComponentProps<typeof ToggleGroupPrimitive>,
  "className" | "style"
> & {
  /** Extra classes for the group, merged last. */
  className?: string;
  /** Inline styles, merged after the `--gap` custom property the group sets from `spacing`. */
  style?: CSSProperties;
  /**
   * The space between items, in Tailwind spacing units. `0` joins the items into one segmented
   * control: they share their inner edges, and outline items share one border between
   * neighbours.
   * @default 2
   */
  spacing?: number;
  /**
   * The look of every item: `default` with no fill or border, or `outline` with a border. Unset,
   * the items take Toggle's `default`. An item's own `variant` wins.
   */
  variant?: ToggleVariantProps["variant"];
  /**
   * The size of every item: `xs`, `sm`, `default` or `lg`, where `default` is the `md` control
   * size. Unset, the items take Toggle's `default`. An item's own `size` wins.
   */
  size?: ToggleVariantProps["size"];
};

export type ToggleGroupItemProps = Omit<ComponentProps<typeof TogglePrimitive>, "className"> & {
  /** Extra classes for the item, merged after the group's and Toggle's. */
  className?: string;
  /** The item's look, which overrides the group's `variant`. */
  variant?: ToggleVariantProps["variant"];
  /** The item's size, which overrides the group's `size`. */
  size?: ToggleVariantProps["size"];
};

/**
 * A group of toggles built on Base UI's toggle group. Root shares `variant`, `size`, `spacing`
 * and `orientation` with its items through a module-private context, and each item draws with
 * Toggle's `toggleVariants`.
 */
export function ToggleGroupRoot({
  className,
  variant,
  size,
  spacing = 2,
  orientation = "horizontal",
  children,
  style,
  ...props
}: ToggleGroupRootProps): ReactElement {
  const contextValue = useMemo(
    (): ToggleGroupContextValue => ({ variant, size, spacing, orientation }),
    [variant, size, spacing, orientation]
  );

  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      data-orientation={orientation}
      style={{ "--gap": spacing, ...style }}
      className={cn(slots.root(), className)}
      orientation={orientation}
      {...props}>
      <ToggleGroupContext.Provider value={contextValue}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
}

/** One toggle in the group. Its own `variant` and `size` win over the group's. */
export function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: ToggleGroupItemProps): ReactElement {
  const context = useContext(ToggleGroupContext);
  const resolvedVariant = variant ?? context.variant;
  const resolvedSize = size ?? context.size;

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={resolvedVariant ?? "default"}
      data-size={resolvedSize ?? "default"}
      data-spacing={context.spacing}
      className={cn(
        slots.item(),
        toggleVariants({
          variant: resolvedVariant,
          size: resolvedSize,
        }),
        context.spacing === 0 && segmentedItemInset({ size: resolvedSize }),
        className
      )}
      {...props}>
      {children}
    </TogglePrimitive>
  );
}

ToggleGroupRoot.displayName = "ToggleGroup.Root";
ToggleGroupItem.displayName = "ToggleGroup.Item";
