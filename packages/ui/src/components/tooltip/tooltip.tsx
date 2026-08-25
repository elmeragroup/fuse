"use client";

import { createContext, use, useId } from "react";
import type { ComponentProps, ReactElement, RefObject } from "react";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";
import { useThemeScopeContainer } from "../../theme/theme-scope-container";
import { overlayLayer } from "../overlay/overlay-classes";

/** Resolved once at module scope — the recipe below does the same (no per-render work). */
const selfFocusRing = focusRing({ target: "self" }).root();

/** Shared popup id so the trigger's `aria-describedby` points at the tooltip (tooltip.md §7). */
const TooltipDescriptionContext = createContext<string | null>(null);

export type TooltipProviderProps = Omit<ComponentProps<typeof TooltipPrimitive.Provider>, "delay"> & {
  /**
   * Shared open delay for every tooltip in this group, in milliseconds. Instant by
   * default — the ref overrides base-ui's 600ms. Tooltips in this group also share
   * skip-delay hand-off: after one opens, moving to a neighbor skips the wait.
   * @default 0
   */
  delay?: number;
};

function TooltipProvider({ delay = 0, ...props }: TooltipProviderProps): ReactElement {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />;
}

export type TooltipRootProps = ComponentProps<typeof TooltipPrimitive.Root> & {
  /**
   * When set, wraps this Root in a nested scoped Provider with that delay. That
   * tooltip then forms its own provider group: it no longer participates in the
   * outer Provider's shared delay or skip-delay hand-off.
   */
  delay?: number;
};

function TooltipRoot({ delay, ...props }: TooltipRootProps): ReactElement {
  const tooltipId = useId();
  // Base-ui puts per-tooltip delay on a scoped Provider. The nested group is
  // intentional: this tooltip opts out of the outer Provider's skip-delay hand-off.
  const root = (
    <TooltipDescriptionContext.Provider value={tooltipId}>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipDescriptionContext.Provider>
  );
  if (delay !== undefined) {
    return <TooltipPrimitive.Provider delay={delay}>{root}</TooltipPrimitive.Provider>;
  }

  return root;
}

function TooltipTrigger({
  className,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Trigger>): ReactElement {
  const tooltipId = use(TooltipDescriptionContext);
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      aria-describedby={tooltipId ?? undefined}
      className={cn(selfFocusRing, className)}
      {...props}
    />
  );
}

export type TooltipContentProps = ComponentProps<typeof TooltipPrimitive.Popup> & {
  /**
   * How the popup aligns to the trigger on the cross axis.
   * @default "center"
   */
  align?: ComponentProps<typeof TooltipPrimitive.Positioner>["align"];
  /**
   * Offset along the alignment axis, in pixels.
   * @default 0
   */
  alignOffset?: ComponentProps<typeof TooltipPrimitive.Positioner>["alignOffset"];
  /**
   * Which side of the trigger the popup is placed on. Tooltips open upward by default.
   * @default "top"
   */
  side?: ComponentProps<typeof TooltipPrimitive.Positioner>["side"];
  /**
   * Distance from the trigger, in pixels.
   * @default 4
   */
  sideOffset?: ComponentProps<typeof TooltipPrimitive.Positioner>["sideOffset"];
  /**
   * Portal target for the popup. Defaults to the nearest enclosing `ThemeScope`
   * element, so an overlay never escapes the theme that opened it.
   */
  container?: HTMLElement | RefObject<HTMLElement | null>;
};

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  container,
  ...props
}: TooltipContentProps): ReactElement | null {
  const tooltipId = use(TooltipDescriptionContext);
  const resolvedContainer = useThemeScopeContainer(container);

  // theming.md §7.4: an explicit ref or an enclosing ThemeScope whose element is not
  // attached yet means wait — never a brief escape to the document body. Only an absent
  // scope (`undefined`) leaves the primitive default in place.
  if (resolvedContainer === null) {
    return null;
  }

  return (
    <TooltipPrimitive.Portal container={resolvedContainer}>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className={cn("isolate", overlayLayer)}>
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          id={tooltipId ?? undefined}
          role="tooltip"
          className={cn(
            "max-w-xs text-xs inline-flex w-fit origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-pretty text-background data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}>
          {children}
          <TooltipPrimitive.Arrow className="size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

TooltipProvider.displayName = "Tooltip.Provider";
TooltipRoot.displayName = "Tooltip.Root";
TooltipTrigger.displayName = "Tooltip.Trigger";
TooltipContent.displayName = "Tooltip.Content";

export const Tooltip = {
  Provider: TooltipProvider,
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Content: TooltipContent,
};
