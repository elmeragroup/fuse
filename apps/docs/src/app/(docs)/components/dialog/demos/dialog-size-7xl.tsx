"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Dialog } from "@elmeragroup/fuse/dialog";

export function DialogSize7xl() {
  return (
    <Dialog.Root>
      <Dialog.Trigger render={<Button variant="outline" />}>Compare tariffs</Dialog.Trigger>
      <Dialog.Content size="7xl">
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
