"use client";

import { useId, useState } from "react";

import { Dialog } from "@elmeragroup/fuse/dialog";

export function DialogForm() {
  const formId = useId();
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>Call me back</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Call me back</Dialog.Title>
          <Dialog.Description>We call you within one working day.</Dialog.Description>
        </Dialog.Header>
        <form
          id={formId}
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setOpen(false);
          }}>
          <label className="flex flex-col gap-1">
            Name
            <input name="name" autoComplete="name" required />
          </label>
          <label className="flex flex-col gap-1">
            Phone number
            <input name="phone" type="tel" autoComplete="tel" required />
          </label>
        </form>
        <Dialog.Footer showCloseButton closeLabel="Cancel">
          <button type="submit" form={formId}>
            Book the call
          </button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
