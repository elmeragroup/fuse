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

type ToggleGroupContextValue = VariantProps<typeof toggleVariants> & {
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
  /** Extra classes, merged last through `cn`. */
  className?: string;
  /** Inline styles, merged after the library's `--gap` custom property. */
  style?: CSSProperties;
  /**
   * Tailwind spacing units between items. `0` is segmented-control mode
   * @default 2
   */
  spacing?: number;
} & VariantProps<typeof toggleVariants>;

export type ToggleGroupItemProps = Omit<ComponentProps<typeof TogglePrimitive>, "className"> & {
  /** Extra classes, merged after group overrides + `toggleVariants`. */
  className?: string;
} & VariantProps<typeof toggleVariants>;

/**
 * Client toggle group over `@base-ui/react/toggle-group`.
 * Root publishes `variant` / `size` / `spacing` / `orientation` through
 * module-private context; Item borrows public `toggleVariants`.
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

/**
 * Group-aware toggle. Resolves `variant` / `size` as `itemProp ?? contextValue`
 * so an explicit item-level axis wins.
 */
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
