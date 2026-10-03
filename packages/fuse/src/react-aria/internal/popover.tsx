"use client";

import { useCallback, useState } from "react";
import type { ReactElement, ReactNode, RefObject } from "react";

import {
  Popover as AriaPopover,
  OverlayArrow,
  PopoverContext,
  composeRenderProps,
  useSlottedContext,
} from "react-aria-components";
import type { PopoverProps as AriaPopoverProps } from "react-aria-components";
import { tv } from "tailwind-variants";

import { overlayLayer, overlayPopupFillClass } from "../../components/overlay/overlay-classes";
import type { OverlayContainerProps } from "../../components/overlay/overlay-props";
import { cn } from "../../styles/cn";
import { useResolvedPortalContainer } from "../../theme/theme-scope-container";

/**
 * React Aria's `useOverlayPosition` gutter, in px per side. The popover portals out of
 * the picker root, so a container query cannot see the field's width and React Aria's
 * positioning gutter is the one honest number; the CSS clamp below must reserve exactly
 * this gutter on both sides.
 */
export const CONTAINER_PADDING = 12;

/**
 * The width clamp, reserving one `CONTAINER_PADDING` gutter per side. The arbitrary value
 * is a literal because Tailwind's source scan resolves no interpolation; `popover.test.ts`
 * pins the literal to `CONTAINER_PADDING` so the pair can only change together.
 */
export const POPOVER_MAX_WIDTH_CLASS = cn("max-w-[calc(100vw-24px)]");

const popoverVariants = tv({
  slots: {
    // Fill from the spine; border stays local — overlayPopupSurfaceClass paints the
    // hairline ring, and twMerge cannot subtract `ring-foreground/10` (overlay-classes.ts).
    base: cn(
      overlayPopupFillClass,
      "shadow-md min-w-32 origin-(--trigger-anchor-point) rounded-md border border-border bg-clip-padding",
      POPOVER_MAX_WIDTH_CLASS,
      overlayLayer
    ),
    arrow: "group my-0!",
    arrowSvg:
      "block fill-popover stroke-border stroke-1 group-placement-left:-rotate-90 group-placement-right:rotate-90 group-placement-bottom:rotate-180",
    entering:
      "animate-in fade-in-0 placement-left:slide-in-from-right-2 placement-right:slide-in-from-left-2 placement-top:slide-in-from-bottom-2 placement-bottom:slide-in-from-top-2",
    exiting:
      "animate-out fade-out-0 placement-left:slide-out-to-right-2 placement-right:slide-out-to-left-2 placement-top:slide-out-to-bottom-2 placement-bottom:slide-out-to-top-2",
  },
});

/** Resolved once at module scope — the recipe has no axes (no per-render work). */
const popoverSlots = popoverVariants();
const popoverBaseClass = popoverSlots.base();
const popoverArrowClass = popoverSlots.arrow();
const popoverArrowSvgClass = popoverSlots.arrowSvg();
const popoverEnteringClass = popoverSlots.entering();
const popoverExitingClass = popoverSlots.exiting();

type Placement = NonNullable<AriaPopoverProps["placement"]>;

type Side = "top" | "bottom";

const CROSS_ALIGNMENTS = ["left", "right", "start", "end"] as const;

type CrossAlignment = (typeof CROSS_ALIGNMENTS)[number];

function isCrossAlignment(value: string | undefined): value is CrossAlignment {
  return CROSS_ALIGNMENTS.some((alignment) => alignment === value);
}

/** `placement` moved to `side`, keeping its cross-axis alignment. */
function placementOnSide(placement: Placement, side: Side): Placement {
  const cross = placement.split(" ")[1];
  return isCrossAlignment(cross) ? `${side} ${cross}` : side;
}

/**
 * The side of the trigger with room for `popover` inside the part of `container` the viewport
 * shows, preferring bottom; the roomier side when neither fits. `undefined` when the trigger is
 * not attached or `container` does not clip its overflow, so React Aria's own flip against the
 * viewport stays in charge.
 */
