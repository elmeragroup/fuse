"use client";

import { useId, useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";
import { RadioItem, RadioItemGroup } from "@elmeragroup/fuse/radio-group";

/** FormData values for these text controls are strings; `File` is possible in the type only. */
function submittedValue(data: FormData, name: string): string {
  const value = data.get(name);
  return value instanceof File ? "" : (value ?? "");
}

/** Books a call back locally, closes the dialog and shows a resettable receipt. */
export function DialogForm() {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("morning");
  const [receipt, setReceipt] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger render={<Button variant="outline" />}>Call me back</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Call me back</Dialog.Title>
            <Dialog.Description>We call you within one working day.</Dialog.Description>
          </Dialog.Header>
          <form
            id={formId}
            className="flex flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              // The native inputs own their values; the submit handler is the only reader.
              const data = new FormData(event.currentTarget);
              setReceipt(
                `We will call ${submittedValue(data, "name")} on ${submittedValue(data, "phone")} in the ${time} in this demo.`
              );
              setOpen(false);
            }}>
            <Field.Root>
              <Field.Label>Name</Field.Label>
              <Input name="name" autoComplete="name" required />
            </Field.Root>
            <Field.Root>
              <Field.Label>Phone number</Field.Label>
              <Input name="phone" type="tel" autoComplete="tel" required />
            </Field.Root>
            <RadioItemGroup label="When should we call?" value={time} onChange={setTime}>
              <RadioItem value="morning">
                <RadioItem.Content>
                  <RadioItem.Title>Morning</RadioItem.Title>
                  <RadioItem.Description>08:00 to 12:00</RadioItem.Description>
                </RadioItem.Content>
              </RadioItem>
              <RadioItem value="afternoon">
                <RadioItem.Content>
                  <RadioItem.Title>Afternoon</RadioItem.Title>
                  <RadioItem.Description>12:00 to 16:00</RadioItem.Description>
                </RadioItem.Content>
              </RadioItem>
            </RadioItemGroup>
          </form>
          <Dialog.Footer showCloseButton closeLabel="Cancel">
            <Button type="submit" form={formId}>
              Book the call
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
      <p role="status">{receipt}</p>
      {receipt ? (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setReceipt("")}>
          Reset example
        </Button>
      ) : null}
    </div>
  );
}
