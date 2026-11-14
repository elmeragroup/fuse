"use client";

import { Dialog } from "@elmeragroup/fuse/dialog";

export function DialogDemo() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Move the meter reading</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Move the meter reading</Dialog.Title>
          <Dialog.Description>
            The reading is copied to the new address and the old contract is closed.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
          <Dialog.Close>Cancel</Dialog.Close>
          <button type="button">Move reading</button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
