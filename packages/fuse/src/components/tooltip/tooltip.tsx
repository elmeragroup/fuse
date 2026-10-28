"use client";

import { createContext, use, useId, useLayoutEffect, useMemo, useState } from "react";
import type { ComponentProps, ReactElement } from "react";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { mergeClassName } from "../../styles/merge-class-name";
import { selfFocusRingClass } from "../../styles/utils";
import { overlayPositionerClass } from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps, OverlayPositionerProps } from "../overlay/overlay-props";
import { tooltipVariants } from "./tooltip-variants";

const slots = tooltipVariants();

/** Shared popup id so the trigger's `aria-describedby` points at the tooltip. */
type TooltipDescription = {
  generatedId: string;
  mountedId: string | null;
  setMountedId: (id: string | null) => void;
};
const TooltipDescriptionContext = createContext<TooltipDescription | null>(null);

export type TooltipProviderProps = Omit<ComponentProps<typeof TooltipPrimitive.Provider>, "delay"> & {
  /**
   * Shared open delay for every tooltip in this group, in milliseconds. Instant by
   * default — the ref overrides base-ui's 600ms. Tooltips in this group also share
   * skip-delay hand-off: after one opens, moving to a neighbor skips the wait.
   * @default 0
   */
  delay?: number;
};

export function TooltipProvider({ delay = 0, ...props }: TooltipProviderProps): ReactElement {
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

export function TooltipRoot({ delay, ...props }: TooltipRootProps): ReactElement {
  const generatedId = useId();
  const [mountedId, setMountedId] = useState<string | null>(null);
  const description = useMemo(() => ({ generatedId, mountedId, setMountedId }), [generatedId, mountedId]);
  // Base-ui puts per-tooltip delay on a scoped Provider. The nested group is
  // intentional: this tooltip opts out of the outer Provider's skip-delay hand-off.
  const root = (
    <TooltipDescriptionContext.Provider value={description}>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipDescriptionContext.Provider>
  );
  if (delay !== undefined) {
    return <TooltipPrimitive.Provider delay={delay}>{root}</TooltipPrimitive.Provider>;
  }

  return root;
}

export function TooltipTrigger({
  "aria-describedby": describedBy,
  className,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Trigger>): ReactElement {
  const description = use(TooltipDescriptionContext);
  const descriptionIds = [
    ...new Set([
      ...(describedBy?.split(/\s+/).filter(Boolean) ?? []),
      ...(description?.mountedId ? [description.mountedId] : []),
    ]),
  ].join(" ");
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      aria-describedby={descriptionIds || undefined}
      className={mergeClassName(className, selfFocusRingClass)}
      {...props}
    />
  );
}

export type TooltipContentProps = Omit<ComponentProps<typeof TooltipPrimitive.Popup>, "id"> &
  Omit<OverlayPositionerProps<ComponentProps<typeof TooltipPrimitive.Positioner>>, "side"> & {
    /** Popup id used in the trigger description while mounted. Defaults to a stable generated id. */
    id?: ComponentProps<typeof TooltipPrimitive.Popup>["id"];
    /**
     * Which side of the trigger the popup is placed on. Tooltips open upward by default.
     */
    side?: ComponentProps<typeof TooltipPrimitive.Positioner>["side"];
  } & OverlayContainerProps;

/**
 * The Tooltip popup. It publishes `--inner-corner`, its corner less its padding, for parts that
 * round with `rounded-inner`.
 */
export function TooltipContent({
  id,
  ref,
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  container,
  ...props
}: TooltipContentProps): ReactElement | null {
  const description = use(TooltipDescriptionContext);
  const tooltipId = id ?? description?.generatedId;
  const setMountedId = description?.setMountedId;
  const render = props.render;
  const [popup, setPopup] = useState<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs(ref, setPopup);
  useLayoutEffect(() => {
    if (!popup) return;
    setMountedId?.(popup.id);
    return () => setMountedId?.(null);
  }, [popup, setMountedId, tooltipId, render]);

  return (
    <OverlayPortal portal={TooltipPrimitive.Portal} container={container}>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className={overlayPositionerClass}>
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          ref={mergedRef}
          id={tooltipId ?? undefined}
          role="tooltip"
          className={mergeClassName(className, slots.popup())}
          {...props}>
          {children}
          <TooltipPrimitive.Arrow className={slots.arrow()} />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </OverlayPortal>
  );
}

TooltipProvider.displayName = "Tooltip.Provider";
TooltipRoot.displayName = "Tooltip.Root";
TooltipTrigger.displayName = "Tooltip.Trigger";
TooltipContent.displayName = "Tooltip.Content";
