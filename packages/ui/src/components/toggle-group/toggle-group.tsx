"use client";

import { createContext, useContext, useMemo } from "react";
import type { ComponentProps, CSSProperties, ReactElement } from "react";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { toggleVariants } from "../toggle/toggle-variants";

type ToggleGroupContextValue = VariantProps<typeof toggleVariants> & {
  spacing?: number;
  orientation?: "horizontal" | "vertical";
};

// All-undefined default: standalone items fall through to toggleVariants defaults.
// Do not copy the ref's non-undefined createContext values.
const ToggleGroupContext = createContext<ToggleGroupContextValue>({});

export type ToggleGroupRootProps = Omit<ComponentProps<typeof ToggleGroupPrimitive>, "className"> & {
  /** Extra classes, merged last through `cn`. */
  className?: string;
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
function ToggleGroupRoot({
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
      // SAFETY: React's CSSProperties does not model custom properties; `--gap` is a plain number.
      style={{ "--gap": spacing, ...(style as CSSProperties | undefined) } as CSSProperties}
      className={cn(
        "group/toggle-group data-[spacing=0]:data-[variant=outline]:shadow-xs flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-md data-vertical:flex-col data-vertical:items-stretch",
        className
      )}
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
function ToggleGroupItem({
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
        "shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:shadow-none focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:active:scale-100 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-md group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-md group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-md group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-md group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
        toggleVariants({
          variant: resolvedVariant,
          size: resolvedSize,
        }),
        "group-data-[spacing=0]/toggle-group:data-[size=default]:px-(--control-px-icon-md) group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:data-[size=default]:pr-(--control-px-icon-md) group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:data-[size=default]:pl-(--control-px-icon-md) group-data-[spacing=0]/toggle-group:data-[size=lg]:px-(--control-px-icon-lg) group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:data-[size=lg]:pr-(--control-px-icon-lg) group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:data-[size=lg]:pl-(--control-px-icon-lg) group-data-[spacing=0]/toggle-group:data-[size=sm]:px-(--control-px-icon-sm) group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:data-[size=sm]:pr-(--control-px-icon-sm) group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:data-[size=sm]:pl-(--control-px-icon-sm) group-data-[spacing=0]/toggle-group:data-[size=xs]:px-(--control-px-icon-xs) group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:data-[size=xs]:pr-(--control-px-icon-xs) group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:data-[size=xs]:pl-(--control-px-icon-xs)",
        className
      )}
      {...props}>
      {children}
    </TogglePrimitive>
  );
}

ToggleGroupRoot.displayName = "ToggleGroup.Root";
ToggleGroupItem.displayName = "ToggleGroup.Item";

export const ToggleGroup = {
  Root: ToggleGroupRoot,
  Item: ToggleGroupItem,
};
