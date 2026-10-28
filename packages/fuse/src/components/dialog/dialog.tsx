"use client";

import type { ComponentProps, ReactElement } from "react";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { VariantProps } from "tailwind-variants";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { selfFocusRingClass } from "../../styles/utils";
import { overlayCloseStrings } from "../overlay/intl";
import { OverlayCloseButton, OverlayFooterCloseButton } from "../overlay/overlay-close-button";
import { overlayCornerCloseClass } from "../overlay/overlay-corner-close-class";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps } from "../overlay/overlay-props";
import { dialogContentVariants, dialogVariants } from "./dialog-variants";

const slots = dialogVariants();

export function DialogRoot(props: ComponentProps<typeof DialogPrimitive.Root>): ReactElement {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

export function DialogTrigger({
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

export function DialogPortal(props: ComponentProps<typeof DialogPrimitive.Portal>): ReactElement {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

export function DialogClose({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Close>): ReactElement {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className={mergeClassName(className, selfFocusRingClass)}
      {...props}
    />
  );
}

export function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Backdrop>): ReactElement {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={mergeClassName(className, slots.overlay())}
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

/**
 * The Dialog popup. It publishes `--inner-corner`, its corner less its padding, for parts that
 * round with `rounded-inner`.
 */
export function DialogContent({
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
            render={<OverlayCloseButton label={closeLabel} className={overlayCornerCloseClass} />}
          />
        ) : null}
      </DialogPrimitive.Popup>
    </OverlayPortal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="dialog-header" className={cn(slots.header(), className)} {...props} />;
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
    <div data-slot="dialog-footer" className={cn(slots.footer(), className)} {...props}>
      {children}
      {showCloseButton ? <DialogPrimitive.Close render={<OverlayFooterCloseButton label={label} />} /> : null}
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

export function DialogTitle({
  className,
  isFocusable = false,
  tabIndex,
  ...props
}: DialogTitleProps): ReactElement {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={mergeClassName(className, dialogVariants({ isFocusable }).title())}
      {...props}
      // isFocusable owns the tab stop when set; otherwise the caller's tabIndex stands.
      tabIndex={isFocusable ? -1 : tabIndex}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>): ReactElement {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={mergeClassName(className, slots.description())}
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
