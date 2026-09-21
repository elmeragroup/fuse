"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Dialog } from "@elmeragroup/fuse/dialog";

export function DialogBasic() {
  return (
    <Dialog.Root>
      <Dialog.Trigger render={<Button variant="outline" />}>Move the meter reading</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Move the meter reading</Dialog.Title>
          <Dialog.Description>
            The reading is copied to the new address and the old contract is closed.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="outline" />}>Cancel</Dialog.Close>
          <Button>Move reading</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
