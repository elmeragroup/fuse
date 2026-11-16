"use client";

import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";
import { Button } from "@elmeragroup/fuse/button";

export function AlertDialogActionDisabled() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger render={<Button variant="destructive" />}>Delete site</AlertDialog.Trigger>
      <AlertDialog.Content title="Delete this site?" actionLabel="Delete" isActionDisabled>
        Move the site's three meters to another site before you delete it.
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
