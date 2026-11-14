"use client";

import { Dialog } from "@elmeragroup/fuse/dialog";

export function DialogSize5xl() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Compare tariffs</Dialog.Trigger>
      <Dialog.Content size="5xl">
        <Dialog.Header>
          <Dialog.Title>Compare tariffs</Dialog.Title>
          <Dialog.Description>
            Fixed price, spot price and the variable tariff, side by side for your address.
          </Dialog.Description>
        </Dialog.Header>
      </Dialog.Content>
    </Dialog.Root>
  );
}
