"use client";

import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";

export function AlertDialogCancelLabel() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>Remove contract</AlertDialog.Trigger>
      <AlertDialog.Content
        title="Remove this contract?"
        actionLabel="Remove"
        cancelLabel="Keep the contract"
        isAutomaticallyCloseOnActionEnabled>
        The customer loses access at the end of the current period.
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
