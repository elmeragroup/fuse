"use client";

import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";
import { Button } from "@elmeragroup/fuse/button";

export function AlertDialogSize4xl() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger render={<Button variant="destructive" />}>Delete order</AlertDialog.Trigger>
      <AlertDialog.Content
        size="4xl"
        title="Delete order?"
        actionLabel="Delete"
        isAutomaticallyCloseOnActionEnabled>
        This permanently removes the order and cannot be undone.
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
