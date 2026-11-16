"use client";

import type { ComponentProps, ReactElement } from "react";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { VariantProps } from "tailwind-variants";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { definedProps } from "../../internal/defined-props";
import { useOverlayRootOverride } from "../../internal/overlay-exclusion";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { selfFocusRingClass } from "../../styles/utils";
import { overlayCloseStrings } from "../overlay/intl";
import { OverlayCloseButton, OverlayFooterCloseButton } from "../overlay/overlay-close-button";
import { overlayCornerCloseClass } from "../overlay/overlay-corner-close-class";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { BackdropBlurProps, OverlayContainerProps } from "../overlay/overlay-props";
import { dialogContentVariants, dialogVariants } from "./dialog-variants";

const slots = dialogVariants();

/** Holds the dialog's open state and connects its trigger to its popup. */
export function DialogRoot(props: ComponentProps<typeof DialogPrimitive.Root>): ReactElement {
  // A dialog in a SkeletonReveal's ghost stays closed: its root would lock the page's scroll.
  const override = useOverlayRootOverride();
  return <DialogPrimitive.Root {...props} {...override} />;
}

/** Opens the dialog. It renders a plain `button`; pass `render` to render another element. */
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

/** The portal that holds the scrim and popup. `Dialog.Content` already renders one. */
export function DialogPortal(props: ComponentProps<typeof DialogPrimitive.Portal>): ReactElement {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

/** Closes the dialog. It renders a plain `button`; pass `render` to render another element. */
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

/** Props for `Dialog.Overlay`. */
type DialogOverlayProps = ComponentProps<typeof DialogPrimitive.Backdrop> & BackdropBlurProps;

/** The scrim behind the popup. `Dialog.Content` already renders one. */
export function DialogOverlay({
  className,
  backdropBlur = true,
  ...props
}: DialogOverlayProps): ReactElement {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={mergeClassName(className, dialogVariants({ backdropBlur }).overlay())}
      {...props}
    />
  );
}

export type DialogContentProps = ComponentProps<typeof DialogPrimitive.Popup> & {
  /**
   * The popup's maximum width. `sm` to `7xl` cap it at Tailwind's container width of the same
   * name, and `8xl`, `9xl` and `10xl` at 1366px, 1536px and 1920px. The popup never grows
   * past 90% of the viewport's width.
   */
  size?: VariantProps<typeof dialogContentVariants>["size"];
  /** Whether the popup shows a close button, a ghost icon `Dialog.Close`, in its top-right corner. */
  showCloseButton?: boolean;
} & BackdropBlurProps &
  OverlayContainerProps & {
    /** The corner close button's accessible name. Defaults to `overlay.close` from the locale dictionary. */
    closeLabel?: string;
  };

/**
 * The dialog popup, with its scrim and portal. It publishes `--inner-corner`, its corner less its
 * padding, for parts that round with `rounded-inner`.
 */
export function DialogContent({
  className,
  children,
  showCloseButton = true,
  backdropBlur = true,
  size = "md",
  container,
  closeLabel,
  ...props
}: DialogContentProps): ReactElement | null {
  return (
    <OverlayPortal portal={DialogPortal} container={container}>
      <DialogOverlay backdropBlur={backdropBlur} />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={mergeClassName(className, dialogContentVariants({ size }))}
        {...definedProps(props)}>
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

/** Stacks the title and description. */
export function DialogHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="dialog-header" className={cn(slots.header(), className)} {...props} />;
}

export type DialogFooterProps = ComponentProps<"div"> & {
  /**
   * Whether the footer adds a close button, an outline `Dialog.Close`, after its children. It is
   * separate from `Dialog.Content`'s corner close button.
   */
  showCloseButton?: boolean;
  /** The footer close button's label. Defaults to `overlay.close` from the locale dictionary. */
  closeLabel?: string;
};

/** The dialog's actions, stacked on narrow screens and in an end-aligned row from `sm`. */
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
   * Whether the title can take focus from script. It sets `tabIndex={-1}` and shows a focus ring
   * while the title has focus. For long content, set it and pass the title's ref to
   * `Dialog.Content`'s `initialFocus`, so the dialog opens at the top of its content.
   */
  isFocusable?: boolean;
};

/** The dialog's title, which names the popup. */
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
      // When isFocusable is set it decides the tab stop; otherwise the caller's tabIndex applies.
      tabIndex={isFocusable ? -1 : tabIndex}
    />
  );
}

/** The dialog's description, which describes the popup. It underlines a link inside. */
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
