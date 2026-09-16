"use client";

import type { ComponentProps, ReactElement } from "react";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { tv } from "tailwind-variants";
import type { VariantProps } from "tailwind-variants";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { selfFocusRingClass } from "../../styles/utils";
import { overlayCloseStrings } from "../overlay/intl";
import {
  overlayFooterClass,
  overlayLayer,
  overlayPopupSurfaceClass,
  overlayScrimClass,
  overlaySizeVariants,
  overlayTitleClass,
} from "../overlay/overlay-classes";
import { OverlayCloseButton, overlayFooterCloseButton } from "../overlay/overlay-close-button";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps } from "../overlay/overlay-props";

const dialogContentVariants = tv({
  // The shared popup surface supplies the fill, the ring, and a radius rung; Dialog
  // raises the elevation to `shadow-lg` and the radius to `rounded-xl` through the
  // later `cn` argument. The keyframe set stays local: Dialog is not an
  // anchored popup, so it takes neither the transform origin nor the per-side slide-ins
  // that `overlayPopupMotionClass` carries, and its `duration-100` rides with them.
  base: cn(
    overlayPopupSurfaceClass,
    "text-sm shadow-lg fixed top-1/2 left-1/2 grid max-h-[calc(100%-2rem)] w-full max-w-(--overlay-width) -translate-x-1/2 -translate-y-1/2 gap-6 overflow-y-auto rounded-xl p-6 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
    overlayLayer,
    selfFocusRingClass
  ),
  variants: {
    // The 13-value overlay width axis, shared with Sheet.
    size: overlaySizeVariants.variants.size,
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
      className={mergeClassName(className, selfFocusRingClass)}
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
      className={mergeClassName(className, selfFocusRingClass)}
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
      className={mergeClassName(
        className,
        overlayScrimClass,
        "fixed inset-0 isolate duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        overlayLayer
      )}
      {...props}
    />
  );
}

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
  return (
    <OverlayPortal portal={DialogPortal} container={container}>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={mergeClassName(className, dialogContentVariants({ size }))}
        {...props}>
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={<OverlayCloseButton label={closeLabel} className="absolute top-4 right-4" />}
          />
        ) : null}
      </DialogPrimitive.Popup>
    </OverlayPortal>
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

export type DialogTitleProps = ComponentProps<typeof DialogPrimitive.Title> & {
  /**
   * Makes the heading a programmatic focus target: stamps `tabIndex={-1}` and paints the
   * shared self focus ring so the focused title is visible. For dialogs that pass the
   * title to `initialFocus` and open on its content.
   * @default false
   */
  isFocusable?: boolean;
};

function DialogTitle({ className, isFocusable = false, ...props }: DialogTitleProps): ReactElement {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={mergeClassName(className, overlayTitleClass, isFocusable && selfFocusRingClass)}
      {...props}
      // isFocusable owns the tab stop when set; otherwise the caller's tabIndex stands.
      tabIndex={isFocusable ? -1 : props.tabIndex}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>): ReactElement {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={mergeClassName(
        className,
        "text-sm text-pretty text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground"
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
