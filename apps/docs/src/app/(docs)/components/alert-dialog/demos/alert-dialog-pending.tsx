"use client";

import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";

export function AlertDialogPending() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>Delete reading</AlertDialog.Trigger>
      <AlertDialog.Content title="Delete this reading?" actionLabel="Delete" isPerformingAction>
        The reading is removed from the meter's history.
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
