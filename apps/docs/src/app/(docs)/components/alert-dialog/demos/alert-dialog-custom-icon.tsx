"use client";

import { AlertDialog } from "@elmeragroup/ui/alert-dialog";
import { Button } from "@elmeragroup/ui/button";
import { Trash } from "@elmeragroup/ui/icons";

export function AlertDialogCustomIcon() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger render={<Button variant="destructive" />}>Remove contract</AlertDialog.Trigger>
      <AlertDialog.Content
        title="Remove this contract?"
        actionLabel="Remove"
        cancelLabel="Keep the contract"
        icon={<Trash className="size-5 shrink-0 text-error" />}>
        The customer loses access at the end of the current period.
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
