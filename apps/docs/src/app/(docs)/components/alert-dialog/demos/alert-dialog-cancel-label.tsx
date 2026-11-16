"use client";

import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";
import { Button } from "@elmeragroup/fuse/button";

export function AlertDialogCancelLabel() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger render={<Button variant="destructive" />}>Remove contract</AlertDialog.Trigger>
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
