"use client";

import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";

export function AlertDialogActionDisabled() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>Delete site</AlertDialog.Trigger>
      <AlertDialog.Content title="Delete this site?" actionLabel="Delete" isActionDisabled>
        Move the site's three meters to another site before you delete it.
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
