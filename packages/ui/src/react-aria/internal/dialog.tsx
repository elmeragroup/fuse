"use client";

import { use } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import {
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Heading,
  OverlayTriggerStateContext,
} from "react-aria-components";
import { tv } from "tailwind-variants";
import type { VariantProps } from "tailwind-variants";

import { dialogStrings } from "../../components/dialog/intl";
import { overlayFooterClass, overlayTitleClass } from "../../components/overlay/overlay-classes";
import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { X } from "../../icons/generated/x";
import { cn } from "../../styles/cn";
import { Button } from "./button";
import { Modal } from "./modal";

/**
 * The interim tier's styled dialog chrome (date-picker.md §2): RAC Dialog plus the
 * heading/close affordance the DatePicker popover renders with `closeButton={false}`.
 * Package-private — the public dialog family is the base-ui `@elmeragroup/ui/dialog`
 * entry and this module never reaches `package.json#exports`.
 *
 * The close copy is the locked `dialog.close` row of accessibility.md §4.1, read from
 * Dialog's own dictionary rather than re-declared here.
 */
const dialogVariants = tv({
  slots: {
    base: "relative max-h-[inherit] overflow-y-auto p-6 outline-none [[data-placement]>&]:p-4",
    header: "flex items-start justify-between gap-4",
    // Heading and footer borrow the public Dialog's literals (dialog.md §2) so the
    // interim tier cannot drift; the footer only adds its own top margin.
    heading: overlayTitleClass,
    content: "flex flex-col gap-4",
    footer: cn(overlayFooterClass, "mt-6"),
    closeButton: "hit-area-1",
    closeButtonIcon: "size-4",
  },
  variants: {
    variant: {
      bare: {
        heading: "sr-only",
        base: "p-0 [[data-placement]>&]:p-0",
        closeButton: "absolute top-0 right-0 z-10 m-4",
        content: "gap-0",
      },
    },
  },
  defaultVariants: {},
});

/**
 * Every part takes the same `variant` the composite takes, so the composite below can be
 * assembled from these parts instead of restating their markup and slot names.
 */
type DialogPartVariant = VariantProps<typeof dialogVariants>;

export function DialogHeader({
  className,
  variant,
  ...props
}: ComponentProps<"div"> & DialogPartVariant): ReactElement {
  const { header } = dialogVariants({ variant });
  return <div data-slot="dialog-header" className={cn(header(), className)} {...props} />;
}

export function DialogContent({
  className,
  variant,
  ...props
}: ComponentProps<"div"> & DialogPartVariant): ReactElement {
  const { content } = dialogVariants({ variant });
  return <div data-slot="dialog-content" className={cn(content(), className)} {...props} />;
}

export function DialogFooter({
  className,
  variant,
  ...props
}: ComponentProps<"div"> & DialogPartVariant): ReactElement {
  const { footer } = dialogVariants({ variant });
  return <div data-slot="dialog-footer" className={cn(footer(), className)} {...props} />;
}

export function DialogHeading({
  className,
  variant,
  ...props
}: ComponentProps<typeof Heading> & DialogPartVariant): ReactElement {
  const { heading } = dialogVariants({ variant });
  return <Heading slot="title" className={cn(heading(), className)} {...props} />;
}

/**
 * The dismiss affordance reads RAC's overlay-trigger state instead of the reference's
 * `children`-as-function form, so `children` stays a plain `ReactNode` and no runtime
 * `typeof` branch decides how to render a subtree.
 */
function DialogCloseButton({
  className,
  iconClassName,
  label,
}: {
  className: string;
  iconClassName: string;
  label: string;
}): ReactElement {
  const state = use(OverlayTriggerStateContext);

  return (
    <Button
      aria-label={label}
      className={className}
      onPress={() => {
        state?.close();
      }}
      size="icon-sm"
      variant="ghost">
      <X className={iconClassName} />
    </Button>
  );
}

export type DialogProps = Omit<ComponentProps<typeof AriaDialog>, "children"> &
  VariantProps<typeof dialogVariants> & {
    children?: ReactNode;
    title?: string;
    closeButton?: boolean;
    closeLabel?: string;
  };

/**
 * The styled dialog. The header row and the heading inside it are both conditional, and
 * that gating is what keeps an untitled dialog nameable.
 *
 * RAC's `Dialog` (`Dialog.mjs:84-97`) hands `useDialog` only the `aria-labelledby` that
 * arrived as a *prop*, and falls back to the `DialogContext` value — the name a
 * `DialogTrigger`, `useDatePicker` or `useDateRangePicker` publishes — only when nothing
 * resolves a `<Heading slot="title">`. `useDialog` resolves that slot through
 * `useSlotId`, which drops the id when no element claims it. So an always-rendered
 * heading, empty because there is no `title`, wins the name race and leaves the dialog
 * announced as nothing at all; rendering no heading lets the context name through.
 *
 * Skipping the whole header when there is neither a `title` nor a close button also
 * removes a 16 px phantom gap: `content` is `flex flex-col gap-4`, and an empty header as
 * its first child spends one gap on nothing. Both picker popovers are that case.
 */
export function Dialog({
  children,
  className,
  closeButton = true,
  closeLabel,
  title,
  variant,
  ...props
}: DialogProps): ReactElement {
  const strings = useLocalizedStrings(dialogStrings);
  const { base, closeButton: closeButtonClass, closeButtonIcon } = dialogVariants({ variant });
  const label = closeLabel ?? strings.format("close");

  return (
    <AriaDialog data-slot="dialog" {...props} className={cn(base(), className)}>
      <DialogContent variant={variant}>
        {title !== undefined || closeButton ? (
          <DialogHeader variant={variant}>
            {title !== undefined ? <DialogHeading variant={variant}>{title}</DialogHeading> : null}
            {closeButton ? (
              <DialogCloseButton
                className={closeButtonClass()}
                iconClassName={closeButtonIcon()}
                label={label}
              />
            ) : null}
          </DialogHeader>
        ) : null}
        {children}
      </DialogContent>
    </AriaDialog>
  );
}

export type DialogOverlayProps = ComponentProps<typeof Modal>;

export function DialogOverlay({
  isDismissable = true,
  position = "default",
  size = "lg",
  ...props
}: DialogOverlayProps): ReactElement | null {
  return (
    <Modal
      data-slot="dialog-overlay"
      isDismissable={isDismissable}
      position={position}
      size={size}
      {...props}
    />
  );
}

export const DialogTrigger = AriaDialogTrigger;

Dialog.displayName = "ReactAriaInternal.Dialog";
DialogContent.displayName = "ReactAriaInternal.DialogContent";
DialogFooter.displayName = "ReactAriaInternal.DialogFooter";
DialogHeader.displayName = "ReactAriaInternal.DialogHeader";
DialogHeading.displayName = "ReactAriaInternal.DialogHeading";
DialogOverlay.displayName = "ReactAriaInternal.DialogOverlay";

export { dialogVariants };
