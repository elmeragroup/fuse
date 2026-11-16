"use client";

import { useRef } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { Info } from "../../icons/generated/info";
import { WarningOctagon } from "../../icons/generated/warning-octagon";
import { useOverlayRootOverride } from "../../internal/overlay-exclusion";
import { Button } from "../button/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../dialog/dialog";
import type { DialogContentProps } from "../dialog/dialog";
import { alertDialogVariants } from "./alert-dialog-variants";
import { alertDialogStrings } from "./intl";

/**
 * Runs Base UI's alert-dialog mode, which is always modal and ignores backdrop clicks, so a
 * stray pointer cannot dismiss a confirmation the user must answer. Escape still closes it. Its
 * props type omits `modal` and `disablePointerDismissal`, so neither can be turned back on.
 * Trigger and Content render through the public Dialog parts, which read the same root
 * context, so they keep Dialog's self focus ring and its other behaviour with
 * `role="alertdialog"`.
 */
export function AlertDialogRoot(props: ComponentProps<typeof AlertDialogPrimitive.Root>): ReactElement {
  // An alert dialog in a SkeletonReveal's ghost stays closed: its root would lock the page's scroll.
  const override = useOverlayRootOverride();
  return <AlertDialogPrimitive.Root {...props} {...override} />;
}

/**
 * Opens the alert dialog. It passes its own `data-slot`, which wins because Dialog's parts
 * write theirs before they spread the rest.
 */
export function AlertDialogTrigger(props: ComponentProps<typeof AlertDialogPrimitive.Trigger>): ReactElement {
  return <DialogTrigger data-slot="alert-dialog-trigger" {...props} />;
}

export type AlertDialogContentProps = Omit<DialogContentProps, "showCloseButton" | "children"> & {
  /** The question the dialog asks, rendered in a `Dialog.Title`. */
  title: string;
  /**
   * The icon at the end of the title's first line. Unset, a `destructive` dialog shows
   * WarningOctagon and a `neutral` one shows Info.
   */
  icon?: ReactNode;
  /**
   * The kind of confirmation, which sets the action button's variant and the fallback icon. A
   * `destructive` dialog opens with focus on Cancel. A `neutral` one opens with focus on the
   * action, or on Cancel while `isActionDisabled` is set. Pass `initialFocus` to focus another
   * element; it wins over both.
   */
  variant?: "destructive" | "neutral";
  /**
   * What happens if the user confirms. It renders in a `Dialog.Description`, which the popup
   * names in `aria-describedby`.
   */
  children: ReactNode;
  /** The action button's label. */
  actionLabel: string;
  /** The cancel button's label. Unset, it reads `alertDialog.cancel` from the locale dictionary. */
  cancelLabel?: string;
  /**
   * Runs when the action button is clicked. The dialog stays open unless
   * `isAutomaticallyCloseOnActionEnabled` is set, so close it yourself when the action is done.
   */
  onAction?: () => void;
  /** Runs when the cancel button is clicked. Cancel always closes the dialog. */
  onCancel?: () => void;
  /**
   * Shows the action button as pending, as Button's `isPending` does. It sets `data-pending` and
   * blocks clicks. Cancel stays enabled.
   */
  isPerformingAction?: boolean;
  /** Disables the action button. Cancel stays enabled. */
  isActionDisabled?: boolean;
  /**
   * Closes the dialog when the action button is clicked. Leave it off for an action that can
   * fail, and close the dialog from `onAction` once the action succeeds.
   */
  isAutomaticallyCloseOnActionEnabled?: boolean;
};

/** The alert dialog's popup, with its title, icon, description, cancel button and action button. */
export function AlertDialogContent({
  title,
  icon,
  variant = "destructive",
  children,
  actionLabel,
  cancelLabel,
  onAction,
  onCancel,
  isPerformingAction = false,
  isActionDisabled = false,
  isAutomaticallyCloseOnActionEnabled = false,
  className,
  initialFocus,
  ...props
}: AlertDialogContentProps): ReactElement | null {
  const strings = useLocalizedStrings(alertDialogStrings);
  // One `initialFocus` on the popup, not two mirroring `autoFocus` booleans: destructive
  // confirmations land on Cancel, neutral ones on the primary action, and a caller's own
  // `initialFocus` wins over both. A disabled action is natively disabled and cannot take focus,
  // and Base UI does not fall back when `.focus()` does nothing, so a neutral confirmation with
  // its action disabled lands on Cancel too.
  const actionRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const fallbackFocus = variant === "destructive" || isActionDisabled ? cancelRef : actionRef;
  const slots = alertDialogVariants({ variant });
  const fallbackIcon =
    variant === "destructive" ? (
      <WarningOctagon className={slots.icon()} />
    ) : (
      <Info className={slots.icon()} />
    );

  const actionButton = (
    <Button
      ref={actionRef}
      size="sm"
      variant={variant === "destructive" ? "destructive" : "default"}
      isPending={isPerformingAction}
      disabled={isActionDisabled}
      onClick={onAction}
      data-dialog-action-type="primary">
      {actionLabel}
    </Button>
  );

  return (
    <DialogContent
      className={className}
      initialFocus={initialFocus ?? fallbackFocus}
      {...props}
      role="alertdialog"
      showCloseButton={false}>
      <DialogHeader className={slots.header()}>
        <DialogTitle className={slots.title()}>{title}</DialogTitle>
        <div className={slots.titleLine()}>{icon ?? fallbackIcon}</div>
      </DialogHeader>
      <DialogDescription>{children}</DialogDescription>
      <DialogFooter>
        <AlertDialogPrimitive.Close
          render={<Button ref={cancelRef} size="sm" variant="ghost" data-dialog-action-type="secondary" />}
          onClick={onCancel}>
          {cancelLabel ?? strings.format("cancel")}
        </AlertDialogPrimitive.Close>
        {isAutomaticallyCloseOnActionEnabled ? (
          <AlertDialogPrimitive.Close render={actionButton} />
        ) : (
          actionButton
        )}
      </DialogFooter>
    </DialogContent>
  );
}

AlertDialogRoot.displayName = "AlertDialog.Root";
AlertDialogTrigger.displayName = "AlertDialog.Trigger";
AlertDialogContent.displayName = "AlertDialog.Content";
