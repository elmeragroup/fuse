"use client";

import { Dialog } from "@elmeragroup/fuse/dialog";

export function DialogFooterClose() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Cancel the contract</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Cancel the contract</Dialog.Title>
          <Dialog.Description>
            The contract ends on the last day of the current notice period.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer showCloseButton>
          <button type="button">Cancel contract</button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
