"use client";

import { useState } from "react";

import { AlertDialog } from "@elmeragroup/ui/alert-dialog";
import { Button } from "@elmeragroup/ui/button";
import { Trash } from "@elmeragroup/ui/icons";

/** Demonstrates a local removal with an explicit restore action. */
export function AlertDialogCustomIcon() {
  const [removed, setRemoved] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <AlertDialog.Root>
        <AlertDialog.Trigger render={<Button variant="destructive" />}>Remove contract</AlertDialog.Trigger>
        <AlertDialog.Content
          title="Remove this contract?"
          isAutomaticallyCloseOnActionEnabled
          onAction={() => setRemoved(true)}
          actionLabel="Remove"
          cancelLabel="Keep the contract"
          icon={<Trash className="size-5 shrink-0 text-error" />}>
          The customer loses access at the end of the current period.
        </AlertDialog.Content>
      </AlertDialog.Root>
      <p role="status">{removed ? "Contract removed from this demo." : ""}</p>
      {removed ? (
        <Button variant="outline" onClick={() => setRemoved(false)}>
          Restore contract
        </Button>
      ) : null}
    </div>
  );
}