function sideWithRoom(
  triggerRef: RefObject<Element | null> | undefined,
  container: Element,
  popover: HTMLElement,
  offset: number
): Side | undefined {
  const trigger = triggerRef?.current;
  if (trigger == null || getComputedStyle(container).overflowY === "visible") {
    return undefined;
  }
  const bounds = container.getBoundingClientRect();
  const { top, bottom } = trigger.getBoundingClientRect();
  const visibleTop = Math.max(bounds.top, 0);
  const visibleBottom = Math.min(bounds.bottom, container.ownerDocument.documentElement.clientHeight);
  const needed = popover.scrollHeight + offset;
  const below = visibleBottom - bottom;
  const above = top - visibleTop;
  return below >= needed || below >= above ? "bottom" : "top";
}

export type PopoverProps = Omit<
  AriaPopoverProps,
  "children" | "containerPadding" | "UNSTABLE_portalContainer"
> & {
  showArrow?: boolean;
  children: ReactNode;
  container?: OverlayContainerProps["container"];
};

/**
 * The interim tier's popover surface. Package-private: the RAC
 * Popover was dropped from the public surface entirely, and the public popover is the
 * base-ui entry.
 *
 * OverlayPortal cannot wrap this popover: RAC has no Portal component and instead
 * takes `UNSTABLE_portalContainer` on the popover itself. The wait-not-body rule
 * still runs through {@link useResolvedPortalContainer}; this is the documented
 * exception.
 *
 * It carries no overlay-container stamp. That stamp existed solely so the private RAC
 * `Modal`'s `shouldCloseOnInteractOutside` could recognise its own popovers; the modal
 * stack was replaced by the shared picker shell, and the public base-ui
 * `Dialog` that now hosts a picker tracks nesting through the React tree instead.
 */
export function Popover({
  children,
  className,
  container,
  offset = 8,
  placement,
  showArrow = true,
  ...props
}: PopoverProps): ReactElement | null {
  const resolvedContainer = useResolvedPortalContainer(container);
  const context = useSlottedContext(PopoverContext);
  const triggerRef = context?.triggerRef;
  const requested = placement ?? context?.placement ?? "bottom";
  // React Aria 3.52.1's `calculatePosition` adds a boundary's page coordinates to the
  // trigger's coordinates in the popover's containing block, so inside a positioned scope that
  // clips its overflow it misjudges the room on each side and never flips. Fuse picks the
  // vertical side itself there, as the popover mounts, and turns React Aria's flip off. The ref
  // runs before React Aria's positioning layout effect, and the update lands before paint. The
  // side is kept with the container it was measured in, so a changed or removed container
  // returns the choice to React Aria until the next mount measures again.
  const [measured, setMeasured] = useState<{ container: Element; side: Side | undefined }>();
  const measureSide = useCallback(
    (popover: HTMLElement | null) => {
      if (popover !== null && resolvedContainer != null) {
        setMeasured({
          container: resolvedContainer,
          side: sideWithRoom(triggerRef, resolvedContainer, popover, offset),
        });
      }
    },
    [offset, resolvedContainer, triggerRef]
  );
  const vertical = requested.startsWith("top") || requested.startsWith("bottom");
  const chosen =
    vertical && measured !== undefined && measured.container === resolvedContainer
      ? measured.side
      : undefined;
  const positioning: Pick<AriaPopoverProps, "placement" | "shouldFlip"> = { placement: requested };
  if (chosen !== undefined) {
    positioning.placement = placementOnSide(requested, chosen);
    positioning.shouldFlip = false;
  }

  if (resolvedContainer === null) {
    return null;
  }

  return (
    <AriaPopover
      offset={offset}
      UNSTABLE_portalContainer={resolvedContainer}
      {...props}
      ref={measureSide}
      {...positioning}
      containerPadding={CONTAINER_PADDING}
      className={composeRenderProps(className, (resolved: string | undefined, renderProps) =>
        cn(
          popoverBaseClass,
          renderProps.isEntering && popoverEnteringClass,
          renderProps.isExiting && popoverExitingClass,
          resolved
        )
      )}>
      {showArrow ? (
        <OverlayArrow className={popoverArrowClass}>
          <svg width={12} height={12} viewBox="0 0 12 12" className={popoverArrowSvgClass}>
            <path d="M0 0 L6 6 L12 0" />
          </svg>
        </OverlayArrow>
      ) : null}
      {children}
    </AriaPopover>
  );
}

Popover.displayName = "ReactAriaInternal.Popover";
