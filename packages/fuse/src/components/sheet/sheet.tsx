"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";
import { createContext, use } from "react";

import { Drawer as SheetPrimitive } from "@base-ui/react/drawer";
import type { VariantProps } from "tailwind-variants";

import { definedProps } from "../../internal/defined-props";
import { useOverlayRootOverride } from "../../internal/overlay-exclusion";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";
import {
  overlayLayer,
  overlayModalFillClass,
  overlayScrimClass,
  overlaySizeVariants,
  overlayTitleClass,
} from "../overlay/overlay-classes";
import { OverlayCloseButton } from "../overlay/overlay-close-button";
import { overlayCornerCloseClass } from "../overlay/overlay-corner-close-class";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps } from "../overlay/overlay-props";

/**
 * Maps each `side` to the primitive's `swipeDirection`, so a swipe toward the anchored edge
 * dismisses the sheet. The sheet derives the direction from `side` and never exposes it as a
 * prop of its own.
 */
export const SIDE_TO_SWIPE_DIRECTION = {
  top: "up",
  right: "right",
  bottom: "down",
  left: "left",
} as const;

type SheetSide = keyof typeof SIDE_TO_SWIPE_DIRECTION;

const SheetSideContext = createContext<SheetSide>("right");

const sheetContentVariants = tv({
  base: cn(
    overlayModalFillClass,
    // The `size` axis below sets `--overlay-width`. These two selectors apply the cap to the
    // left and right sides from `sm` up, so the axis needs no per-side copy of each size.
    "data-[side=left]:sm:max-w-(--overlay-width) data-[side=right]:sm:max-w-(--overlay-width)",
    "text-sm shadow-lg ease-out pointer-events-auto fixed bg-clip-padding transition-transform duration-200 data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*150ms)] data-ending-style:ease-[cubic-bezier(0.23,1,0.32,1)] data-swiping:transition-none data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:[transform:translateY(var(--drawer-swipe-movement-y,0px))] data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:[transform:translateY(100%)] data-[side=bottom]:data-starting-style:[transform:translateY(100%)] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-full data-[side=left]:[transform:translateX(var(--drawer-swipe-movement-x,0px))] data-[side=left]:border-r data-[side=left]:data-ending-style:[transform:translateX(-100%)] data-[side=left]:data-starting-style:[transform:translateX(-100%)] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-full data-[side=right]:[transform:translateX(var(--drawer-swipe-movement-x,0px))] data-[side=right]:border-l data-[side=right]:data-ending-style:[transform:translateX(100%)] data-[side=right]:data-starting-style:[transform:translateX(100%)] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:[transform:translateY(var(--drawer-swipe-movement-y,0px))] data-[side=top]:border-b data-[side=top]:data-ending-style:[transform:translateY(-100%)] data-[side=top]:data-starting-style:[transform:translateY(-100%)]"
  ),
  variants: {
    // The base selectors above apply it to the left and right sides from `sm` up. Top and
    // bottom panels are `h-auto` and full width, so the axis does nothing for them.
    size: overlaySizeVariants.variants.size,
  },
  defaultVariants: {
    size: "md",
  },
});

export type SheetRootProps = Omit<
  ComponentProps<typeof SheetPrimitive.Root>,
  "swipeDirection" | "children"
> & {
  /**
   * The screen edge the panel slides in from. On touch, a swipe toward that edge dismisses
   * the sheet.
   */
  side?: SheetSide;
  /**
   * The sheet's trigger and content. They render inside Base UI's `VirtualKeyboardProvider`,
   * which keeps the panel above the on-screen keyboard.
   */
  children?: ReactNode;
};

/** Holds the sheet's open state and side, and connects its trigger to its panel. */
export function SheetRoot({ side = "right", children, ...props }: SheetRootProps): ReactElement {
  // A sheet in a SkeletonReveal's ghost stays closed: its root would lock the page's scroll.
  const override = useOverlayRootOverride();
  return (
    <SheetSideContext value={side}>
      <SheetPrimitive.Root swipeDirection={SIDE_TO_SWIPE_DIRECTION[side]} {...props} {...override}>
        <SheetPrimitive.VirtualKeyboardProvider>{children}</SheetPrimitive.VirtualKeyboardProvider>
      </SheetPrimitive.Root>
    </SheetSideContext>
  );
}

