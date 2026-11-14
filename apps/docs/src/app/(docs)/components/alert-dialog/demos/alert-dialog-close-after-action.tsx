"use client";

import { useState } from "react";

import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";

export function AlertDialogCloseAfterAction() {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger>Delete order</AlertDialog.Trigger>
      <AlertDialog.Content
        title="Delete order?"
        actionLabel="Delete"
        isPerformingAction={isDeleting}
        onAction={() => {
          setIsDeleting(true);
          window.setTimeout(() => {
            setIsDeleting(false);
            setOpen(false);
          }, 600);
        }}>
        This permanently removes the order and cannot be undone.
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
