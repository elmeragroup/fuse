"use client";

import { useState } from "react";

import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";
import { Button } from "@elmeragroup/fuse/button";

export function AlertDialogPending() {
  const [isPerformingAction, setIsPerformingAction] = useState(true);
  const [isActionDisabled, setIsActionDisabled] = useState(false);

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setIsPerformingAction((value) => !value)}>
          {isPerformingAction ? "Clear pending" : "Set pending"}
        </Button>
        <Button variant="outline" onClick={() => setIsActionDisabled((value) => !value)}>
          {isActionDisabled ? "Enable action" : "Disable action"}
        </Button>
      </div>
      <AlertDialog.Root>
        <AlertDialog.Trigger render={<Button variant="destructive" />}>Delete reading</AlertDialog.Trigger>
        <AlertDialog.Content
          title="Delete this reading?"
          actionLabel="Delete"
          isPerformingAction={isPerformingAction}
          isActionDisabled={isActionDisabled}>
          Pending and disabled are independent. Cancel stays available either way.
        </AlertDialog.Content>
      </AlertDialog.Root>
    </div>
  );
}
