"use client";

import { useId, useState } from "react";

import { Sheet } from "@elmeragroup/fuse/sheet";

export function SheetForm() {
  const formId = useId();
  const [open, setOpen] = useState(false);

  return (
    <Sheet.Root open={open} onOpenChange={setOpen}>
      <Sheet.Trigger>Report a reading</Sheet.Trigger>
      <Sheet.Content>
        <Sheet.Header>
          <Sheet.Title>Report a reading</Sheet.Title>
          <Sheet.Description>Read the meter on the day you report it.</Sheet.Description>
        </Sheet.Header>
        <Sheet.Body>
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setOpen(false);
            }}>
            <label className="flex flex-col gap-1">
              Meter number
              <input name="meter" required />
            </label>
            <label className="flex flex-col gap-1">
              Reading
              <input name="reading" type="number" min={0} required />
            </label>
            <label className="flex flex-col gap-1">
              Note
              <textarea name="note" />
            </label>
          </form>
        </Sheet.Body>
        <Sheet.Footer>
          <Sheet.Close>Cancel</Sheet.Close>
          <button type="submit" form={formId}>
            Send reading
          </button>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet.Root>
  );
}