/** Opens the sheet. It renders a plain `button`; pass `render` to render another element. */
export function SheetTrigger({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Trigger>): ReactElement {
  return (
    <SheetPrimitive.Trigger
      data-slot="sheet-trigger"
      className={mergeClassName(className, selfFocusRingClass)}
      {...props}
    />
  );
}

/** Closes the sheet. It renders a plain `button`; pass `render` to render another element. */
export function SheetClose({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Close>): ReactElement {
  return (
    <SheetPrimitive.Close
      data-slot="sheet-close"
      className={mergeClassName(className, selfFocusRingClass)}
      {...props}
    />
  );
}

/** Renders the scrim and panel in a portal. `Sheet.Content` renders one for you. */
export function SheetPortal(props: ComponentProps<typeof SheetPrimitive.Portal>): ReactElement {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

/** The scrim behind the panel. `Sheet.Content` renders one for you. */
export function SheetOverlay({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Backdrop>): ReactElement {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={mergeClassName(
        className,
        overlayScrimClass,
        "fixed inset-0 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:transition-none",
        overlayLayer
      )}
      {...props}
    />
  );
}

export type SheetContentProps = ComponentProps<typeof SheetPrimitive.Popup> &
  VariantProps<typeof sheetContentVariants> & {
    /**
     * The panel's maximum width on the `left` and `right` sides, from the `sm` breakpoint up.
     * `sm` to `7xl` cap it at Tailwind's container width of the same name, and `8xl`, `9xl` and
     * `10xl` at 1366px, 1536px and 1920px, never past 90% of the viewport's width. Below `sm`,
     * and always on the `top` and `bottom` sides, the panel is full width and `size` does nothing.
     */
    size?: VariantProps<typeof sheetContentVariants>["size"];
    /** Shows a close button, a ghost icon `Sheet.Close`, in the panel's top-right corner. */
    showCloseButton?: boolean;
  } & OverlayContainerProps & {
    /** The corner close button's accessible name. Unset, it reads `overlay.close` from the locale dictionary. */
    closeLabel?: string;
  };

/** The sheet panel, with its scrim and portal. */
export function SheetContent({
  className,
  children,
  size = "md",
  showCloseButton = true,
  container,
  closeLabel,
  ...props
}: SheetContentProps): ReactElement | null {
  const side = use(SheetSideContext);

  return (
    <OverlayPortal portal={SheetPortal} container={container}>
      <SheetOverlay />
      <SheetPrimitive.Viewport
        data-slot="sheet-viewport"
        // One stacking level for Overlay and Viewport: Popup sits inside
        // Viewport, so it does not stamp a third overlay layer.
        className={cn("pointer-events-none fixed inset-0", overlayLayer)}>
        <SheetPrimitive.Popup
          data-slot="sheet-content"
          data-side={side}
          className={mergeClassName(className, sheetContentVariants({ size }))}
          {...definedProps(props)}>
          <SheetPrimitive.Content
            data-slot="sheet-content-inner"
            className="flex h-full w-full flex-col gap-(--surface-gap-lg)">
            {children}
            {showCloseButton ? (
              <SheetPrimitive.Close
                data-slot="sheet-close"
                render={<OverlayCloseButton label={closeLabel} className={overlayCornerCloseClass} />}
              />
            ) : null}
          </SheetPrimitive.Content>
        </SheetPrimitive.Popup>
      </SheetPrimitive.Viewport>
    </OverlayPortal>
  );
}

/** Stacks the title and description at the top of the panel. */
export function SheetHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 px-(--surface-pad-lg) pt-(--surface-pad-lg)", className)}
      {...props}
    />
  );
}

/**
 * The panel's scrolling region. It takes the height the header and footer leave, so they stay
 * in place while the body scrolls.
 */
export function SheetBody({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      data-slot="sheet-body"
      className={cn(
        "min-h-0 flex-1 space-y-(--surface-gap-xl) overflow-y-auto px-(--surface-pad-lg)",
        className
      )}
      {...props}
    />
  );
}

/** The sheet's actions, stacked at the bottom of the panel. */
export function SheetFooter({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-(--surface-pad-lg)", className)}
      {...props}
    />
  );
}

/** The sheet's title, which names the panel. */
export function SheetTitle({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Title>): ReactElement {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={mergeClassName(className, overlayTitleClass)}
      {...props}
    />
  );
}

/** The sheet's description, which describes the panel. */
export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>): ReactElement {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={mergeClassName(className, "text-base text-pretty text-muted-foreground")}
      {...props}
    />
  );
}

SheetRoot.displayName = "Sheet.Root";
SheetTrigger.displayName = "Sheet.Trigger";
SheetClose.displayName = "Sheet.Close";
SheetPortal.displayName = "Sheet.Portal";
SheetOverlay.displayName = "Sheet.Overlay";
SheetContent.displayName = "Sheet.Content";
SheetHeader.displayName = "Sheet.Header";
SheetBody.displayName = "Sheet.Body";
SheetFooter.displayName = "Sheet.Footer";
SheetTitle.displayName = "Sheet.Title";
SheetDescription.displayName = "Sheet.Description";
