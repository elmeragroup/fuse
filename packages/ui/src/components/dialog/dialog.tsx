"use client";

import type { ComponentProps, ReactElement } from "react";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { tv } from "tailwind-variants";
import type { VariantProps } from "tailwind-variants";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { cn } from "../../styles/cn";
import { selfFocusRingClass } from "../../styles/utils";
import { useResolvedPortalContainer } from "../../theme/use-resolved-portal-container";
import { overlayCloseStrings } from "../overlay/intl";
import {
  overlayFooterClass,
  overlayLayer,
  overlayPopupSurfaceClass,
  overlayScrimClass,
  overlaySizeClasses,
  overlayTitleClass,
} from "../overlay/overlay-classes";
import { overlayCornerCloseButton, overlayFooterCloseButton } from "../overlay/overlay-close-button";
import type { OverlayContainerProps } from "../overlay/overlay-props";

const dialogContentVariants = tv({
  // The shared popup surface supplies the fill, the ring, and a radius rung; Dialog
  // raises the elevation to `shadow-lg` and the radius to `rounded-xl` through the
  // later `cn` argument (dialog.md §4). The keyframe set stays local: Dialog is not an
  // anchored popup, so it takes neither the transform origin nor the per-side slide-ins
  // that `overlayPopupMotionClass` carries, and its `duration-100` rides with them.
  base: cn(
    overlayPopupSurfaceClass,
    "text-sm shadow-lg fixed top-1/2 left-1/2 grid max-h-[calc(100%-2rem)] w-full -translate-x-1/2 -translate-y-1/2 gap-6 overflow-y-auto rounded-xl p-6 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
    overlayLayer,
    selfFocusRingClass
  ),
  variants: {
    // The 13-value axis is shared with the interim RAC Modal (dialog.md §4).
    size: overlaySizeClasses,
  },
  defaultVariants: {
    size: "md",
  },
});

function DialogRoot(props: ComponentProps<typeof DialogPrimitive.Root>): ReactElement {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Trigger>): ReactElement {
  return (
    <DialogPrimitive.Trigger
      data-slot="dialog-trigger"
      className={cn(selfFocusRingClass, className)}
      {...props}
    />
  );
}

function DialogPortal(props: ComponentProps<typeof DialogPrimitive.Portal>): ReactElement {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ className, ...props }: ComponentProps<typeof DialogPrimitive.Close>): ReactElement {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className={cn(selfFocusRingClass, className)}
      {...props}
    />
  );
}

function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Backdrop>): ReactElement {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        overlayScrimClass,
        "fixed inset-0 isolate duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        overlayLayer,
        className
      )}
      {...props}
    />
  );
}

/**
 * `OverlayContainerProps` is intersected **between** `showCloseButton` and `closeLabel`
 * rather than appended: the docs API pipeline derives `Dialog.Content.propOrder` from
 * the intersection order, and the shadow snapshot pins it as
 * `size, showCloseButton, container, closeLabel`. Keep the order as written.
 */
export type DialogContentProps = ComponentProps<typeof DialogPrimitive.Popup> &
  VariantProps<typeof dialogContentVariants> & {
    /**
     * Renders the built-in corner dismiss affordance — a `Dialog.Close` styled as a
     * ghost icon button in the popup's top-right corner.
     */
    showCloseButton?: boolean;
  } & OverlayContainerProps & {
    /**
     * Accessible name for the built-in corner close button. Defaults to the locale
     * dictionary.
     */
    closeLabel?: string;
  };

function DialogContent({
  className,
  children,
  showCloseButton = true,
  size,
  container,
  closeLabel,
  ...props
}: DialogContentProps): ReactElement | null {
  const strings = useLocalizedStrings(overlayCloseStrings);
  const resolvedContainer = useResolvedPortalContainer(container);

  if (resolvedContainer === null) {
    return null;
  }

  const label = closeLabel ?? strings.format("close");

  return (
    <DialogPortal container={resolvedContainer}>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(dialogContentVariants({ size }), className)}
        {...props}>
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close data-slot="dialog-close" render={overlayCornerCloseButton({ label })} />
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />;
}

export type DialogFooterProps = ComponentProps<"div"> & {
  /**
   * Appends a `Dialog.Close` rendered as an outline button after `children` — a footer
   * action, distinct from `Dialog.Content`'s corner dismiss affordance.
   */
  showCloseButton?: boolean;
  /** Visible text for the built-in footer close action. Defaults to the locale dictionary. */
  closeLabel?: string;
};

function DialogFooter({
  className,
  showCloseButton = false,
  closeLabel,
  children,
  ...props
}: DialogFooterProps): ReactElement {
  const strings = useLocalizedStrings(overlayCloseStrings);
  const label = closeLabel ?? strings.format("close");

  return (
    <div data-slot="dialog-footer" className={cn(overlayFooterClass, className)} {...props}>
      {children}
      {showCloseButton ? <DialogPrimitive.Close render={overlayFooterCloseButton({ label })} /> : null}
    </div>
  );
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>): ReactElement {
  return (
    <DialogPrimitive.Title data-slot="dialog-title" className={cn(overlayTitleClass, className)} {...props} />
  );
}

function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>): ReactElement {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-pretty text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}

DialogRoot.displayName = "Dialog.Root";
DialogTrigger.displayName = "Dialog.Trigger";
DialogPortal.displayName = "Dialog.Portal";
DialogClose.displayName = "Dialog.Close";
DialogOverlay.displayName = "Dialog.Overlay";
DialogContent.displayName = "Dialog.Content";
DialogHeader.displayName = "Dialog.Header";
DialogFooter.displayName = "Dialog.Footer";
DialogTitle.displayName = "Dialog.Title";
DialogDescription.displayName = "Dialog.Description";

export const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Portal: DialogPortal,
  Close: DialogClose,
  Overlay: DialogOverlay,
  Content: DialogContent,
  Header: DialogHeader,
  Footer: DialogFooter,
  Title: DialogTitle,
  Description: DialogDescription,
};
