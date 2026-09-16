"use client";

import { useId, useState } from "react";

import { Button } from "@elmeragroup/ui/button";
import { Field } from "@elmeragroup/ui/field";
import { Input } from "@elmeragroup/ui/input";
import { Sheet } from "@elmeragroup/ui/sheet";
import { Textarea } from "@elmeragroup/ui/textarea";

/** FormData values for these text controls are strings; `File` is possible in the type only. */
function submittedValue(data: FormData, name: string): string {
  const value = data.get(name);
  return value instanceof File ? "" : (value ?? "");
}

/** Submits a reading locally, closes the sheet and shows a resettable receipt. */
export function SheetForm() {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <Sheet.Root open={open} onOpenChange={setOpen}>
        <Sheet.Trigger render={<Button variant="outline" />}>Report a reading</Sheet.Trigger>
        <Sheet.Content>
          <Sheet.Header>
            <Sheet.Title>Report a reading</Sheet.Title>
            <Sheet.Description>The on-screen keyboard keeps the panel usable on mobile.</Sheet.Description>
          </Sheet.Header>
          <Sheet.Body>
            <form
              id={formId}
              className="flex flex-col gap-6"
              onSubmit={(event) => {
                event.preventDefault();
                // The native controls own their values; the submit handler is the only
                // reader, so no input state is kept just to build the receipt.
                const data = new FormData(event.currentTarget);
                setReceipt(
                  `Reading ${submittedValue(data, "reading")} recorded for meter ${submittedValue(data, "meter")} in this demo.`
                );
                setOpen(false);
              }}>
              <Field.Root>
                <Field.Label>Meter number</Field.Label>
                <Input name="meter" required />
              </Field.Root>
              <Field.Root>
                <Field.Label>Reading</Field.Label>
                <Input name="reading" type="number" min={0} required />
              </Field.Root>
              <Field.Root>
                <Field.Label>Note</Field.Label>
                <Textarea name="note" />
              </Field.Root>
            </form>
          </Sheet.Body>
          <Sheet.Footer>
            <Sheet.Close render={<Button variant="outline" />}>Cancel</Sheet.Close>
            <Button type="submit" form={formId}>
              Send reading
            </Button>
          </Sheet.Footer>
        </Sheet.Content>
      </Sheet.Root>
      <p role="status">{receipt}</p>
      {receipt ? (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setReceipt("")}>
          Reset example
        </Button>
      ) : null}
    </div>
  );
}
