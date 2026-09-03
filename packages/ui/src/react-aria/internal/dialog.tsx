"use client";

import { use } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Dialog as AriaDialog, Heading, OverlayTriggerStateContext } from "react-aria-components";
import { tv } from "tailwind-variants";

import { dialogStrings } from "../../components/dialog/intl";
import { overlayTitleClass } from "../../components/overlay/overlay-classes";
import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { X } from "../../icons/generated/x";
import { cn } from "../../styles/cn";
import { Button } from "./button";

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
    // oxlint-disable-next-line elmera/no-local-focus-ring -- dialog.md §7: dialog surface; focusable descendants own the adapter
    base: "relative max-h-[inherit] overflow-y-auto p-6 outline-none [[data-placement]>&]:p-4",
    header: "flex items-start justify-between gap-4",
    // The heading borrows the public Dialog's literal (dialog.md §2) so the interim tier
    // cannot drift.
    heading: overlayTitleClass,
    content: "flex flex-col gap-4",
    closeButton: "hit-area-1",
    closeButtonIcon: "size-4",
  },
});

export function DialogHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
  const { header } = dialogVariants();
  return <div data-slot="dialog-header" className={cn(header(), className)} {...props} />;
}

export function DialogContent({ className, ...props }: ComponentProps<"div">): ReactElement {
  const { content } = dialogVariants();
  return <div data-slot="dialog-content" className={cn(content(), className)} {...props} />;
}

export function DialogHeading({ className, ...props }: ComponentProps<typeof Heading>): ReactElement {
  const { heading } = dialogVariants();
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

export type DialogProps = Omit<ComponentProps<typeof AriaDialog>, "children"> & {
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
  ...props
}: DialogProps): ReactElement {
  const strings = useLocalizedStrings(dialogStrings);
  const { base, closeButton: closeButtonClass, closeButtonIcon } = dialogVariants();
  const label = closeLabel ?? strings.format("close");

  return (
    <AriaDialog data-slot="dialog" {...props} className={cn(base(), className)}>
      <DialogContent>
        {title !== undefined || closeButton ? (
          <DialogHeader>
            {title !== undefined ? <DialogHeading>{title}</DialogHeading> : null}
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

Dialog.displayName = "ReactAriaInternal.Dialog";
DialogContent.displayName = "ReactAriaInternal.DialogContent";
DialogHeader.displayName = "ReactAriaInternal.DialogHeader";
DialogHeading.displayName = "ReactAriaInternal.DialogHeading";

export { dialogVariants };
