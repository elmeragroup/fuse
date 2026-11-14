"use client";

import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";

export function AlertDialogNeutral() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>Archive meter</AlertDialog.Trigger>
      <AlertDialog.Content
        variant="neutral"
        title="Archive this meter?"
        actionLabel="Archive"
        isAutomaticallyCloseOnActionEnabled>
        Readings stay in history. The meter leaves the active list.
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
