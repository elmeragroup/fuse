"use client";

import { useLayoutEffect, useState } from "react";
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

/** The vertical sum of `top` and `bottom` lengths read from `style`, in px. */
function verticalSum(style: CSSStyleDeclaration, top: string, bottom: string): number {
  return Number.parseFloat(style.getPropertyValue(top)) + Number.parseFloat(style.getPropertyValue(bottom));
}

/** The private `Dialog` a picker renders as the popup's direct child, or `null` without one. */
function dialogOf(popover: HTMLElement): HTMLElement | null {
  return popover.querySelector<HTMLElement>(':scope > [data-slot="dialog"]');
}

/**
 * The height `popover` needs to show its content whole, whichever side it sits on. React Aria
 * limits the popover with an inline `max-height` sized to the room on its current side, so the
 * popover's own height shrinks with that room; its `scrollHeight` also counts the arrow, which
 * pokes out only on the top side. The dialog inherits the limit and scrolls instead, so its
 * `scrollHeight` stays the content's full height; adding its border and the popover's padding
 * and border gives the popup's natural height on either side. A popup without the dialog falls
 * back to its own `scrollHeight`.
 */
function naturalHeight(popover: HTMLElement): number {
  const dialog = dialogOf(popover);
  const view = popover.ownerDocument.defaultView;
  if (dialog === null || view === null) {
    return popover.scrollHeight;
  }
  const popoverStyle = view.getComputedStyle(popover);
  return (
    dialog.scrollHeight +
    verticalSum(view.getComputedStyle(dialog), "border-top-width", "border-bottom-width") +
    verticalSum(popoverStyle, "padding-top", "padding-bottom") +
    verticalSum(popoverStyle, "border-top-width", "border-bottom-width")
  );
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
  // React Aria clamps the popover to the room on its side less one `CONTAINER_PADDING` gutter,
  // on either side, so the content shows whole only when the room also covers the gutter.
  const needed = naturalHeight(popover) + offset + CONTAINER_PADDING;
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
  // vertical side itself there and turns React Aria's flip off. The layout effect measures as
  // the popover mounts, before paint, then again whenever the viewport, container, trigger,
  // popup or dialog content changes size, so a shrinking viewport moves an open calendar to the
  // side that still has room. State changes only when the side does; the side depends on the
  // popup's natural height, which neither the room nor the placement changes, so a flip cannot
  // measure its way back. The side is kept with the container it was measured in, so a changed
  // or removed container returns the choice to React Aria until the effect measures again.
  const [popover, setPopover] = useState<HTMLElement | null>(null);
  const [measured, setMeasured] = useState<{ container: Element; side: Side | undefined }>();
  useLayoutEffect(() => {
    if (popover === null || resolvedContainer == null) {
      return undefined;
    }
    const measure = () => {
      const side = sideWithRoom(triggerRef, resolvedContainer, popover, offset);
      setMeasured((previous) =>
        previous?.container === resolvedContainer && previous.side === side
          ? previous
          : { container: resolvedContainer, side }
      );
    };
    measure();
    const view = popover.ownerDocument.defaultView;
    const observer = new ResizeObserver(measure);
    // The dialog's content box grows with the content even while the clamped popup cannot.
    const content = dialogOf(popover)?.firstElementChild;
    for (const element of [resolvedContainer, triggerRef?.current, popover, content]) {
      if (element != null) {
        observer.observe(element);
      }
    }
    view?.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      view?.removeEventListener("resize", measure);
    };
  }, [offset, popover, resolvedContainer, triggerRef]);
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
      ref={setPopover}
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
