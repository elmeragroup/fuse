import { Button } from "@elmeragroup/ui/button";
import { Dialog } from "@elmeragroup/ui/dialog";

export function DialogNoCloseButton() {
  return (
    <Dialog.Root>
      <Dialog.Trigger render={<Button variant="outline" />}>Read the terms</Dialog.Trigger>
      <Dialog.Content showCloseButton={false}>
        <Dialog.Header>
          <Dialog.Title>Terms for the fixed price</Dialog.Title>
          <Dialog.Description>The corner dismiss affordance is turned off here.</Dialog.Description>
        </Dialog.Header>
        <Dialog.Close render={<Button variant="outline" />}>I have read the terms</Dialog.Close>
      </Dialog.Content>
    </Dialog.Root>
  );
}
