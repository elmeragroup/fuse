"use client";

import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";
import { Button } from "@elmeragroup/fuse/button";

export function AlertDialogPending() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger render={<Button variant="destructive" />}>Delete reading</AlertDialog.Trigger>
      <AlertDialog.Content title="Delete this reading?" actionLabel="Delete" isPerformingAction>
        The reading is removed from the meter's history.
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
