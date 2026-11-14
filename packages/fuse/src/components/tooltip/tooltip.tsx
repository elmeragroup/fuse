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
   * The open delay for every tooltip in the group, in milliseconds. It defaults to `0`, where
   * Base UI's own default is 600ms. Once one tooltip in the group has opened, the next one
   * opens without the delay if the first closed less than `timeout` ago, 400ms by default.
   */
  delay?: number;
};

/** Groups tooltips so they share an open delay. */
export function TooltipProvider({ delay = 0, ...props }: TooltipProviderProps): ReactElement {
  return <TooltipPrimitive.Provider delay={delay} {...props} />;
}

export type TooltipRootProps = ComponentProps<typeof TooltipPrimitive.Root> & {
  /**
   * This tooltip's open delay, in milliseconds. Setting it wraps the tooltip in a provider of
   * its own, so it leaves the outer `Tooltip.Provider`'s group. It no longer takes that group's
   * delay, and moving to it from another tooltip does not skip the wait.
   */
  delay?: number;
};

/** Holds one tooltip's open state and connects its trigger to its popup. */
export function TooltipRoot({ delay, ...props }: TooltipRootProps): ReactElement {
  const generatedId = useId();
  const [mountedId, setMountedId] = useState<string | null>(null);
  const description = useMemo(() => ({ generatedId, mountedId, setMountedId }), [generatedId, mountedId]);
  // Base-ui puts per-tooltip delay on a scoped Provider. The nested group is
  // intentional: this tooltip opts out of the outer Provider's skip-delay hand-off.
  const root = (
    <TooltipDescriptionContext.Provider value={description}>
      <TooltipPrimitive.Root {...props} />
    </TooltipDescriptionContext.Provider>
  );
  if (delay !== undefined) {
    return <TooltipPrimitive.Provider delay={delay}>{root}</TooltipPrimitive.Provider>;
  }

  return root;
}

/**
 * Opens the tooltip on hover and focus. It renders a plain `button`; pass `render` to render
 * another element. While the tooltip is mounted, the trigger's `aria-describedby` names it,
 * after any ids you pass.
 */
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
    /** The popup's id, which the trigger's `aria-describedby` names while the popup is mounted. Unset, it is a generated id. */
    id?: ComponentProps<typeof TooltipPrimitive.Popup>["id"];
    /** The side of the trigger the popup opens on. */
    side?: ComponentProps<typeof TooltipPrimitive.Positioner>["side"];
  } & OverlayContainerProps;

/**
 * The tooltip popup, with its arrow, positioner and portal. It publishes `--inner-corner`, its
 * corner less its padding, for parts that round with `rounded-inner`.
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
