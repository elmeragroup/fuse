"use client";

import { createContext, useContext, useMemo } from "react";
import type { ComponentProps, CSSProperties, ReactElement } from "react";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { controlMetrics } from "../../styles/control-size";
import { toggleVariants } from "../toggle/toggle-variants";

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
      style={{ "--gap": spacing, ...style }}
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

/** The toggle sizes, keyed by their control size. */
const CONTROL_SIZE_OF = { xs: "xs", sm: "sm", default: "md", lg: "lg" } as const;

/**
 * A segmented item's inset: the icon inset on both sides in place of the label inset, so
 * the joined segments sit tighter than free-standing toggles.
 */
function segmentInset(size: keyof typeof CONTROL_SIZE_OF): string {
  return controlMetrics({ size: CONTROL_SIZE_OF[size] }).iconInset();
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
        "shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:shadow-none focus:z-10 focus-visible:z-10 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-md group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-md group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-md group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-md group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t group-data-[spacing=0]/toggle-group:enabled-active:scale-100",
        toggleVariants({
          variant: resolvedVariant,
          size: resolvedSize,
        }),
        context.spacing === 0 && segmentInset(resolvedSize ?? "default"),
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
