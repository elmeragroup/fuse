"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Dialog } from "@elmeragroup/fuse/dialog";

export function DialogNoCloseButton() {
  return (
    <Dialog.Root>
      <Dialog.Trigger render={<Button variant="outline" />}>Read the terms</Dialog.Trigger>
      <Dialog.Content showCloseButton={false}>
        <Dialog.Header>
          <Dialog.Title>Terms for the fixed price</Dialog.Title>
          <Dialog.Description>The price is fixed for 12 months from the start date.</Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="outline" />}>I have read the terms</Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
