"use client";

import type { ComponentProps, ReactElement } from "react";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { tv } from "tailwind-variants";
import type { VariantProps } from "tailwind-variants";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { handoff } from "../../internal/part-handoff";
import { cn } from "../../styles/cn";
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
import {
  OverlayCloseButton,
  OverlayFooterCloseButton,
  overlayCornerCloseClass,
} from "../overlay/overlay-close-button";
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

export function DialogRoot(props: ComponentProps<typeof DialogPrimitive.Root>): ReactElement {
  return <DialogPrimitive.Root {...handoff(props, { defaults: { "data-slot": "dialog" } })} />;
}

export function DialogTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>): ReactElement {
  return (
    <DialogPrimitive.Trigger
      {...handoff(props, { defaults: { "data-slot": "dialog-trigger" }, classes: [selfFocusRingClass] })}
    />
  );
}

export function DialogPortal(props: ComponentProps<typeof DialogPrimitive.Portal>): ReactElement {
  return <DialogPrimitive.Portal {...handoff(props, { defaults: { "data-slot": "dialog-portal" } })} />;
}

export function DialogClose(props: ComponentProps<typeof DialogPrimitive.Close>): ReactElement {
  return (
    <DialogPrimitive.Close
      {...handoff(props, { defaults: { "data-slot": "dialog-close" }, classes: [selfFocusRingClass] })}
    />
  );
}

export function DialogOverlay(props: ComponentProps<typeof DialogPrimitive.Backdrop>): ReactElement {
  return (
    <DialogPrimitive.Backdrop
      {...handoff(props, {
        defaults: { "data-slot": "dialog-overlay" },
        classes: [
          overlayScrimClass,
          "fixed inset-0 isolate duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
          overlayLayer,
        ],
      })}
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

export function DialogContent({
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
        {...handoff(props, {
          defaults: { "data-slot": "dialog-content" },
          classes: [dialogContentVariants({ size })],
        })}>
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            {...handoff(
              {},
              {
                defaults: { "data-slot": "dialog-close" },
                classes: [overlayCornerCloseClass],
                as: (partProps) => <OverlayCloseButton label={closeLabel} {...partProps} />,
              }
            )}
          />
        ) : null}
      </DialogPrimitive.Popup>
    </OverlayPortal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
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

export function DialogFooter({
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
      {showCloseButton ? (
        <DialogPrimitive.Close
          {...handoff({}, { as: (partProps) => <OverlayFooterCloseButton label={label} {...partProps} /> })}
        />
      ) : null}
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

export function DialogTitle({ isFocusable = false, tabIndex, ...props }: DialogTitleProps): ReactElement {
  return (
    <DialogPrimitive.Title
      {...handoff(
        // isFocusable owns the tab stop when set; otherwise the caller's tabIndex stands. It
        // can be undefined, so it rides the consumer argument by handoff's channel rule.
        { ...props, tabIndex: isFocusable ? -1 : tabIndex },
        {
          defaults: { "data-slot": "dialog-title" },
          classes: [overlayTitleClass, isFocusable && selfFocusRingClass],
        }
      )}
    />
  );
}

export function DialogDescription(props: ComponentProps<typeof DialogPrimitive.Description>): ReactElement {
  return (
    <DialogPrimitive.Description
      {...handoff(props, {
        defaults: { "data-slot": "dialog-description" },
        classes: [
          "text-sm text-pretty text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        ],
      })}
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
