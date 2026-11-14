"use client";

import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";
import { Button } from "@elmeragroup/fuse/button";

export function AlertDialogSizeSm() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger render={<Button variant="destructive" />}>Delete order</AlertDialog.Trigger>
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
