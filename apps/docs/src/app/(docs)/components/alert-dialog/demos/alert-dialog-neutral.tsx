"use client";

import { AlertDialog } from "@elmeragroup/ui/alert-dialog";
import { Button } from "@elmeragroup/ui/button";

export function AlertDialogNeutral() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger render={<Button variant="outline" />}>Archive meter</AlertDialog.Trigger>
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
