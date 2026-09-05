"use client";

import { Button } from "@elmeragroup/ui/button";
import { Field } from "@elmeragroup/ui/field";
import { Input } from "@elmeragroup/ui/input";
import { Sheet } from "@elmeragroup/ui/sheet";
import { Textarea } from "@elmeragroup/ui/textarea";

export function SheetForm() {
  return (
    <Sheet.Root>
      <Sheet.Trigger render={<Button variant="outline" />}>Report a reading</Sheet.Trigger>
      <Sheet.Content>
        <Sheet.Header>
          <Sheet.Title>Report a reading</Sheet.Title>
          <Sheet.Description>The on-screen keyboard keeps the panel usable on mobile.</Sheet.Description>
        </Sheet.Header>
        <Sheet.Body>
          <form className="flex flex-col gap-6">
            <Field.Root>
              <Field.Label>Meter number</Field.Label>
              <Input name="meter" />
            </Field.Root>
            <Field.Root>
              <Field.Label>Reading</Field.Label>
              <Input name="reading" inputMode="numeric" />
            </Field.Root>
            <Field.Root>
              <Field.Label>Note</Field.Label>
              <Textarea name="note" />
            </Field.Root>
          </form>
        </Sheet.Body>
        <Sheet.Footer>
          <Sheet.Close render={<Button variant="outline" />}>Cancel</Sheet.Close>
          <Button type="submit">Send reading</Button>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet.Root>
  );
}
