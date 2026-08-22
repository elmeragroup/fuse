import { Button } from "@elmeragroup/ui/button";
import { Dialog } from "@elmeragroup/ui/dialog";

export function DialogFooterClose() {
  return (
    <Dialog.Root>
      <Dialog.Trigger render={<Button variant="outline" />}>Cancel the contract</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Cancel the contract</Dialog.Title>
          <Dialog.Description>
            The contract ends on the last day of the current notice period.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer showCloseButton>
          <Button>Cancel contract</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
