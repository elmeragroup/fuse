"use client";

import type { ReactElement, ReactNode, RefObject } from "react";

import {
  Popover as AriaPopover,
  OverlayArrow,
  DialogTrigger as PopoverTrigger,
  composeRenderProps,
} from "react-aria-components";
import type { PopoverProps as AriaPopoverProps } from "react-aria-components";
import { tv } from "tailwind-variants";

import { overlayLayer } from "../../components/overlay/overlay-classes";
import { cn } from "../../styles/cn";
import { useThemeScopeContainer } from "../../theme/theme-scope-container";
import { OVERLAY_CONTAINER_ATTR, OVERLAY_CONTAINER_POPOVER } from "./overlay-container";

const popoverVariants = tv({
  slots: {
    base: cn(
      "shadow-md min-w-32 origin-(--trigger-anchor-point) rounded-md border border-border bg-popover bg-clip-padding text-popover-foreground",
      overlayLayer
    ),
    arrow: "group my-0!",
    arrowSvg:
      "block fill-popover stroke-border stroke-1 group-placement-left:-rotate-90 group-placement-right:rotate-90 group-placement-bottom:rotate-180",
  },
  variants: {
    isEntering: {
      true: {
        base: "animate-in fade-in-0 placement-left:slide-in-from-right-2 placement-right:slide-in-from-left-2 placement-top:slide-in-from-bottom-2 placement-bottom:slide-in-from-top-2",
      },
      false: {},
    },
    isExiting: {
      true: {
        base: "animate-out fade-out-0 placement-left:slide-out-to-right-2 placement-right:slide-out-to-left-2 placement-top:slide-out-to-bottom-2 placement-bottom:slide-out-to-top-2",
      },
      false: {},
    },
  },
  defaultVariants: {
    isEntering: false,
    isExiting: false,
  },
});

export type PopoverProps = Omit<AriaPopoverProps, "children" | "UNSTABLE_portalContainer"> & {
  showArrow?: boolean;
  children: ReactNode;
  container?: HTMLElement | RefObject<HTMLElement | null>;
};

/**
 * The interim tier's popover surface (date-picker.md §2). Package-private: the RAC
 * Popover was dropped from the public surface entirely, and the public popover is the
 * base-ui entry.
 *
 * Two contracts live here:
 *  - It stamps `OVERLAY_CONTAINER_ATTR` so the private Modal's
 *    `shouldCloseOnInteractOutside` can recognise its own popovers (§6 locked ruling).
 *    The stamp is spread after `{...props}` because it is a containment invariant, not
 *    a consumer-overridable slot.
 *  - It resolves the portal target explicit `container` → nearest `ThemeScope` → RAC
 *    default (theming.md §7.4), forwarding the result to RAC's portal-container prop.
 *    A resolved `null` means the target exists but is not attached yet: the content
 *    waits rather than briefly escaping to `document.body`.
 */
export function Popover({
  children,
  className,
  container,
  offset = 8,
  showArrow = true,
  ...props
}: PopoverProps): ReactElement | null {
  const resolvedContainer = useThemeScopeContainer(container);
  const { arrow, arrowSvg } = popoverVariants();

  if (resolvedContainer === null) {
    return null;
  }

  return (
    <AriaPopover
      offset={offset}
      UNSTABLE_portalContainer={resolvedContainer}
      {...props}
      {...{ [OVERLAY_CONTAINER_ATTR]: OVERLAY_CONTAINER_POPOVER }}
      className={composeRenderProps(className, (resolved: string | undefined, renderProps) =>
        cn(
          popoverVariants({
            isEntering: renderProps.isEntering,
            isExiting: renderProps.isExiting,
          }).base(),
          resolved
        )
      )}>
      {showArrow ? (
        <OverlayArrow className={arrow()}>
          <svg width={12} height={12} viewBox="0 0 12 12" className={arrowSvg()}>
            <path d="M0 0 L6 6 L12 0" />
          </svg>
        </OverlayArrow>
      ) : null}
      {children}
    </AriaPopover>
  );
}

Popover.displayName = "ReactAriaInternal.Popover";

export { PopoverTrigger, popoverVariants };
