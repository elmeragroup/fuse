"use client";

import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";

export function AlertDialogSizeSm() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>Delete order</AlertDialog.Trigger>
      <AlertDialog.Content
        size="sm"
        title="Delete order?"
        actionLabel="Delete"
        isAutomaticallyCloseOnActionEnabled>
        This permanently removes the order and cannot be undone.
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
