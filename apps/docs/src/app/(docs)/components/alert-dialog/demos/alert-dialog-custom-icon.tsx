"use client";

import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";
import { Trash } from "@elmeragroup/fuse/icons";

export function AlertDialogCustomIcon() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>Remove contract</AlertDialog.Trigger>
      <AlertDialog.Content
        title="Remove this contract?"
        actionLabel="Remove"
        isAutomaticallyCloseOnActionEnabled
        icon={<Trash className="size-5 shrink-0 text-error" />}>
        The customer loses access at the end of the current period.
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
