"use client";

import { Button } from "@elmeragroup/ui/button";
import { Dialog } from "@elmeragroup/ui/dialog";

const sizes = ["sm", "md", "lg", "4xl", "8xl"] as const;

export function DialogSizes() {
  return (
    <div className="flex flex-wrap gap-2">
      {sizes.map((size) => (
        <Dialog.Root key={size}>
          <Dialog.Trigger render={<Button variant="outline" />}>{size}</Dialog.Trigger>
          <Dialog.Content size={size}>
            <Dialog.Header>
              <Dialog.Title>Size {size}</Dialog.Title>
              <Dialog.Description>The size axis only sets the popup max-width.</Dialog.Description>
            </Dialog.Header>
          </Dialog.Content>
        </Dialog.Root>
      ))}
    </div>
  );
}
