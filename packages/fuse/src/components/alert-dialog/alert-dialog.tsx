"use client";

import { useRef } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { Info } from "../../icons/generated/info";
import { WarningOctagon } from "../../icons/generated/warning-octagon";
import { Button } from "../button/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "../dialog/dialog";
import type { DialogContentProps } from "../dialog/dialog";
import { alertDialogStrings } from "./intl";

/**
 * AlertDialog is Dialog machinery with `role="alertdialog"`, so
 * Root and Trigger render through the public Dialog parts rather than reaching for the
 * primitive again — the self-focus ring and every other Dialog behaviour come with them.
 * Each restamps its own `data-slot`: Dialog's parts write theirs before spreading the
 * rest, so the value passed here wins.
 */
export function AlertDialogRoot(props: ComponentProps<typeof DialogPrimitive.Root>): ReactElement {
  return <DialogRoot data-slot="alert-dialog" {...props} />;
}

export function AlertDialogTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>): ReactElement {
  return <DialogTrigger data-slot="alert-dialog-trigger" {...props} />;
}

export type AlertDialogContentProps = Omit<DialogContentProps, "showCloseButton" | "children"> & {
  /** Confirm heading, rendered in `Dialog.Title`. */
  title: string;
  /**
   * Icon rendered to the right of the title. Defaults to `WarningOctagon` (destructive)
   * or `Info` (neutral).
   */
  icon?: ReactNode;
  /**
   * Drives the action-button variant and the fallback icon. Destructive dialogs
   * initially focus Cancel; neutral dialogs initially focus the primary action.
   * @default "destructive"
   */
  variant?: "destructive" | "neutral";
  /**
   * Consequence copy, rendered in a real `Dialog.Description` so `aria-describedby` is
   * wired to the popup.
   */
  children: ReactNode;
  /** Visible label for the primary action button. */
  actionLabel: string;
  /**
   * Visible label for the cancel button. Defaults to the locale dictionary
   * (`alertDialog.cancel`).
   */
  cancelLabel?: string;
  /**
   * Primary button click. Closing is the caller's job unless
   * `isAutomaticallyCloseOnActionEnabled` is set.
   */
  onAction?: () => void;
  /** Cancel button click. The cancel button always closes via `Dialog.Close`. */
  onCancel?: () => void;
  /**
   * Surfaces the primary button's pending state (`isPending` — `data-pending` and
   * disabled interaction, per Button).
   * @default false
   */
  isPerformingAction?: boolean;
  /**
   * Disables the primary action button. Cancel stays enabled.
   * @default false
   */
  isActionDisabled?: boolean;
  /**
   * When true, wraps the action button in `Dialog.Close` so clicking it also dismisses.
   * Default leaves closing to the caller (async flows close after success).
   * @default false
   */
  isAutomaticallyCloseOnActionEnabled?: boolean;
};

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
  // `initialFocus` wins over both.
  const actionRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const fallbackFocus = variant === "destructive" ? cancelRef : actionRef;
  const fallbackIcon =
    variant === "destructive" ? (
      <WarningOctagon className="size-5 shrink-0 text-error" />
    ) : (
      <Info className="size-5 shrink-0" />
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
      <DialogHeader className="flex-row items-start justify-between gap-4">
        <DialogTitle className="text-balance">{title}</DialogTitle>
        {icon ?? fallbackIcon}
      </DialogHeader>
      <DialogDescription>{children}</DialogDescription>
      <DialogFooter>
        <DialogPrimitive.Close
          render={<Button ref={cancelRef} size="sm" variant="ghost" data-dialog-action-type="secondary" />}
          onClick={onCancel}>
          {cancelLabel ?? strings.format("cancel")}
        </DialogPrimitive.Close>
        {isAutomaticallyCloseOnActionEnabled ? <DialogPrimitive.Close render={actionButton} /> : actionButton}
      </DialogFooter>
    </DialogContent>
  );
}

AlertDialogRoot.displayName = "AlertDialog.Root";
AlertDialogTrigger.displayName = "AlertDialog.Trigger";
AlertDialogContent.displayName = "AlertDialog.Content";
