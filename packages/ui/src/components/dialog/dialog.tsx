"use client";

import type { ComponentProps, ReactElement, RefObject } from "react";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { tv } from "tailwind-variants";
import type { VariantProps } from "tailwind-variants";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";
import { useThemeScopeContainer } from "../../theme/theme-scope-container";
import { overlayCornerCloseButton, overlayFooterCloseButton } from "../overlay/overlay-close-button";
import { dialogStrings } from "./intl";

/**
 * One overlay layer for the whole family (dialog.md §8.4): the ref stamps the level
 * on both Backdrop and Popup, we declare it once and share it, so DOM order — not a
 * second z-index step — stacks the Backdrop under the Popup.
 */
const overlayLayer = "z-50";

const dialogContentVariants = tv({
  base: cn(
    "text-sm shadow-lg fixed top-1/2 left-1/2 grid max-h-[calc(100%-2rem)] w-full -translate-x-1/2 -translate-y-1/2 gap-6 overflow-y-auto rounded-xl bg-popover p-6 text-popover-foreground ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
    overlayLayer,
    focusRing({ target: "self" }).root()
  ),
  variants: {
    size: {
      sm: "max-w-[min(var(--container-sm),90%)]",
      md: "max-w-[min(var(--container-md),90%)]",
      lg: "max-w-[min(var(--container-lg),90%)]",
      xl: "max-w-[min(var(--container-xl),90%)]",
      "2xl": "max-w-[min(var(--container-2xl),90%)]",
      "3xl": "max-w-[min(var(--container-3xl),90%)]",
      "4xl": "max-w-[min(var(--container-4xl),90%)]",
      "5xl": "max-w-[min(var(--container-5xl),90%)]",
      "6xl": "max-w-[min(var(--container-6xl),90%)]",
      "7xl": "max-w-[min(var(--container-7xl),90%)]",
      // No --container-8xl+ variables exist; the pixel caps stay literal (dialog.md §4).
      "8xl": "max-w-[min(1366px,90%)]",
      "9xl": "max-w-[min(1536px,90%)]",
      "10xl": "max-w-[min(1920px,90%)]",
    },
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
      className={cn(focusRing({ target: "self" }).root(), className)}
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
      className={cn(focusRing({ target: "self" }).root(), className)}
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
        "bg-black/10 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 isolate duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        overlayLayer,
        className
      )}
      {...props}
    />
  );
}

export type DialogContentProps = ComponentProps<typeof DialogPrimitive.Popup> &
  VariantProps<typeof dialogContentVariants> & {
    showCloseButton?: boolean;
    container?: HTMLElement | RefObject<HTMLElement | null>;
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
  const strings = useLocalizedStrings(dialogStrings);
  const resolvedContainer = useThemeScopeContainer(container);

  // theming.md §7.4: an explicit ref or an enclosing ThemeScope whose element is not
  // attached yet means wait — never a brief escape to the document body. Only an absent
  // scope (`undefined`) leaves the primitive default in place.
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
  showCloseButton?: boolean;
  closeLabel?: string;
};

function DialogFooter({
  className,
  showCloseButton = false,
  closeLabel,
  children,
  ...props
}: DialogFooterProps): ReactElement {
  const strings = useLocalizedStrings(dialogStrings);
  const label = closeLabel ?? strings.format("close");

  return (
    <div
      data-slot="dialog-footer"
      className={cn("sm:flex-row sm:justify-end flex flex-col-reverse gap-2", className)}
      {...props}>
      {children}
      {showCloseButton ? <DialogPrimitive.Close render={overlayFooterCloseButton({ label })} /> : null}
    </div>
  );
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>): ReactElement {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-base font-medium font-heading leading-none text-balance", className)}
      {...props}
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
